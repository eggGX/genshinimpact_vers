import { useEffect, useRef } from 'react'
import { Application, Graphics, type Ticker } from 'pixi.js'

/**
 * HUD-only Pixi decoration for existing CSS draw flights and mulligan swaps.
 * The DOM still owns card artwork, flipping, travel, input and privacy.
 * This component never accesses a hidden opponent card ID.
 */
export function PixiCardFlowOverlay({
  drawActive,
  mulliganActive,
}: {
  drawActive: boolean
  mulliganActive: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!drawActive && !mulliganActive) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const host = hostRef.current
    if (!host) return
    const app = new Application()
    let disposed = false
    let initialized = false
    let tick: ((ticker: Ticker) => void) | null = null

    void (async () => {
      try {
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          resizeTo: host,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        })
        initialized = true
        if (disposed) {
          app.destroy({ removeView: true }, { children: true })
          return
        }
        app.canvas.style.pointerEvents = 'none'
        host.appendChild(app.canvas)
        const graphics = new Graphics()
        app.stage.addChild(graphics)
        const began = performance.now()
        const paths = new WeakMap<Element, { x: number; y: number }>()
        tick = (_ticker: Ticker) => {
          const elapsed = performance.now() - began
          graphics.clear()
          if (drawActive) {
            const flights = document.querySelectorAll<HTMLElement>(
              '.battle-draw-layer .battle-draw-flight',
            )
            flights.forEach((flight, index) => {
              const style = window.getComputedStyle(flight)
              if (Number(style.opacity) < 0.04) return
              const rect = flight.getBoundingClientRect()
              if (!rect.width || !rect.height) return
              const x = rect.left + rect.width / 2
              const y = rect.top + rect.height / 2
              const last = paths.get(flight)
              const intensity = 0.45 + 0.25 * Math.sin(elapsed / 150 + index)
              // Only short-lived streaks: do not draw a line across the board.
              if (last && Math.hypot(x - last.x, y - last.y) < 65) {
                graphics.moveTo(last.x, last.y).lineTo(x, y)
                  .stroke({ color: 0xffe4a1, width: 3, alpha: intensity })
              }
              for (let i = 0; i < 4; i++) {
                const angle = elapsed * 0.005 + i * Math.PI / 2 + index
                graphics.circle(
                  x + Math.cos(angle) * (28 + 4 * Math.sin(elapsed / 190)),
                  y + Math.sin(angle) * 34,
                  1.5 + (i % 2),
                ).fill({ color: i % 2 ? 0xffdf95 : 0xc6efff, alpha: intensity })
              }
              paths.set(flight, { x, y })
            })
          }
          if (mulliganActive && elapsed < 1500) {
            const arrivals = document.querySelectorAll<HTMLElement>(
              '.mulligan-result-cards .mulligan-swap--in',
            )
            const time = (elapsed - 580) / 650
            if (time >= 0 && time < 1) {
              arrivals.forEach(card => {
                const rect = card.closest<HTMLElement>('.mulligan-swap-slot')?.getBoundingClientRect()
                if (!rect || !rect.width || !rect.height) return
                const x = rect.left + rect.width / 2
                const y = rect.top + rect.height / 2
                const fade = (1 - time) * Math.min(1, time * 5)
                graphics.ellipse(x, y, rect.width * (0.25 + time * 0.5), 19 + time * 27)
                  .stroke({ color: 0xffd99a, alpha: fade * 0.75, width: 3 - time * 2 })
                for (let i = 0; i < 8; i++) {
                  const angle = i * Math.PI / 4 + elapsed * 0.001
                  graphics.circle(
                    x + Math.cos(angle) * rect.width * (0.4 - time * 0.18),
                    y + Math.sin(angle) * rect.height * (0.32 - time * 0.17),
                    2,
                  ).fill({ color: i % 2 ? 0xffffff : 0xffd99a, alpha: fade })
                }
              })
            }
          }
          if (!drawActive && (!mulliganActive || elapsed >= 1500)) app.ticker.stop()
        }
        app.ticker.add(tick)
      } catch (error) {
        if (!disposed) console.warn('Pixi card-flow overlay could not initialize:', error)
      }
    })()
    return () => {
      disposed = true
      if (initialized) {
        if (tick) app.ticker.remove(tick)
        app.destroy({ removeView: true }, { children: true })
      }
    }
  }, [drawActive, mulliganActive])

  return <div
    className="pixi-card-flow-overlay"
    ref={hostRef}
    aria-hidden="true"
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2200,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}
  />
}
