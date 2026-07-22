import { useState } from 'react'
import { formatDailyShare, type DailyRecord } from './daily'

type DailyShareButtonProps = {
  record: DailyRecord
  className?: string
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    if (!copied) throw new Error('Copy failed')
  }
}

export function DailyShareButton({ record, className = 'btn' }: DailyShareButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const hasResult = record.clears.length > 0

  return (
    <span className="fwd-daily-share">
      <button
        type="button"
        className={className}
        disabled={!hasResult}
        onClick={async () => {
          const url = `${window.location.origin}/fwd`
          try {
            await copyText(formatDailyShare(record, url))
            setStatus('copied')
          } catch {
            setStatus('error')
          }
        }}
      >
        {status === 'copied' ? 'Copied!' : 'Copy Result'}
      </button>
      <span className="fwd-daily-share__status" aria-live="polite">
        {status === 'error' ? 'Could not copy' : ''}
      </span>
    </span>
  )
}
