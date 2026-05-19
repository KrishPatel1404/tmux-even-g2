import {
  waitForEvenAppBridge,
  TextContainerProperty,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import { renderPage, updateText, resetRenderer } from './renderer'
import * as C from './constants'

let bridge: EvenAppBridge | null = null
let activeEvt: 'click' | 'dbl' | 'up' | 'down' | null = null
let resetTimer: ReturnType<typeof setTimeout> | null = null
let lastScroll = 0

// ── display ──────────────────────────────────────────────────────────────────

function buildContent(active: typeof activeEvt): string {
  const click = active === 'click' ? '●' : '○'
  const dbl   = active === 'dbl'   ? '●' : '○'
  const up    = active === 'up'    ? '▲' : '─'
  const down  = active === 'down'  ? '▼' : '─'

  return [
    '',
    '',
    '                   Hello World',
    '',
    '',
    '',
    `   [${click}] Tap   [${dbl}] Double   [${up}] Up   [${down}] Down`,
  ].join('\n')
}

const CONTAINER_ID   = 1
const CONTAINER_NAME = 'main'

async function showMain(): Promise<void> {
  await renderPage(bridge!, {
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID:    CONTAINER_ID,
        containerName:  CONTAINER_NAME,
        content:        buildContent(activeEvt),
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

async function refresh(): Promise<void> {
  await updateText(bridge!, CONTAINER_ID, CONTAINER_NAME, buildContent(activeEvt))
}

// ── input ─────────────────────────────────────────────────────────────────────

function setActive(evt: typeof activeEvt): void {
  activeEvt = evt
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => { activeEvt = null; refresh() }, C.ICON_RESET_MS)
  refresh()
}

function handleEvent(event: EvenHubEvent): void {
  const raw  = event.listEvent?.eventType ?? event.textEvent?.eventType ?? event.sysEvent?.eventType
  const type = raw ?? 0

  switch (type) {
    case C.EVT_CLICK:
      setActive('click')
      break

    case C.EVT_DOUBLE:
      setActive('dbl')
      // shutDownPageContainer(1) re-enable here when ready to ship exit UX
      break

    case C.EVT_SCROLL_UP: {
      const now = Date.now()
      if (now - lastScroll < C.SCROLL_THROTTLE) break
      lastScroll = now
      setActive('up')
      break
    }

    case C.EVT_SCROLL_DOWN: {
      const now = Date.now()
      if (now - lastScroll < C.SCROLL_THROTTLE) break
      lastScroll = now
      setActive('down')
      break
    }

    case C.EVT_FOREGROUND:
      refresh()
      break

    case C.EVT_ABNORMAL:
    case C.EVT_SYSTEM_EXIT:
      cleanup()
      break
  }
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

function cleanup(): void {
  if (resetTimer) { clearTimeout(resetTimer); resetTimer = null }
  resetRenderer()
}

async function init(): Promise<void> {
  bridge = await Promise.race([
    waitForEvenAppBridge(),
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('Bridge timeout after 6s')), C.BRIDGE_TIMEOUT_MS)
    ),
  ])

  bridge.onLaunchSource((source) => {
    console.log('[tmux-g2] launched from:', source)
  })

  bridge.onDeviceStatusChanged((status) => {
    console.log('[tmux-g2] device status:', status.connectType)
    if (status.connectType === 'connected') refresh()
  })

  bridge.onEvenHubEvent(handleEvent)

  await showMain()

  document.getElementById('app')!.innerHTML =
    '<h1>tmux-g2</h1><p>Connected — check your glasses.</p>'
}

init().catch((err: Error) => {
  console.error('[tmux-g2] init failed:', err)
  document.getElementById('app')!.innerHTML =
    `<h1>tmux-g2</h1><p style="color:#FF453A">Error: ${err.message}</p>`
})
