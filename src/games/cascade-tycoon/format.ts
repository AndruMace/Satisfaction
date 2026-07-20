/** Format large numbers with K / M / B / T suffixes. */
export function formatMoney(value: number, digits = 1): string {
  const n = Math.max(0, value)
  if (!Number.isFinite(n)) return '∞'
  if (n < 1000) return Math.floor(n).toString()

  const units = [
    { v: 1e12, s: 'T' },
    { v: 1e9, s: 'B' },
    { v: 1e6, s: 'M' },
    { v: 1e3, s: 'K' },
  ] as const

  for (const u of units) {
    if (n >= u.v) {
      const scaled = n / u.v
      const fixed =
        scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(digits)
      return `${trimZeros(fixed)}${u.s}`
    }
  }
  return Math.floor(n).toString()
}

function trimZeros(s: string): string {
  return s.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

export function formatMult(m: number): string {
  if (m >= 10) return `${m}×`
  return `${m}×`
}
