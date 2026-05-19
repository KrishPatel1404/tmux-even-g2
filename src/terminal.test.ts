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
    expect(rows[9].trimEnd()).toBe('only one line')
  })

  it('handles empty string input', () => {
    const result = formatTerminal('')
    const rows = result.split('\n')
    expect(rows).toHaveLength(10)
    expect(rows.every(r => r === ' '.repeat(50))).toBe(true)
  })
})
