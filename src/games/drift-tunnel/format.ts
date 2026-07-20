export function formatRunTime(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const wholeSeconds = Math.floor(safe % 60)
  const millis = Math.floor((safe - Math.floor(safe)) * 1000)
  if (minutes > 0) {
    return `${minutes}:${String(wholeSeconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
  }
  return `${wholeSeconds}.${String(millis).padStart(3, '0')}s`
}

export function formatScore(score: number): string {
  return Math.floor(score).toLocaleString()
}
