# Electron Setup

## Install Electron locally

The `electron` binary is not included in the Figma Make environment because  
it is a ~150 MB platform binary. Install it once in your local checkout:

```bash
pnpm add -D electron electron-builder
# or
npm install -D electron electron-builder
```

## Available scripts

| Script | Description |
|---|---|
| `pnpm electron:dev` | Dev mode — Vite dev server + Electron hot-reload |
| `pnpm electron:pack` | Build renderer + package Electron (unpacked, for testing) |
| `pnpm electron:build` | Full release build with electron-builder |
| `pnpm electron:preview` | Run the already-built `dist-electron/main.js` with Electron |
| `pnpm build` | Web-only Vite build (used by Figma Make preview) |

## DEP0190 fix

`[DEP0190] DeprecationWarning: Passing args to a child process with shell option true`

The warning is eliminated in `electron/main.ts` by **always** spawning proxy
child-processes with `shell: false` (the Node.js default) and passing arguments
as a proper `string[]` array instead of a shell-interpolated string:

```ts
// ❌ BEFORE — triggers DEP0190
spawn(executable, { shell: true })   // args concatenated by shell

// ✅ AFTER — safe, no shell, no injection surface
spawn(executable, buildProxyArgs(config), { shell: false })
```

The `buildProxyArgs()` helper in `electron/main.ts` constructs the array so
every option flag and its value are separate elements, which are passed directly
to the OS `execvp()` syscall without any shell parsing.

## Window architecture

| Window | Route | Size | Frame |
|---|---|---|---|
| Main (Dashboard) | `/` | 1280×800 min 960×640 | Frameless, custom TitleBar |
| Mini Mode | `/#/mini` | 340×430 fixed | Frameless, always-on-top |

## IPC channels

All channels are whitelisted in `electron/preload.ts` via `contextBridge`.
The renderer accesses them through `window.electronAPI` (typed in
`src/types/electron.d.ts`). The helper `src/lib/electron.ts` provides
safe wrappers that are no-ops when running in the web browser preview.
