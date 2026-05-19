import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerUpgrade,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'

let renderInFlight = false
let pendingRender: (() => Promise<void>) | null = null
let startupRendered = false

export async function enqueueRender(fn: () => Promise<void>): Promise<void> {
  if (renderInFlight) { pendingRender = fn; return }
  renderInFlight = true
  try {
    await fn()
  } finally {
    renderInFlight = false
    if (pendingRender) {
      const next = pendingRender
      pendingRender = null
      await enqueueRender(next)
    }
  }
}

export async function renderPage(
  bridge: EvenAppBridge,
  config: ConstructorParameters<typeof CreateStartUpPageContainer>[0],
): Promise<void> {
  await enqueueRender(async () => {
    if (!startupRendered) {
      startupRendered = true
      try {
        await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
      } catch (err) {
        startupRendered = false
        throw err
      }
    } else {
      await bridge.rebuildPageContainer(new RebuildPageContainer(config))
    }
  })
}

export async function updateText(
  bridge: EvenAppBridge,
  containerID: number,
  containerName: string,
  content: string,
): Promise<void> {
  await enqueueRender(async () => {
    await bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID,
      containerName,
      contentOffset: 0,
      contentLength: 2000,
      content,
    }))
  })
}

export function resetRenderer(): void {
  startupRendered = false
  renderInFlight = false
  pendingRender = null
}
