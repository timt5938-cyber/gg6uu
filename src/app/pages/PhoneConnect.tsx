import { useCallback, useEffect, useMemo, useState } from "react";
import { Smartphone, RefreshCw, ShieldCheck, Unplug, Copy, Network, Wifi } from "lucide-react";
import { desktopApi } from "../services/desktopApi";

type RemoteInfo = Awaited<ReturnType<typeof desktopApi.getRemoteControlInfo>>;
type PairingCode = Awaited<ReturnType<typeof desktopApi.getRemotePairingCode>>;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1b1b1b] bg-[#0d0d0d] px-4 py-3">
      <div className="text-[10px] text-[#454545] uppercase tracking-[0.12em]">{label}</div>
      <div className="mt-1 text-[12px] text-[#d0d0d0] font-mono break-all">{value}</div>
    </div>
  );
}

export function PhoneConnect() {
  const [info, setInfo] = useState<RemoteInfo>(null);
  const [pairing, setPairing] = useState<PairingCode>({ code: null, expiresAt: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextInfo, nextPairing] = await Promise.all([
      desktopApi.getRemoteControlInfo(),
      desktopApi.getRemotePairingCode(),
    ]);
    setInfo(nextInfo);
    setPairing(nextPairing);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  const primaryUrl = useMemo(() => {
    if (!info || info.networkAddresses.length === 0) {
      return "not available";
    }
    return info.networkAddresses[0];
  }, [info]);

  const updateConfig = async (patch: {
    enabled?: boolean;
    bindMode?: "localhost" | "lan";
    port?: number;
    allowNewPairing?: boolean;
    pairingExpirationSec?: number;
    remoteLogs?: boolean;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const next = await desktopApi.updateRemoteControlConfig(patch);
      setInfo(next);
      const nextPairing = await desktopApi.getRemotePairingCode();
      setPairing(nextPairing);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to update remote control config");
    } finally {
      setLoading(false);
    }
  };

  const generateCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const code = await desktopApi.generateRemotePairingCode();
      if (code) {
        setPairing(code);
      }
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to generate pairing code");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!pairing.code) {
      return;
    }
    await navigator.clipboard.writeText(pairing.code);
  };

  return (
    <div className="h-full overflow-auto app-scroll px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-[32px] font-light tracking-[-0.02em]">Phone Connect</h1>
          <p className="text-[#505050] text-[12px] mt-1">Remote control server for Android over local Wi-Fi/LAN.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-[#272727] bg-[#131313] text-[#b0b0b0] hover:text-white"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-[#412222] bg-[#180d0d] px-4 py-3 text-[12px] text-[#d77]">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#181818] bg-[#0b0b0b] p-5">
          <div className="flex items-center gap-2 text-white text-[14px] mb-4"><Smartphone size={15} /> Remote Server</div>
          <div className="space-y-3">
            <Field label="State" value={info?.isRunning ? "running" : "stopped"} />
            <Field label="Bind" value={info ? `${info.bindMode} (${info.bindAddress}:${info.port})` : "loading"} />
            <Field label="Primary URL" value={primaryUrl} />
            <Field label="Paired Devices" value={String(info?.pairedDevices.length ?? 0)} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void updateConfig({ enabled: !(info?.enabled ?? false) })}
              className="px-3 py-2 rounded-md border border-[#2a2a2a] bg-[#151515] text-[12px] text-[#d0d0d0] hover:text-white disabled:opacity-50"
            >
              {info?.enabled ? "Disable Remote" : "Enable Remote"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void updateConfig({ bindMode: info?.bindMode === "lan" ? "localhost" : "lan" })}
              className="px-3 py-2 rounded-md border border-[#2a2a2a] bg-[#151515] text-[12px] text-[#d0d0d0] hover:text-white disabled:opacity-50"
            >
              {info?.bindMode === "lan" ? "LAN mode" : "Localhost mode"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void updateConfig({ allowNewPairing: !(info?.allowNewPairing ?? true) })}
              className="px-3 py-2 rounded-md border border-[#2a2a2a] bg-[#151515] text-[12px] text-[#d0d0d0] hover:text-white disabled:opacity-50"
            >
              {info?.allowNewPairing ? "Pairing: ON" : "Pairing: OFF"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[#181818] bg-[#0b0b0b] p-5">
          <div className="flex items-center gap-2 text-white text-[14px] mb-4"><ShieldCheck size={15} /> Pairing</div>
          <div className="rounded-lg border border-[#1f1f1f] bg-[#101010] px-4 py-6 text-center">
            <div className="text-[11px] text-[#666] mb-1">Pairing code</div>
            <div className="text-[40px] tracking-[0.2em] text-white font-mono">{pairing.code ?? "------"}</div>
            <div className="text-[11px] text-[#666] mt-1">Expires: {pairing.expiresAt ?? "not generated"}</div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={loading || !(info?.allowNewPairing ?? false)}
              onClick={() => void generateCode()}
              className="flex-1 px-3 py-2 rounded-md border border-[#2a2a2a] bg-[#151515] text-[12px] text-[#d0d0d0] hover:text-white disabled:opacity-50"
            >
              Generate Code
            </button>
            <button
              type="button"
              disabled={!pairing.code}
              onClick={() => void copyCode()}
              className="px-3 py-2 rounded-md border border-[#2a2a2a] bg-[#151515] text-[12px] text-[#d0d0d0] hover:text-white disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Copy size={13} /> Copy
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#181818] bg-[#0b0b0b] p-5">
        <div className="flex items-center gap-2 text-white text-[14px] mb-4"><Wifi size={15} /> Connection & Devices</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <Field label="Auth failures" value={String(info?.authFailures ?? 0)} />
          <Field label="Active remote clients" value={String(info?.activeClients ?? 0)} />
          <Field label="Last action" value={info?.lastRemoteAction ?? "n/a"} />
          <Field label="Last remote connection" value={info?.lastRemoteConnectionAt ?? "n/a"} />
        </div>

        <div className="rounded-lg border border-[#1f1f1f] overflow-hidden">
          {(info?.pairedDevices ?? []).length === 0 ? (
            <div className="px-4 py-6 text-[12px] text-[#666]">No paired devices yet.</div>
          ) : (
            (info?.pairedDevices ?? []).map((device) => (
              <div key={device.id} className="flex items-center justify-between px-4 py-3 border-b border-[#151515] last:border-b-0">
                <div>
                  <div className="text-[13px] text-[#ddd]">{device.name}</div>
                  <div className="text-[11px] text-[#666] font-mono">{device.id}</div>
                  <div className="text-[10px] text-[#555]">paired {device.pairedAt} · seen {device.lastSeenAt ?? "never"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void desktopApi.unpairRemoteDevice(device.id).then(() => refresh())}
                  className="px-2.5 py-1.5 rounded-md border border-[#3a2222] bg-[#190f0f] text-[#d88] hover:text-[#ffb0b0] text-[11px] inline-flex items-center gap-1"
                >
                  <Unplug size={12} /> Unpair
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#181818] bg-[#0b0b0b] p-5">
        <div className="flex items-center gap-2 text-white text-[14px] mb-3"><Network size={15} /> Mobile API</div>
        <div className="text-[12px] text-[#777] leading-relaxed space-y-1">
          <p>HTTP: <span className="font-mono">GET /status, /profiles, /runtime, /logs, /analytics-summary, /diagnostics</span></p>
          <p>Commands: <span className="font-mono">POST /runtime/start, /runtime/stop, /runtime/restart, /profiles/select, /profiles/test-all</span></p>
          <p>Auth: <span className="font-mono">Bearer &lt;token&gt;</span> after pairing via <span className="font-mono">POST /pair</span>.</p>
          <p>WebSocket: <span className="font-mono">/ws?token=...</span> for live runtime/log/diagnostic updates.</p>
        </div>
      </div>
    </div>
  );
}
