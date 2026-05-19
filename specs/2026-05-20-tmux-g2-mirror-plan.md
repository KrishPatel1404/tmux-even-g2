# tmux-G2 Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a no-install tmux launcher (`scripts/launch.sh`) and an EvenHub plugin that polls a local HTTP bridge to mirror terminal output to Even Realities G2 glasses in real-time.

**Architecture:** `launch.sh` creates a tmux session with two windows — `server` (Vite dev server + HTTP bridge) and `work` (interactive shell locked to 50×10 matching G2's text grid). The EvenHub plugin (TypeScript, runs in phone WebView) polls the bridge at `http://<LAN-IP>:5174/` every 250ms, formats the output into a 50-col × 10-row grid, and pushes it to G2 via `textContainerUpgrade`.

**Tech Stack:** Bash, tmux, Node.js built-in modules (`http`, `child_process`), TypeScript, `@evenrealities/even_hub_sdk`, Vitest for unit tests.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/terminal.ts` | **CREATE** | Pure `formatTerminal(raw)` function — no SDK deps, fully testable |
| `src/terminal.test.ts` | **CREATE** | Vitest unit tests for `formatTerminal` |
| `src/main.ts` | **REWRITE** | Bridge lifecycle, polling loop, event handlers — imports from `terminal.ts` |
| `scripts/bridge.js` | **CREATE** | Node.js HTTP server; runs `tmux capture-pane` on each request |
| `scripts/launch.sh` | **CREATE** | Tmux session launcher; idempotent attach if session exists |
| `app.json` | **MODIFY** | Add `network` permission for LAN bridge fetch |
| `vitest.config.ts` | **CREATE** | Vitest config (node environment, no browser) |
| `package.json` | **MODIFY** | Add `"test": "vitest"` script + `vitest` devDependency |

**Unchanged:** `src/renderer.ts`, `src/constants.ts`, `vite.config.ts`, `scripts/dev.sh`, `scripts/sim.sh`

---

## Task 1: Install Vitest and configure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

Expected: `vitest` appears in `package.json` devDependencies.

- [ ] **Step 2: Add test script to `package.json`**

In `package.json`, add `"test": "vitest"` to the `scripts` block:

```json
{
  "name": "tmux-g2",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bash scripts/dev.sh",
    "sim": "bash scripts/sim.sh",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "pack": "npm run build && npx evenhub pack app.json dist -o tmux-g2.ehpk",
    "qr": "npx evenhub qr --url http://$(ipconfig getifaddr en0):5173",
    "test": "vitest"
  }
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Verify Vitest runs (no tests yet)**

```bash
npm test -- --run
```

Expected output: `No test files found` or similar — no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json vitest.config.ts
git commit -m "chore: add vitest for unit testing"
```

---

## Task 2: Create `src/terminal.ts` via TDD

**Files:**
- Create: `src/terminal.test.ts`
- Create: `src/terminal.ts`

- [ ] **Step 1: Write failing tests in `src/terminal.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { formatTerminal } from './terminal'

describe('formatTerminal', () => {
  it('returns exactly 10 rows', () => {
    const result = formatTerminal('line1\nline2')
    expect(result.split('\n')).toHaveLength(10)
  })

  it('pads every line to exactly 50 chars', () => {
    const result = formatTerminal('hello')
    const lines = result.split('\n')
    expect(lines.every(l => l.length === 50)).toBe(true)
  })

  it('truncates lines longer than 50 chars', () => {
    const longLine = 'x'.repeat(100)
    const result = formatTerminal(longLine)
    const lines = result.split('\n')
    expect(lines.every(l => l.length === 50)).toBe(true)
  })

  it('takes the last 10 lines when input has more than 10', () => {
    const input = Array.from({ length: 15 }, (_, i) => `line${i + 1}`).join('\n')
    const result = formatTerminal(input)
    const rows = result.split('\n')
    expect(rows[9].trimEnd()).toBe('line15')
  })

  it('pads with empty lines at the top when input has fewer than 10 lines', () => {
    const result = formatTerminal('only one line')
    const rows = result.split('\n')
    expect(rows).toHaveLength(10)
    expect(rows[0].trim()).toBe('')
    expect(rows[9].trimEnd()).toBe('only one line'.padEnd(50).trimEnd())
  })

  it('handles empty string input', () => {
    const result = formatTerminal('')
    const rows = result.split('\n')
    expect(rows).toHaveLength(10)
    expect(rows.every(r => r === ' '.repeat(50))).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npm test -- --run
```

Expected: `Cannot find module './terminal'` or similar import error.

- [ ] **Step 3: Implement `src/terminal.ts`**

```typescript
const COLS = 50
const ROWS = 10

export function formatTerminal(raw: string): string {
  const lines = raw.split('\n')
  const rows = lines.slice(-ROWS)
  while (rows.length < ROWS) rows.unshift('')
  return rows
    .map(line => line.slice(0, COLS).padEnd(COLS))
    .join('\n')
}
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
npm test -- --run
```

Expected: `6 tests passed`.

- [ ] **Step 5: Commit**

```bash
git add src/terminal.ts src/terminal.test.ts
git commit -m "feat: add formatTerminal utility with tests"
```

---

## Task 3: Rewrite `src/main.ts`

**Files:**
- Modify: `src/main.ts` (full rewrite — delete all content, write from scratch)

This replaces the demo (hello world + input indicators) with the tmux polling loop. `src/renderer.ts` and `src/constants.ts` are unchanged — they're used as-is.

- [ ] **Step 1: Replace `src/main.ts` with the polling implementation**

```typescript
import {
  waitForEvenAppBridge,
  TextContainerProperty,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import { renderPage, updateText, resetRenderer } from './renderer'
import { formatTerminal } from './terminal'
import * as C from './constants'

const CONTAINER_ID   = 1
const CONTAINER_NAME = 'terminal'   // 8 chars — under 14-char firmware limit
const BRIDGE_PORT    = 5174
const POLL_MS        = 250

let bridge: EvenAppBridge | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null
let bridgeUrl = ''

// ── display ───────────────────────────────────────────────────────────────────

async function showMain(): Promise<void> {
  await renderPage(bridge!, {
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID:    CONTAINER_ID,
        containerName:  CONTAINER_NAME,
        content:        'Connecting...',
        xPosition:      0,
        yPosition:      0,
        width:          576,
        height:         288,
        isEventCapture: 1,
        paddingLength:  0,
      }),
    ],
  })
}

// ── polling ───────────────────────────────────────────────────────────────────

function stopPolling(): void {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
}

function startPolling(): void {
  stopPolling()
  pollInterval = setInterval(async () => {
    try {
      const res = await fetch(bridgeUrl, { cache: 'no-store' })
      const raw = await res.text()
      await updateText(bridge!, CONTAINER_ID, CONTAINER_NAME, formatTerminal(raw))
    } catch {
      await updateText(bridge!, CONTAINER_ID, CONTAINER_NAME, 'Bridge offline\nRun launch.sh')
    }
  }, POLL_MS)
}

// ── input ─────────────────────────────────────────────────────────────────────

function handleEvent(event: EvenHubEvent): void {
  const raw  = event.listEvent?.eventType ?? event.textEvent?.eventType ?? event.sysEvent?.eventType
  const type = raw ?? 0

  switch (type) {
    case C.EVT_FOREGROUND:
      startPolling()
      break
    case C.EVT_BACKGROUND:
      stopPolling()
      break
    case C.EVT_ABNORMAL:
    case C.EVT_SYSTEM_EXIT:
      cleanup()
      break
  }
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

function cleanup(): void {
  stopPolling()
  resetRenderer()
}

async function init(): Promise<void> {
  bridge = await Promise.race([
    waitForEvenAppBridge(),
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('Bridge timeout after 6s')), C.BRIDGE_TIMEOUT_MS)
    ),
  ])

  bridgeUrl = `http://${window.location.hostname}:${BRIDGE_PORT}/`

  bridge.onLaunchSource((source) => {
    console.log('[tmux-g2] launched from:', source)
  })

  bridge.onDeviceStatusChanged((status) => {
    console.log('[tmux-g2] device status:', status.connectType)
  })

  bridge.onEvenHubEvent(handleEvent)

  await showMain()
  startPolling()

  document.getElementById('app')!.innerHTML =
    '<h1>tmux-g2</h1><p>Connected — check your glasses.</p>'
}

init().catch((err: Error) => {
  console.error('[tmux-g2] init failed:', err)
  document.getElementById('app')!.innerHTML =
    `<h1>tmux-g2</h1><p style="color:#FF453A">Error: ${err.message}</p>`
})
```

- [ ] **Step 2: Type-check**

```bash
npm run build 2>&1 | head -30
```

Expected: build succeeds (no TypeScript errors). If errors appear, fix before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: replace demo with tmux terminal polling"
```

---

## Task 4: Create `scripts/bridge.js`

**Files:**
- Create: `scripts/bridge.js`

This is a standalone Node.js ESM script. Uses only built-in modules — no npm installs.

- [ ] **Step 1: Create `scripts/bridge.js`**

```javascript
import http from 'http'
import { execSync } from 'child_process'

const PORT = 5174
const PANE = 'g2:work'

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  try {
    const out = execSync(`tmux capture-pane -t ${PANE} -p`, { timeout: 1000 }).toString()
    res.end(out)
  } catch {
    res.end('')
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`→ Bridge :${PORT}`)
})
```

- [ ] **Step 2: Manual smoke test (requires an active tmux session)**

Open a separate terminal and create a quick test session:

```bash
tmux new-session -d -s g2 -n work
tmux send-keys -t g2:work "echo 'hello bridge'" Enter
node scripts/bridge.js &
curl http://localhost:5174/
```

Expected: curl returns the tmux pane content (should include `hello bridge`).

Kill the bridge and test session when done:

```bash
kill %1
tmux kill-session -t g2
```

- [ ] **Step 3: Commit**

```bash
git add scripts/bridge.js
git commit -m "feat: add HTTP bridge server for tmux pane capture"
```

---

## Task 5: Create `scripts/launch.sh` and update `app.json`

**Files:**
- Create: `scripts/launch.sh`
- Modify: `app.json`

- [ ] **Step 1: Create `scripts/launch.sh`**

```bash
#!/bin/bash
set -e

SESSION="g2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Dependency checks
if ! command -v tmux &>/dev/null; then
  echo "✗ tmux not found — install: brew install tmux"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "✗ node not found — install from nodejs.org"
  exit 1
fi

# Idempotent: attach if session already exists
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "→ Session '$SESSION' exists — attaching to work window"
  exec tmux attach-session -t "${SESSION}:work"
fi

echo "→ Creating tmux session '$SESSION'..."

# Create detached session — window 0 = server
tmux new-session -d -s "$SESSION" -n server

# Server window: top pane runs Vite, bottom pane (5 rows) runs bridge
tmux send-keys -t "${SESSION}:server" "cd '${PROJECT_DIR}' && bash scripts/dev.sh" Enter
tmux split-window -t "${SESSION}:server" -v -l 5
tmux send-keys -t "${SESSION}:server.1" "cd '${PROJECT_DIR}' && node scripts/bridge.js" Enter

# Work window: interactive shell locked to G2 grid (50 cols × 10 rows)
tmux new-window -t "${SESSION}" -n work
tmux set-window-option -t "${SESSION}:work" window-size manual
tmux resize-window -t "${SESSION}:work" -x 50 -y 10

echo "→ Attaching to work window (50×10 — G2 grid)"
exec tmux attach-session -t "${SESSION}:work"
```

- [ ] **Step 2: Make the script executable**

```bash
chmod +x scripts/launch.sh
```

- [ ] **Step 3: Update `app.json` to add network permission**

Replace the `permissions` field:

```json
{
  "package_id": "com.krishpkreame.tmuxg2",
  "edition": "202601",
  "name": "tmux-even-g2",
  "version": "0.0.1",
  "min_app_version": "2.0.0",
  "min_sdk_version": "0.0.9",
  "tagline": "Mirror your tmux terminal to G2 glasses in real-time",
  "description": "Connects to a remote tmux session and mirrors terminal output to Even Realities G2 smart glasses. Code on your machine, read the terminal on your lens.",
  "author": "Krish Patel",
  "entrypoint": "index.html",
  "permissions": [
    {
      "name": "network",
      "desc": "Fetch tmux terminal output from local LAN bridge server"
    }
  ],
  "supported_languages": ["en"]
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/launch.sh app.json
git commit -m "feat: add tmux launcher script and network permission"
```

---

## Task 6: End-to-end verification

No automated tests for BLE/SDK — manual steps required.

- [ ] **Step 1: Run the launcher**

```bash
./scripts/launch.sh
```

Expected:
- Tmux session `g2` created
- Terminal resizes to 50×10
- You land in the `work` window
- Press `Ctrl+B 0` to switch to `server` window — you should see Vite starting and QR URL printing

- [ ] **Step 2: Verify bridge is running**

From another terminal (or tmux split):

```bash
curl http://localhost:5174/
```

Expected: returns the current content of the `work` pane (should be a shell prompt).

- [ ] **Step 3: Load plugin on phone**

Scan the QR code printed in the `server` window. Even App loads the plugin.

Expected on glasses: `Connecting...` briefly, then the 50×10 terminal content appears.

- [ ] **Step 4: Verify live update**

In the `work` tmux window, run:

```bash
echo "hello glasses"
```

Expected: within 250ms, glasses show the updated terminal content including `hello glasses`.

- [ ] **Step 5: Verify idempotent attach**

Open a new terminal and run:

```bash
./scripts/launch.sh
```

Expected: `→ Session 'g2' exists — attaching to work window`. Attaches without recreating session.

- [ ] **Step 6: Verify bridge-offline error**

Kill the bridge process (switch to `server` window, focus bottom pane, `Ctrl+C`).

Expected: within ~500ms, glasses show:
```
Bridge offline
Run launch.sh
```

- [ ] **Step 7: Final build check**

```bash
npm run build
```

Expected: TypeScript compiles clean, Vite bundle succeeds.

---

## Summary

| Task | Files | Tests |
|---|---|---|
| 1 | `package.json`, `vitest.config.ts` | `npm test` passes |
| 2 | `src/terminal.ts`, `src/terminal.test.ts` | 6 unit tests pass |
| 3 | `src/main.ts` | tsc clean |
| 4 | `scripts/bridge.js` | curl smoke test |
| 5 | `scripts/launch.sh`, `app.json` | manual launch + attach |
| 6 | — | full E2E on device |
