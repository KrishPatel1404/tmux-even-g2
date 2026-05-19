# tmux-G2 Mirror — Design Spec

**Date:** 2026-05-20  
**Status:** Approved

---

## Overview

Two-component system: a tmux launcher script that sets up the dev environment, and an EvenHub plugin (TypeScript) that polls a local HTTP bridge and mirrors terminal output to Even Realities G2 glasses in real-time.

**Goal:** Run `./scripts/launch.sh`, scan QR on phone, see the work terminal on G2 lens.

---

## Architecture

```
launch.sh
  ├── tmux window 0 "server"
  │     ├── pane 0: dev.sh (Vite on :5173 — serves plugin to phone)
  │     └── pane 1: bridge.js (HTTP on :5174 — serves tmux pane content)
  └── tmux window 1 "work"  [locked 50×10]
        └── interactive shell (what gets mirrored to glasses)

Phone (Even App WebView)
  └── EvenHub plugin (loaded from Vite :5173)
        ├── polls http://<LAN_IP>:5174/ every 250ms
        └── renders 50×10 text grid to G2 via SDK TextContainer
```

---

## Component 1 — `scripts/launch.sh`

Single bash file. No new dependencies — uses system tmux and existing project node.

**Behaviour:**
- Checks `tmux` and `node` are on PATH; prints `brew install tmux` hint and exits if not
- Idempotent: if session `g2` already exists, runs `exec tmux attach -t g2:work`
- Creates tmux session `g2`, detached
- Window 0 `server`: split two panes
  - Top pane: `bash scripts/dev.sh` (Vite + QR)
  - Bottom pane (5 rows): `node scripts/bridge.js`
- Window 1 `work`: fresh interactive shell
  - `tmux set-window-option -t g2:work window-size manual`
  - `tmux resize-window -t g2:work -x 50 -y 10`
- Attaches user to `work` window via `exec tmux attach-session -t g2:work`

**Session layout:**

```
g2 (session)
├── [0] server
│     ├── [top] Vite logs + QR URL
│     └── [bot] Bridge logs "→ Bridge :5174"
└── [1] work          ← user lands here, 50×10 locked
```

**Size lock mechanism:**  
`window-size manual` + `resize-window -x 50 -y 10` pins the window regardless of attaching terminal size. Larger terminals show dead space around the 50×10 pane — expected, mirrors exact glasses viewport.

---

## Component 2 — `scripts/bridge.js`

Node.js HTTP server. Uses built-in `http` and `child_process` modules — zero additional npm installs.

**Port:** 5174  
**Route:** `GET /` — any path, same response

**On request:**
1. Runs `tmux capture-pane -t g2:work -p` via `execSync` (1s timeout)
2. Returns plain text with `Content-Type: text/plain; charset=utf-8`
3. Sets `Access-Control-Allow-Origin: *` so phone WebView can fetch cross-origin
4. On error (tmux not running, pane gone): returns empty string with 200

`capture-pane -p` returns the visible pane content as plain text — no ANSI escape codes. Since the pane is locked 50×10, captured output is already the correct dimensions.

---

## Component 3 — `src/main.ts` (rewrite)

Replaces demo content. Keeps all existing patterns: bridge init with 6s timeout, `onLaunchSource`, `onDeviceStatusChanged`, `onEvenHubEvent`, `cleanup()`.

**Constants:**
```
CONTAINER_ID   = 1
CONTAINER_NAME = 'terminal'   // 8 chars — under 14-char firmware limit
BRIDGE_PORT    = 5174
POLL_MS        = 250
COLS           = 50
ROWS           = 10
```

**`showMain()`:**  
Calls existing `renderPage()` from `renderer.ts`. Full-canvas TextContainer (576×288, no border, no padding, `isEventCapture: 1`), initial content `"Connecting..."`.

**`startPolling()`:**  
```
bridgeUrl = `http://${window.location.hostname}:${BRIDGE_PORT}/`
setInterval(250ms):
  fetch(bridgeUrl, { cache: 'no-store' })
  → text → formatTerminal(raw)
  → updateText(bridge, CONTAINER_ID, CONTAINER_NAME, formatted)
  on fetch error → updateText with "Bridge offline\nRun launch.sh"
```

`updateText()` is already enqueued by `renderer.ts` — no concurrent SDK writes possible.

**`formatTerminal(raw: string): string`:**
```
lines = raw.split('\n')
rows  = lines.slice(-ROWS)           // last 10 lines
pad to ROWS with '' if fewer
map: line.slice(0, COLS).padEnd(COLS)
return rows.join('\n')
```

Total content ≤ 510 chars — well within `textContainerUpgrade` 2000-char limit.

**Event handling (simplified from demo):**
- `EVT_FOREGROUND` (4): restart poll interval via `startPolling()`
- `EVT_BACKGROUND` (5): clear poll interval
- `EVT_ABNORMAL` (6) / `EVT_SYSTEM_EXIT` (7): call `cleanup()` (stop poll interval, `resetRenderer()`)
- Touchpad input (0–3): no action in v1 (reserved for future scroll/page features)

**Polling stop/start on foreground lifecycle:**  
Poll interval ID stored in a module-level ref. `EVT_BACKGROUND` (5) clears it; `EVT_FOREGROUND` (4) restarts `startPolling()`. Both constants already defined in `constants.ts`.

---

## Component 4 — `app.json`

Add network permission for LAN bridge access:

```json
"permissions": [
  {
    "name": "network",
    "desc": "Fetch tmux terminal output from local LAN bridge server"
  }
]
```

No domain whitelist required for development sideload — omit for now, add before App Store submission.

---

## Data Flow (happy path)

1. User runs `./scripts/launch.sh`
2. Vite starts on `:5173`, QR printed in server pane
3. Bridge starts on `:5174`
4. User scans QR on phone → Even App loads plugin from `http://<LAN_IP>:5173`
5. Plugin initialises bridge, calls `createStartUpPageContainer`
6. `startPolling()` fires every 250ms:
   - `fetch http://<LAN_IP>:5174/`
   - Bridge runs `tmux capture-pane -t g2:work -p`
   - Returns 50×10 plain text
   - `formatTerminal` normalises, `updateText` pushes to glasses
7. User types in `work` window → glasses update within ~250ms

---

## Error States

| Condition | Glasses display |
|---|---|
| Bridge not started | "Bridge offline\nRun launch.sh" |
| tmux session gone | "Bridge offline\nRun launch.sh" |
| SDK init timeout (>6s) | existing error handling in init() |
| `createStartUpPageContainer` fails | console.error, phone page shows error |

---

## Files Changed

| File | Action |
|---|---|
| `scripts/launch.sh` | NEW |
| `scripts/bridge.js` | NEW |
| `src/main.ts` | REWRITE (keep structure, replace demo content) |
| `app.json` | MODIFY — add network permission |

**Unchanged:** `src/renderer.ts`, `src/constants.ts`, `scripts/dev.sh`, `scripts/sim.sh`

---

## Constraints Satisfied

- Container name `'terminal'` = 8 chars ✓ (firmware max 14)
- `isEventCapture: 1` on exactly one container ✓
- No concurrent `textContainerUpgrade` calls — `renderer.ts` queue ✓
- Heartbeat not needed (no image streaming, text-only) ✓
- `window.location.hostname` derives LAN IP without hardcoding ✓
- No new npm packages ✓
