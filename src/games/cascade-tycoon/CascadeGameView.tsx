import { useEffect } from 'react'
import type { GameViewProps } from '../../shared/module'
import { CascadeCanvas } from './CascadeCanvas'
import { useCascade, useCascadeLaunch } from './CascadeSession'
import { formatMoney } from './format'

export function CascadeGameView({ shell }: GameViewProps) {
  const cascade = useCascade()
  useCascadeLaunch(shell.launchKey)

  const snap = cascade.snap

  useEffect(() => {
    const phase = snap.phase
    if (phase === 'ready') shell.setPhase('idle')
    else if (phase === 'finished') shell.setPhase('finished')
    else shell.setPhase('racing')
  }, [snap.phase, shell.setPhase])

  const lastPayout = snap.lastPayout
  const goalPct = Math.min(100, (snap.treasury / Math.max(1, snap.moneyGoal)) * 100)
  const busy = snap.phase === 'running'

  return (
    <div className="cascade-layout">
      <div className="cascade-viewport">
        <CascadeCanvas
          worldRef={cascade.worldRef}
          running={cascade.running}
          autoRecord={shell.autoRecord}
          onTreasury={cascade.setTreasury}
          onSnapshot={cascade.setSnap}
          onRecordingChange={shell.setIsRecording}
          onRecordingReady={(blob, filename, durationSec) => {
            shell.setPendingClip({ blob, filename, durationSec })
            shell.setRecordingError(null)
          }}
          onRecordingError={(message) => {
            shell.setRecordingError(message)
            shell.setIsRecording(false)
          }}
        />
      </div>

      <aside className="cascade-dash" aria-label="Run dashboard">
        <div className="cascade-dash__row">
          <div className="cascade-dash__treasury">
            <span className="cascade-dash__label">Treasury</span>
            <strong className="cascade-dash__balance">
              ${formatMoney(cascade.treasury)}
            </strong>
            {lastPayout > 0 && snap.phase !== 'ready' && (
              <span className="cascade-dash__payout">
                +${formatMoney(lastPayout)}
              </span>
            )}
          </div>
          <div className="cascade-dash__meta">
            <span>
              <strong>{Math.ceil(snap.timeLeft)}s</strong> left
            </span>
            {snap.combo >= 2 && (
              <span>
                Combo <strong>×{snap.combo}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="cascade-dash__meters">
          <div className="cascade-meter">
            <span>Goal</span>
            <div className="cascade-meter__track">
              <div
                className="cascade-meter__fill"
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <span className="cascade-meter__val">
              ${formatMoney(snap.moneyGoal)}
            </span>
          </div>
        </div>

        <div className="cascade-dash__upgrades" role="list">
          {cascade.upgradeDefs.map((def) => {
            const level = snap.upgrades[def.id] ?? 0
            const maxed = level >= def.maxLevel
            const cost = cascade.costOf(def.id)
            const affordable = cascade.canBuy(def.id)
            return (
              <button
                key={def.id}
                type="button"
                role="listitem"
                className={`cascade-upgrade ${affordable ? 'cascade-upgrade--ready' : ''}`}
                disabled={maxed || !affordable || !busy}
                onClick={() => cascade.purchase(def.id)}
              >
                <span className="cascade-upgrade__name">
                  {def.label}
                  <em>Lv {level}</em>
                </span>
                <span className="cascade-upgrade__hint">{def.hint}</span>
                <span className="cascade-upgrade__cost">
                  {maxed ? 'MAX' : `$${formatMoney(cost)}`}
                </span>
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
