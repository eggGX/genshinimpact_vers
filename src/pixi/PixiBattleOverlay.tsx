import { useEffect, useRef } from 'react'
import { Application } from 'pixi.js'

/**
 * Transparent PixiJS layer above the existing React battle screen.
 * Initially empty: effects will be drawn here in later changes.
 * The canvas never receives pointer or keyboard input.
 */
export function PixiBattleOverlay() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const app = new Application()
    let cancelled = false
    let ready = false
    let destroyed = false

    const destroy = () => {
      if (!ready || destroyed) return
      destroyed = true
      app.destroy({ removeView: true }, { children: true })
    }

    void (async () => {
      try {
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          resizeTo: container,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          preference: 'webgl',
        })
        ready = true
        if (cancelled) {
          destroy()
          return
        }
        app.canvas.style.display = 'block'
        app.canvas.style.pointerEvents = 'none'
        container.appendChild(app.canvas)
        // No ticker-driven effects are enabled until the first animation is added.
        app.ticker.stop()
      } catch (error) {
        if (!cancelled) console.warn('PixiJS overlay could not initialize:', error)
      }
    })()

    return () => {
      cancelled = true
      destroy()
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pixi-battle-overlay"
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 20,
      }}
    />
  )
}
