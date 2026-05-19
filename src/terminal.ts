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
