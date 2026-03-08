# AltProxy Desktop

Electron desktop application for DPI bypass profile management.

## Requirements

- Windows 10/11
- Node.js 20+

## Install

```bash
npm install
```

## Development

```bash
npm run electron:dev
```

## Build installer (.exe)

```bash
npm run electron:build
```

Installer output:

- `C:\12\release\AltProxy Setup 0.0.1.exe`

## Web preview only

```bash
npm run dev
```

## Embedded Winws Runtime

The app now resolves `winws` as an embedded runtime from real filesystem paths only (never from `asar`).

Resolution order:
1. `WINWS_RUNTIME_ROOT` / `WINWS_RUNTIME_BIN`
2. packaged `resources/reference/bin`
3. project `reference/bin`
4. dev fallbacks (`./reference/bin`, `../reference/bin`, `C:\12\reference\bin`)

Main-process runtime methods (IPC):
- `app:getWinwsRuntimeInfo`
- `app:validateWinwsRuntime`
- `app:startWinwsRuntime`
- `app:stopWinwsRuntime`
- `app:restartWinwsRuntime`
- `app:getWinwsRuntimeState`

Packaged build must include `reference` in `extraResources` so `winws.exe`, sidecars (`WinDivert.dll`, `cygwin1.dll`, `WinDivert64.sys`) and payload `.bin` files are available at runtime.

## Phone Remote Control (Wi-Fi)

AltProxy now includes a built-in local control server in Electron `main` process.

### Desktop tab

Open the left sidebar tab **Phone Link** to:
- enable/disable remote control
- switch bind mode (`localhost` / `lan`)
- generate pairing code
- see local server URL/IP
- manage paired devices

### Pairing flow

1. Enable Remote Control in **Phone Link**.
2. Generate pairing code.
3. Phone calls `POST /pair` with `{ code, deviceName }`.
4. Server returns device token.
5. Use `Authorization: Bearer <token>` for protected endpoints.

### HTTP endpoints

Public:
- `GET /status`
- `POST /pair`

Authorized:
- `GET /profiles`
- `GET /runtime`
- `GET /logs`
- `GET /analytics-summary`
- `GET /diagnostics`
- `POST /runtime/start`
- `POST /runtime/stop`
- `POST /runtime/restart`
- `POST /profiles/select`
- `POST /profiles/test-all`
- `POST /unpair`

### WebSocket live updates

Connect to `ws://<ip>:<port>/ws?token=<token>`.
Events include runtime start/stop, profile switch, test-all progress, service checks, logs, diagnostics, and pairing status.

### Security

- Remote commands require token auth (except `/status` and `/pair`).
- Tokens are stored hashed on desktop.
- Unpaired devices immediately lose access.
