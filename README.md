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
