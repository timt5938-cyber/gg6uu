import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http, { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

type LoggerLike = {
  info(source: string, message: string): void;
  warn(source: string, message: string): void;
  error(source: string, message: string): void;
};

type BindMode = "localhost" | "lan";

export type RemoteControlDevice = {
  id: string;
  name: string;
  tokenHash: string;
  pairedAt: string;
  lastSeenAt: string | null;
};

export type RemoteControlConfig = {
  enabled: boolean;
  bindMode: BindMode;
  port: number;
  allowNewPairing: boolean;
  pairingExpirationSec: number;
  remoteLogs: boolean;
  pairedDevices: RemoteControlDevice[];
  lastRemoteConnectionAt: string | null;
};

export type RemoteControlInfo = {
  enabled: boolean;
  bindMode: BindMode;
  port: number;
  isRunning: boolean;
  bindAddress: string;
  networkAddresses: string[];
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  allowNewPairing: boolean;
  pairedDevices: Array<{
    id: string;
    name: string;
    pairedAt: string;
    lastSeenAt: string | null;
  }>;
  activeClients: number;
  authFailures: number;
  lastRemoteAction: string | null;
  lastRemoteConnectionAt: string | null;
  lastError: string | null;
};

type AnalyticsSummary = Record<string, unknown>;
type AppStateLike = Record<string, unknown>;
type RuntimeStateLike = Record<string, unknown>;
type ProfileLike = Record<string, unknown>;
type LogLike = Record<string, unknown>;
type DiagnosticLike = Record<string, unknown>;

type PairingSession = {
  code: string;
  expiresAt: string;
};

type RemoteHandlers = {
  getAppState: () => AppStateLike;
  getProfiles: () => ProfileLike[];
  getRuntimeState: () => RuntimeStateLike;
  getLogs: () => LogLike[];
  getAnalyticsSummary: () => AnalyticsSummary;
  getDiagnostics: () => DiagnosticLike[];
  startRuntime: (profileId?: string) => Promise<AppStateLike>;
  stopRuntime: () => Promise<AppStateLike>;
  restartRuntime: (profileId?: string) => Promise<AppStateLike>;
  selectProfile: (profileId: string) => Promise<AppStateLike>;
  testAllProfiles: () => Promise<AppStateLike>;
};

type RemoteEvent =
  | "runtime-started"
  | "runtime-stopped"
  | "profile-switched"
  | "test-all-started"
  | "test-all-progress"
  | "test-all-finished"
  | "youtube-check"
  | "discord-check"
  | "logs-appended"
  | "diagnostics-updated"
  | "pairing-status"
  | "state-update";

const DEFAULT_CONFIG: RemoteControlConfig = {
  enabled: false,
  bindMode: "localhost",
  port: 17847,
  allowNewPairing: true,
  pairingExpirationSec: 180,
  remoteLogs: true,
  pairedDevices: [],
  lastRemoteConnectionAt: null,
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function nowIso(): string {
  return new Date().toISOString();
}

function toNumberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeDeviceName(name: unknown): string {
  const normalized = String(name || "").trim().replace(/\s+/g, " ");
  return normalized.slice(0, 64) || "Android Device";
}

function sanitizeConfig(input: Partial<RemoteControlConfig> | null | undefined, base: RemoteControlConfig): RemoteControlConfig {
  return {
    enabled: typeof input?.enabled === "boolean" ? input.enabled : base.enabled,
    bindMode: input?.bindMode === "lan" ? "lan" : "localhost",
    port: Math.max(1024, Math.min(65535, toNumberOr(input?.port, base.port))),
    allowNewPairing: typeof input?.allowNewPairing === "boolean" ? input.allowNewPairing : base.allowNewPairing,
    pairingExpirationSec: Math.max(30, Math.min(3600, toNumberOr(input?.pairingExpirationSec, base.pairingExpirationSec))),
    remoteLogs: typeof input?.remoteLogs === "boolean" ? input.remoteLogs : base.remoteLogs,
    pairedDevices: Array.isArray(input?.pairedDevices)
      ? input!.pairedDevices!
          .map((device) => ({
            id: String(device.id || "").trim(),
            name: sanitizeDeviceName(device.name),
            tokenHash: String(device.tokenHash || "").trim(),
            pairedAt: String(device.pairedAt || nowIso()),
            lastSeenAt: device.lastSeenAt ? String(device.lastSeenAt) : null,
          }))
          .filter((device) => device.id && device.tokenHash)
      : base.pairedDevices,
    lastRemoteConnectionAt: input?.lastRemoteConnectionAt ? String(input.lastRemoteConnectionAt) : base.lastRemoteConnectionAt,
  };
}

type SocketClient = {
  deviceId: string;
  ws: WebSocket;
};

export class RemoteControlService {
  private readonly logger: LoggerLike;
  private readonly appName: string;
  private readonly appVersion: string;
  private readonly configFilePath: string;
  private readonly handlers: RemoteHandlers;

  private config: RemoteControlConfig;
  private pairingSession: PairingSession | null = null;

  private server: http.Server | null = null;
  private wsServer: WebSocketServer | null = null;
  private clients = new Map<string, SocketClient>();

  private authFailures = 0;
  private lastRemoteAction: string | null = null;
  private lastError: string | null = null;

  private previousRuntimeEvent: string | null = null;
  private previousLogId: string | null = null;
  private previousDiagnosticsStamp: string | null = null;
  private previousServiceStatus = new Map<string, { youtube?: string; discord?: string }>();

  constructor(params: {
    logger: LoggerLike;
    userDataDir: string;
    appName: string;
    appVersion: string;
    handlers: RemoteHandlers;
  }) {
    this.logger = params.logger;
    this.appName = params.appName;
    this.appVersion = params.appVersion;
    this.handlers = params.handlers;
    this.configFilePath = path.join(params.userDataDir, "remote-control.json");
    this.config = this.loadConfig();
  }

  getInfo(): RemoteControlInfo {
    const bindAddress = this.config.bindMode === "lan" ? "0.0.0.0" : "127.0.0.1";
    return {
      enabled: this.config.enabled,
      bindMode: this.config.bindMode,
      port: this.config.port,
      isRunning: Boolean(this.server?.listening),
      bindAddress,
      networkAddresses: this.getNetworkAddresses(),
      pairingCode: this.pairingSession?.code ?? null,
      pairingExpiresAt: this.pairingSession?.expiresAt ?? null,
      allowNewPairing: this.config.allowNewPairing,
      pairedDevices: this.config.pairedDevices.map((device) => ({
        id: device.id,
        name: device.name,
        pairedAt: device.pairedAt,
        lastSeenAt: device.lastSeenAt,
      })),
      activeClients: this.clients.size,
      authFailures: this.authFailures,
      lastRemoteAction: this.lastRemoteAction,
      lastRemoteConnectionAt: this.config.lastRemoteConnectionAt,
      lastError: this.lastError,
    };
  }

  getConfig(): RemoteControlConfig {
    return { ...this.config, pairedDevices: [...this.config.pairedDevices] };
  }

  async startIfEnabled(): Promise<void> {
    if (this.config.enabled) {
      await this.startServer();
    }
  }

  async startServer(): Promise<void> {
    if (this.server?.listening) {
      return;
    }

    const bindAddress = this.config.bindMode === "lan" ? "0.0.0.0" : "127.0.0.1";

    this.server = http.createServer((req, res) => {
      void this.handleRequest(req, res);
    });
    this.server.on("error", (error: Error) => {
      this.lastError = error.message;
      this.logger.error("REMOTE", `HTTP server error: ${error.message}`);
    });

    this.wsServer = new WebSocketServer({ noServer: true });
    this.server.on("upgrade", (request, socket, head) => {
      this.handleUpgrade(request, socket, head);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.listen(this.config.port, bindAddress, () => resolve());
      this.server?.once("error", reject);
    }).catch((error) => {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error("REMOTE", `Start failed: ${this.lastError}`);
      throw error;
    });

    this.lastError = null;
    this.lastRemoteAction = "server-started";
    this.logger.info("REMOTE", `Remote server listening on ${bindAddress}:${this.config.port}`);
    this.publish("pairing-status", this.getInfo());
  }

  async stopServer(): Promise<void> {
    for (const [, client] of this.clients) {
      try {
        client.ws.close();
      } catch {
        // ignore
      }
    }
    this.clients.clear();

    await new Promise<void>((resolve) => {
      if (!this.wsServer) {
        resolve();
        return;
      }
      this.wsServer.close(() => resolve());
      this.wsServer = null;
    });

    await new Promise<void>((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => resolve());
      this.server = null;
    });

    this.lastRemoteAction = "server-stopped";
    this.logger.info("REMOTE", "Remote server stopped");
    this.publish("pairing-status", this.getInfo());
  }

  async updateConfig(patch: Partial<RemoteControlConfig>): Promise<RemoteControlInfo> {
    const previous = this.getConfig();
    this.config = sanitizeConfig(patch, { ...previous, ...this.config });
    this.saveConfig();

    const needsRestart =
      previous.enabled !== this.config.enabled ||
      previous.bindMode !== this.config.bindMode ||
      previous.port !== this.config.port;

    if (needsRestart) {
      await this.stopServer();
      if (this.config.enabled) {
        await this.startServer();
      }
    }

    this.publish("pairing-status", this.getInfo());
    return this.getInfo();
  }

  async generatePairingCode(): Promise<{ code: string; expiresAt: string }> {
    if (!this.config.allowNewPairing) {
      throw new Error("New pairing is disabled");
    }
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + this.config.pairingExpirationSec * 1000).toISOString();
    this.pairingSession = { code, expiresAt };
    this.lastRemoteAction = "pairing-code-generated";
    this.publish("pairing-status", this.getInfo());
    return { code, expiresAt };
  }

  async getPairingCode(): Promise<{ code: string | null; expiresAt: string | null }> {
    if (this.pairingSession && Date.parse(this.pairingSession.expiresAt) <= Date.now()) {
      this.pairingSession = null;
    }
    return {
      code: this.pairingSession?.code ?? null,
      expiresAt: this.pairingSession?.expiresAt ?? null,
    };
  }

  async unpairDevice(deviceId: string): Promise<RemoteControlInfo> {
    this.config = {
      ...this.config,
      pairedDevices: this.config.pairedDevices.filter((device) => device.id !== deviceId),
    };
    this.saveConfig();

    for (const [key, client] of this.clients) {
      if (client.deviceId === deviceId) {
        try {
          client.ws.close(1008, "unpaired");
        } catch {
          // ignore
        }
        this.clients.delete(key);
      }
    }

    this.lastRemoteAction = `unpair:${deviceId}`;
    this.publish("pairing-status", this.getInfo());
    return this.getInfo();
  }

  handleAppState(appState: AppStateLike): void {
    const runtime = (appState?.runtime as Record<string, unknown>) || {};
    const runtimeEvent = typeof runtime.lastRuntimeEvent === "string" ? runtime.lastRuntimeEvent : null;

    this.publish("state-update", {
      runtime,
      activeProfileId: appState?.activeProfileId ?? null,
      summary: appState?.referenceSummary ?? null,
    });

    if (runtimeEvent && runtimeEvent !== this.previousRuntimeEvent) {
      this.previousRuntimeEvent = runtimeEvent;
      if (runtimeEvent.startsWith("start:")) {
        this.publish("runtime-started", { runtimeEvent });
      } else if (runtimeEvent.startsWith("stop:")) {
        this.publish("runtime-stopped", { runtimeEvent });
      } else if (runtimeEvent.startsWith("route:")) {
        this.publish("profile-switched", { runtimeEvent, activeProfileId: appState?.activeProfileId ?? null });
      } else if (runtimeEvent.startsWith("test-all:start")) {
        this.publish("test-all-started", { runtimeEvent });
      } else if (runtimeEvent.startsWith("test-all:run") || runtimeEvent.startsWith("test-all:done")) {
        this.publish("test-all-progress", { runtimeEvent, testQueue: runtime.testQueue ?? [] });
      } else if (runtimeEvent.startsWith("test-all:finished") || runtimeEvent.startsWith("test-all:cancelled")) {
        this.publish("test-all-finished", { runtimeEvent, testResults: runtime.testResults ?? {} });
      }
    }

    const logs = Array.isArray(appState?.logs) ? (appState.logs as Array<Record<string, unknown>>) : [];
    const latestLog = logs[logs.length - 1];
    const latestLogId = latestLog ? String(latestLog.id ?? "") : null;
    if (latestLogId && latestLogId !== this.previousLogId) {
      const latestTimestamp = latestLog?.timestamp ? String(latestLog.timestamp) : "";
      const newLogs = this.previousLogId
        ? logs.filter((item) => String(item.timestamp || "") >= latestTimestamp)
        : logs.slice(-5);
      this.previousLogId = latestLogId;
      if (this.config.remoteLogs && newLogs.length > 0) {
        this.publish("logs-appended", { entries: newLogs });
      }
    }

    const diagnostics = Array.isArray(appState?.diagnostics) ? (appState.diagnostics as Array<Record<string, unknown>>) : [];
    const diagnosticsStamp = diagnostics.length > 0 ? `${diagnostics.length}:${String(diagnostics[diagnostics.length - 1]?.id ?? "")}` : "0";
    if (diagnosticsStamp !== this.previousDiagnosticsStamp) {
      this.previousDiagnosticsStamp = diagnosticsStamp;
      this.publish("diagnostics-updated", { count: diagnostics.length, latest: diagnostics[diagnostics.length - 1] ?? null });
    }

    const profiles = Array.isArray(appState?.profiles) ? (appState.profiles as Array<Record<string, unknown>>) : [];
    for (const profile of profiles) {
      const profileId = String(profile.id || "");
      if (!profileId) {
        continue;
      }
      const youtube = String(profile.youtubeStatus || "not_tested");
      const discord = String(profile.discordStatus || "not_tested");
      const previous = this.previousServiceStatus.get(profileId);
      if (!previous || previous.youtube !== youtube) {
        this.publish("youtube-check", { profileId, status: youtube });
      }
      if (!previous || previous.discord !== discord) {
        this.publish("discord-check", { profileId, status: discord });
      }
      this.previousServiceStatus.set(profileId, { youtube, discord });
    }
  }

  private loadConfig(): RemoteControlConfig {
    try {
      if (!fs.existsSync(this.configFilePath)) {
        return { ...DEFAULT_CONFIG, pairedDevices: [] };
      }

      const raw = fs.readFileSync(this.configFilePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<RemoteControlConfig>;
      return sanitizeConfig(parsed, DEFAULT_CONFIG);
    } catch (error) {
      this.logger.warn("REMOTE", `Failed to load config: ${error instanceof Error ? error.message : String(error)}`);
      return { ...DEFAULT_CONFIG, pairedDevices: [] };
    }
  }

  private saveConfig(): void {
    try {
      fs.mkdirSync(path.dirname(this.configFilePath), { recursive: true });
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2), "utf8");
    } catch (error) {
      this.logger.error("REMOTE", `Failed to save config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getNetworkAddresses(): string[] {
    const host = this.config.bindMode === "lan" ? "0.0.0.0" : "127.0.0.1";
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];

    if (host === "127.0.0.1") {
      addresses.push(`http://127.0.0.1:${this.config.port}`);
      return addresses;
    }

    for (const iface of Object.values(interfaces)) {
      for (const net of iface || []) {
        if (net.family !== "IPv4" || net.internal) {
          continue;
        }
        addresses.push(`http://${net.address}:${this.config.port}`);
      }
    }

    addresses.sort();
    return addresses;
  }

  private writeJson(res: ServerResponse, code: number, payload: unknown): void {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-AltProxy-Token");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.end(JSON.stringify(payload));
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!req.url || !req.method) {
      this.writeJson(res, 400, { error: "Bad request" });
      return;
    }

    if (req.method === "OPTIONS") {
      this.writeJson(res, 204, {});
      return;
    }

    const parsedUrl = new URL(req.url, "http://127.0.0.1");
    const route = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    if (method === "GET" && route === "/status") {
      this.writeJson(res, 200, {
        appName: this.appName,
        appVersion: this.appVersion,
        remoteEnabled: this.config.enabled,
        bindMode: this.config.bindMode,
        port: this.config.port,
        pairingAvailable: this.config.allowNewPairing,
        runtime: this.handlers.getRuntimeState(),
      });
      return;
    }

    if (method === "POST" && route === "/pair") {
      const body = await this.readBody(req);
      const code = String(body.code || "").trim();
      const deviceName = sanitizeDeviceName(body.deviceName);
      const paired = this.handlePairRequest(code, deviceName);
      if (!paired.success) {
        this.writeJson(res, 400, { error: paired.error });
        return;
      }
      this.writeJson(res, 200, paired.payload);
      return;
    }

    const auth = this.authenticate(req);
    if (!auth) {
      this.authFailures += 1;
      this.writeJson(res, 401, { error: "Unauthorized" });
      return;
    }

    this.touchDevice(auth.id);

    if (method === "GET" && route === "/profiles") {
      this.writeJson(res, 200, this.handlers.getProfiles());
      return;
    }
    if (method === "GET" && route === "/runtime") {
      this.writeJson(res, 200, this.handlers.getRuntimeState());
      return;
    }
    if (method === "GET" && route === "/logs") {
      const logs = this.handlers.getLogs();
      const limit = Math.max(1, Math.min(1000, toNumberOr(parsedUrl.searchParams.get("limit"), 200)));
      this.writeJson(res, 200, logs.slice(-limit));
      return;
    }
    if (method === "GET" && route === "/analytics-summary") {
      this.writeJson(res, 200, this.handlers.getAnalyticsSummary());
      return;
    }
    if (method === "GET" && route === "/diagnostics") {
      this.writeJson(res, 200, this.handlers.getDiagnostics());
      return;
    }

    if (method === "POST" && route === "/runtime/start") {
      const body = await this.readBody(req);
      const profileId = body.profileId ? String(body.profileId) : undefined;
      const state = await this.handlers.startRuntime(profileId);
      this.markRemoteAction("runtime:start");
      this.writeJson(res, 200, state);
      return;
    }
    if (method === "POST" && route === "/runtime/stop") {
      const state = await this.handlers.stopRuntime();
      this.markRemoteAction("runtime:stop");
      this.writeJson(res, 200, state);
      return;
    }
    if (method === "POST" && route === "/runtime/restart") {
      const body = await this.readBody(req);
      const profileId = body.profileId ? String(body.profileId) : undefined;
      const state = await this.handlers.restartRuntime(profileId);
      this.markRemoteAction("runtime:restart");
      this.writeJson(res, 200, state);
      return;
    }
    if (method === "POST" && route === "/profiles/select") {
      const body = await this.readBody(req);
      const profileId = String(body.profileId || "").trim();
      if (!profileId) {
        this.writeJson(res, 400, { error: "profileId is required" });
        return;
      }
      const state = await this.handlers.selectProfile(profileId);
      this.markRemoteAction(`profile:select:${profileId}`);
      this.writeJson(res, 200, state);
      return;
    }
    if (method === "POST" && route === "/profiles/test-all") {
      const state = await this.handlers.testAllProfiles();
      this.markRemoteAction("profiles:test-all");
      this.writeJson(res, 200, state);
      return;
    }
    if (method === "POST" && route === "/unpair") {
      const body = await this.readBody(req);
      const deviceId = String(body.deviceId || "").trim();
      if (!deviceId) {
        this.writeJson(res, 400, { error: "deviceId is required" });
        return;
      }
      const info = await this.unpairDevice(deviceId);
      this.writeJson(res, 200, info);
      return;
    }

    this.writeJson(res, 404, { error: "Not found" });
  }

  private handleUpgrade(request: IncomingMessage, socket: import("node:net").Socket, head: Buffer): void {
    if (!request.url || !this.wsServer) {
      socket.destroy();
      return;
    }

    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get("token") || this.extractToken(request);
    const device = token ? this.findDeviceByToken(token) : null;
    if (!device) {
      this.authFailures += 1;
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    this.wsServer.handleUpgrade(request, socket, head, (ws) => {
      const key = `${device.id}:${crypto.randomUUID()}`;
      this.clients.set(key, { deviceId: device.id, ws });
      this.touchDevice(device.id);
      this.publish("pairing-status", this.getInfo());

      ws.send(
        JSON.stringify({
          event: "connected",
          timestamp: nowIso(),
          payload: {
            deviceId: device.id,
            appName: this.appName,
            appVersion: this.appVersion,
            status: this.handlers.getRuntimeState(),
          },
        }),
      );

      ws.on("close", () => {
        this.clients.delete(key);
        this.publish("pairing-status", this.getInfo());
      });
    });
  }

  private authenticate(req: IncomingMessage): RemoteControlDevice | null {
    const token = this.extractToken(req);
    if (!token) {
      return null;
    }
    return this.findDeviceByToken(token);
  }

  private extractToken(req: IncomingMessage): string | null {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string") {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
    const xToken = req.headers["x-altproxy-token"];
    if (typeof xToken === "string" && xToken.trim()) {
      return xToken.trim();
    }
    return null;
  }

  private findDeviceByToken(token: string): RemoteControlDevice | null {
    const hashed = sha256(token);
    return this.config.pairedDevices.find((device) => device.tokenHash === hashed) || null;
  }

  private touchDevice(deviceId: string): void {
    const stamp = nowIso();
    this.config = {
      ...this.config,
      pairedDevices: this.config.pairedDevices.map((device) =>
        device.id === deviceId ? { ...device, lastSeenAt: stamp } : device,
      ),
      lastRemoteConnectionAt: stamp,
    };
    this.saveConfig();
  }

  private handlePairRequest(
    code: string,
    deviceName: string,
  ): { success: false; error: string } | { success: true; payload: Record<string, unknown> } {
    if (!this.config.allowNewPairing) {
      return { success: false, error: "Pairing is disabled" };
    }

    if (!this.pairingSession) {
      return { success: false, error: "Pairing code is not generated" };
    }
    if (Date.parse(this.pairingSession.expiresAt) <= Date.now()) {
      this.pairingSession = null;
      return { success: false, error: "Pairing code expired" };
    }
    if (this.pairingSession.code !== code) {
      return { success: false, error: "Invalid pairing code" };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const id = crypto.randomUUID();
    const pairedAt = nowIso();
    const tokenHash = sha256(token);

    this.config = {
      ...this.config,
      pairedDevices: [
        ...this.config.pairedDevices,
        {
          id,
          name: deviceName,
          tokenHash,
          pairedAt,
          lastSeenAt: null,
        },
      ],
    };
    this.saveConfig();
    this.pairingSession = null;
    this.markRemoteAction(`pair:${id}`);
    this.publish("pairing-status", this.getInfo());

    return {
      success: true,
      payload: {
        token,
        deviceId: id,
        appName: this.appName,
        appVersion: this.appVersion,
        server: {
          bindMode: this.config.bindMode,
          port: this.config.port,
          urls: this.getNetworkAddresses(),
        },
      },
    };
  }

  private async readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return await new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1024 * 64) {
          reject(new Error("Payload too large"));
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        if (chunks.length === 0) {
          resolve({});
          return;
        }
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          resolve(parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {});
        } catch {
          resolve({});
        }
      });
      req.on("error", reject);
    });
  }

  private markRemoteAction(action: string): void {
    this.lastRemoteAction = action;
    this.logger.info("REMOTE", action);
  }

  private publish(event: RemoteEvent, payload: unknown): void {
    const message = JSON.stringify({
      event,
      timestamp: nowIso(),
      payload,
    });

    for (const [key, client] of this.clients) {
      if (client.ws.readyState !== WebSocket.OPEN) {
        this.clients.delete(key);
        continue;
      }
      try {
        client.ws.send(message);
      } catch {
        this.clients.delete(key);
      }
    }
  }
}
