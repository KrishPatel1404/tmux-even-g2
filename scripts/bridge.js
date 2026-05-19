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
