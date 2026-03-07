import fs from "node:fs";
import path from "node:path";
import { ChildProcess, spawn } from "node:child_process";

export type RuntimeResolvedFrom = "env" | "packaged" | "project" | "fallback";

export interface WinwsRuntimeDescriptor {
  rootDir: string;
  exePath: string;
  dllPaths: string[];
  driverPaths: string[];
  payloadFiles: string[];
  exists: boolean;
  isValid: boolean;
  validationErrors: string[];
  resolvedFrom: RuntimeResolvedFrom;
}

export interface WinwsRuntimeState {
  isAvailable: boolean;
  isRunning: boolean;
  pid: number | null;
  startedAt: string | null;
  stoppedAt: string | null;
  lastExitCode: number | null;
  lastError: string | null;
  exePath: string | null;
  runtimeRoot: string | null;
  validationErrors: string[];
}

type LoggerLike = {
  info(source: string, message: string): void;
  warn(source: string, message: string): void;
  error(source: string, message: string): void;
};

const REQUIRED_DLLS = ["WinDivert.dll", "cygwin1.dll"];
const REQUIRED_DRIVERS = ["WinDivert64.sys"];

export class WinwsRuntimeService {
  private readonly projectReferenceRoot: string;
  private readonly logger: LoggerLike;
  private readonly isDev: boolean;
  private runtimeProcess: ChildProcess | null = null;
  private state: WinwsRuntimeState = {
    isAvailable: false,
    isRunning: false,
    pid: null,
    startedAt: null,
    stoppedAt: null,
    lastExitCode: null,
    lastError: null,
    exePath: null,
    runtimeRoot: null,
    validationErrors: [],
  };

  constructor(params: { projectReferenceRoot: string; logger: LoggerLike; isDev: boolean }) {
    this.projectReferenceRoot = params.projectReferenceRoot;
    this.logger = params.logger;
    this.isDev = params.isDev;
  }

  resolveRuntime(): WinwsRuntimeDescriptor {
    const envOverride = this.normalize(process.env.WINWS_RUNTIME_ROOT || process.env.WINWS_RUNTIME_BIN || "");
    const resourcesPath = process.resourcesPath || "";
    const packagedBin = resourcesPath ? path.join(resourcesPath, "reference", "bin") : "";

    const candidates: Array<{ root: string; from: RuntimeResolvedFrom }> = [];

    if (envOverride) {
      const envRoot = /\.exe$/i.test(envOverride) ? path.dirname(envOverride) : envOverride;
      candidates.push({ root: envRoot, from: "env" });
    }

    if (packagedBin) {
      candidates.push({ root: packagedBin, from: "packaged" });
    }

    candidates.push({ root: path.join(this.projectReferenceRoot, "bin"), from: "project" });

    if (this.isDev) {
      candidates.push({ root: path.join(process.cwd(), "reference", "bin"), from: "fallback" });
      candidates.push({ root: path.resolve(process.cwd(), "..", "reference", "bin"), from: "fallback" });
      candidates.push({ root: "C:\\12\\reference\\bin", from: "fallback" });
    }

    const visited = new Set<string>();
    const descriptors: WinwsRuntimeDescriptor[] = [];

    for (const candidate of candidates) {
      const normalized = this.normalize(candidate.root);
      if (!normalized) {
        continue;
      }
      const key = normalized.toLowerCase();
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      descriptors.push(this.buildDescriptor(normalized, candidate.from));
    }

    const found = descriptors.find((descriptor) => descriptor.isValid) || descriptors[0] || this.buildDescriptor(path.join(this.projectReferenceRoot, "bin"), "project");
    this.syncState(found);
    return found;
  }

  validateRuntime(): WinwsRuntimeDescriptor {
    const descriptor = this.resolveRuntime();
    if (descriptor.isValid) {
      this.logger.info("WINWS", `Runtime validated (${descriptor.resolvedFrom}): ${descriptor.exePath}`);
    } else {
      this.logger.warn("WINWS", `Runtime validation failed: ${descriptor.validationErrors.join("; ")}`);
    }
    return descriptor;
  }

  getRuntimeInfo(): WinwsRuntimeDescriptor {
    return this.resolveRuntime();
  }

  getRuntimeState(): WinwsRuntimeState {
    const descriptor = this.resolveRuntime();
    return {
      ...this.state,
      isAvailable: descriptor.isValid,
      exePath: descriptor.exePath,
      runtimeRoot: descriptor.rootDir,
      validationErrors: descriptor.validationErrors,
      isRunning: this.state.isRunning || Boolean(this.runtimeProcess),
      pid: this.runtimeProcess?.pid ?? this.state.pid,
    };
  }

  async startRuntime(args: string[] = [], cwd?: string): Promise<WinwsRuntimeState> {
    if (this.runtimeProcess) {
      return this.getRuntimeState();
    }

    const descriptor = this.validateRuntime();
    if (!descriptor.isValid) {
      const message = `Runtime invalid: ${descriptor.validationErrors.join("; ")}`;
      this.state = {
        ...this.state,
        isAvailable: false,
        lastError: message,
      };
      throw new Error(message);
    }

    const launchArgs = Array.isArray(args) ? args.map((arg) => this.normalize(String(arg))) : [];
    const launchCwd = cwd ? this.normalize(cwd) : descriptor.rootDir;

    this.logger.info("WINWS", `Starting runtime command: ${descriptor.exePath}`);
    this.logger.info("WINWS", `Starting runtime args: ${JSON.stringify(launchArgs)}`);
    this.logger.info("WINWS", `Starting runtime cwd: ${launchCwd}`);

    const proc = spawn(descriptor.exePath, launchArgs, {
      cwd: launchCwd,
      shell: false,
      windowsHide: true,
      detached: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.runtimeProcess = proc;
    this.state = {
      ...this.state,
      isAvailable: true,
      isRunning: true,
      pid: proc.pid ?? null,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
      lastError: null,
      exePath: descriptor.exePath,
      runtimeRoot: descriptor.rootDir,
      validationErrors: descriptor.validationErrors,
    };

    proc.on("error", (error) => {
      this.state = {
        ...this.state,
        isRunning: false,
        pid: null,
        stoppedAt: new Date().toISOString(),
        lastError: error.message,
      };
      this.runtimeProcess = null;
      this.logger.error("WINWS", error.message);
    });

    proc.on("exit", (code) => {
      this.state = {
        ...this.state,
        isRunning: false,
        pid: null,
        stoppedAt: new Date().toISOString(),
        lastExitCode: typeof code === "number" ? code : -1,
      };
      this.runtimeProcess = null;
      this.logger.info("WINWS", `Runtime exited with code ${this.state.lastExitCode}`);
    });

    return this.getRuntimeState();
  }

  async stopRuntime(reason = "manual"): Promise<WinwsRuntimeState> {
    if (this.runtimeProcess) {
      await this.terminateProcessTree(this.runtimeProcess);
      this.runtimeProcess = null;
    }

    this.state = {
      ...this.state,
      isRunning: false,
      pid: null,
      stoppedAt: new Date().toISOString(),
    };

    this.logger.info("WINWS", `Runtime stopped (${reason})`);
    return this.getRuntimeState();
  }

  async restartRuntime(args: string[] = [], cwd?: string): Promise<WinwsRuntimeState> {
    await this.stopRuntime("restart");
    return this.startRuntime(args, cwd);
  }

  bindProcess(proc: ChildProcess, descriptor: WinwsRuntimeDescriptor): void {
    this.runtimeProcess = proc;
    this.state = {
      ...this.state,
      isAvailable: descriptor.isValid,
      isRunning: true,
      pid: proc.pid ?? null,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
      exePath: descriptor.exePath,
      runtimeRoot: descriptor.rootDir,
      validationErrors: descriptor.validationErrors,
      lastError: null,
    };
  }

  markStopped(code: number | null = null): void {
    this.runtimeProcess = null;
    this.state = {
      ...this.state,
      isRunning: false,
      pid: null,
      stoppedAt: new Date().toISOString(),
      lastExitCode: code,
    };
  }

  private normalize(input: string): string {
    return String(input || "")
      .trim()
      .replace(/^\"+|\"+$/g, "")
      .replace(/^'+|'+$/g, "");
  }

  private syncState(descriptor: WinwsRuntimeDescriptor): void {
    this.state = {
      ...this.state,
      isAvailable: descriptor.isValid,
      exePath: descriptor.exePath,
      runtimeRoot: descriptor.rootDir,
      validationErrors: descriptor.validationErrors,
    };
  }

  private buildDescriptor(rootDir: string, resolvedFrom: RuntimeResolvedFrom): WinwsRuntimeDescriptor {
    const exePath = path.join(rootDir, "winws.exe");
    const dllPaths = REQUIRED_DLLS.map((name) => path.join(rootDir, name));
    const driverPaths = REQUIRED_DRIVERS.map((name) => path.join(rootDir, name));
    const validationErrors: string[] = [];

    const exists = fs.existsSync(rootDir) && fs.statSync(rootDir).isDirectory();
    if (!exists) {
      validationErrors.push(`runtime root not found: ${rootDir}`);
    }

    if (rootDir.toLowerCase().includes(".asar")) {
      validationErrors.push(`runtime cannot be loaded from asar path: ${rootDir}`);
    }

    if (!fs.existsSync(exePath)) {
      validationErrors.push(`winws.exe not found: ${exePath}`);
    }

    for (const dllPath of dllPaths) {
      if (!fs.existsSync(dllPath)) {
        validationErrors.push(`missing sidecar dll: ${dllPath}`);
      }
    }

    for (const driverPath of driverPaths) {
      if (!fs.existsSync(driverPath)) {
        validationErrors.push(`missing driver file: ${driverPath}`);
      }
    }

    const payloadFiles = exists
      ? fs
          .readdirSync(rootDir)
          .filter((name) => /\.(bin|dat|sig)$/i.test(name))
          .map((name) => path.join(rootDir, name))
      : [];

    if (payloadFiles.length === 0) {
      validationErrors.push(`runtime payload files not found in ${rootDir}`);
    }

    return {
      rootDir,
      exePath,
      dllPaths,
      driverPaths,
      payloadFiles,
      exists,
      isValid: validationErrors.length === 0,
      validationErrors,
      resolvedFrom,
    };
  }

  private async terminateProcessTree(proc: ChildProcess): Promise<void> {
    if (!proc.pid) {
      return;
    }

    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(proc.pid), "/t", "/f"], {
        shell: false,
        windowsHide: true,
      });
      killer.once("close", () => resolve());
      killer.once("error", () => {
        proc.kill("SIGTERM");
        resolve();
      });
    });
  }
}
