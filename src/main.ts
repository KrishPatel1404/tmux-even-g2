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
let displayVisible = true

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
  if (event.textEvent) {
    const type = event.textEvent.eventType ?? 0
    if (type === C.EVT_SCROLL_UP || type === C.EVT_SCROLL_DOWN) {
      const endpoint = type === C.EVT_SCROLL_UP ? 'scroll-up' : 'scroll-down'
      void fetch(`${bridgeUrl}${endpoint}`, { cache: 'no-store' })
        .then(r => r.text())
        .then(raw => updateText(bridge!, CONTAINER_ID, CONTAINER_NAME, formatTerminal(raw)))
    }
    return
  }

  const type = event.sysEvent?.eventType ?? 0
  switch (type) {
    case C.EVT_CLICK:
      // single tap → exit copy-mode, resume live tail
      void fetch(`${bridgeUrl}scroll-reset`, { cache: 'no-store' })
      break
    case C.EVT_DOUBLE:
      displayVisible = !displayVisible
      if (displayVisible) {
        startPolling()
      } else {
        stopPolling()
        void updateText(bridge!, CONTAINER_ID, CONTAINER_NAME, Array(10).fill(' '.repeat(50)).join('\n'))
      }
      break
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
