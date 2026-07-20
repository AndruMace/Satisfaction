import { useEffect } from 'react'
import type { GameViewProps } from '../../shared/module'
import { CascadeCanvas } from './CascadeCanvas'
import { useCascade } from './CascadeSession'
import { formatMoney } from './format'

export function CascadeGameView({ shell }: GameViewProps) {
  const cascade = useCascade()

  // Idle tycoon — keep shell out of "tap Launch" overlay
  useEffect(() => {
    shell.setPhase('racing')
    return () => shell.setPhase('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount only
  }, [])

  const snap = cascade.snap
  const lastPayout = snap?.lastPayout ?? 0

  return (
    <div className="cascade-layout">
      <div className="cascade-viewport">
        <CascadeCanvas
          worldRef={cascade.worldRef}
          running={cascade.running}
          onTreasury={cascade.setTreasury}
          onSnapshot={cascade.setSnap}
        />
      </div>

      <aside className="cascade-dash" aria-label="Treasury dashboard">
        <div className="cascade-dash__treasury">
          <span className="cascade-dash__label">Treasury</span>
          <strong className="cascade-dash__balance">
            ${formatMoney(cascade.treasury)}
          </strong>
          {lastPayout > 0 && (
            <span className="cascade-dash__payout">
              +${formatMoney(lastPayout)}
            </span>
          )}
        </div>

        <div className="cascade-dash__upgrades" role="list">
          {cascade.upgradeDefs.map((def) => {
            const level = snap?.upgrades[def.id] ?? 0
            const maxed = level >= def.maxLevel
            const cost = cascade.costOf(def.id)
            const affordable = cascade.canBuy(def.id)
            return (
              <button
                key={def.id}
                type="button"
                role="listitem"
                className={`cascade-upgrade ${affordable ? 'cascade-upgrade--ready' : ''}`}
                disabled={maxed || !affordable}
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
