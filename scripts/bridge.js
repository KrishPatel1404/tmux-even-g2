import http from 'http'
import { execSync } from 'child_process'

const PORT = 5174
const PANE = 'g2:work'
const ROWS = 10
const STEP = 2

let scrollOffset = 0  // lines above live bottom; 0 = live tail

function tmux(cmd) {
  execSync(cmd, { timeout: 1000 })
}

function capture() {
  // tmux: 0=visible top, ROWS-1=visible bottom, -1=one line above visible
  const start = -scrollOffset
  const end   = ROWS - 1 - scrollOffset
  return execSync(`tmux capture-pane -t ${PANE} -p -S ${start} -E ${end}`, { timeout: 1000 }).toString()
}

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')

  try {
    if (req.url === '/scroll-up') {
      scrollOffset += STEP
      res.end(capture())
    } else if (req.url === '/scroll-down') {
      scrollOffset = Math.max(0, scrollOffset - STEP)
      res.end(capture())
    } else if (req.url === '/scroll-reset') {
      scrollOffset = 0
      res.end(capture())
    } else {
      res.end(capture())
    }
  } catch {
    res.end('')
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`→ Bridge :${PORT}`)
})
