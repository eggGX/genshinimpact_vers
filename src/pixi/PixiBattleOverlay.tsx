import { useEffect, useRef } from 'react'
import { Application, Graphics, type Ticker } from 'pixi.js'

/**
 * Optional, non-interactive PixiJS overlay.
 * Reads the DOM positions of existing damage highlights; never changes game state.
 */
export function PixiBattleOverlay({ cue }: { cue: object | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const activeEffects = useRef<Array<() => void>>([])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const app = new Application()
    let cancelled = false
    let ready = false

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
          app.destroy({ removeView: true }, { children: true })
          return
        }
        app.canvas.style.display = 'block'
        app.canvas.style.pointerEvents = 'none'
        container.appendChild(app.canvas)
        appRef.current = app
        app.ticker.stop()
      } catch (error) {
        if (!cancelled) console.warn('PixiJS overlay could not initialize:', error)
      }
    })()

    return () => {
      cancelled = true
      activeEffects.current.forEach(stop => stop())
      activeEffects.current = []
      appRef.current = null
      if (ready) app.destroy({ removeView: true }, { children: true })
    }
  }, [])

  useEffect(() => {
    if (!cue) return
    const request = window.requestAnimationFrame(() => {
      const app = appRef.current
      const host = containerRef.current
      if (!app || !host) return

      // Use the existing React/CSS damage cues to avoid modifying battle rules.
      const battle = host.parentElement
      if (!battle) return
      const targets = battle.querySelectorAll<HTMLElement>(
        '.follower-wrapper.battle-damaged, .follower-wrapper.battle-hit, .leader.leader-damaged, .leader.leader-hit',
      )
      const bounds = host.getBoundingClientRect()
      let count = 0
      targets.forEach(target => {
        if (count++ >= 8) return
        const rect = target.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return
        const x = rect.left + rect.width / 2 - bounds.left
        const y = rect.top + rect.height / 2 - bounds.top
        const ring = new Graphics()
        app.stage.addChild(ring)
        let elapsed = 0
        const maxRadius = Math.max(42, Math.min(125, rect.width * 0.75))
        let stopped = false
        const stop = () => {
          if (stopped) return
          stopped = true
          app.ticker.remove(tick)
          ring.destroy()
          activeEffects.current = activeEffects.current.filter(item => item !== stop)
          if (!activeEffects.current.length) app.ticker.stop()
        }
        const tick = (ticker: Ticker) => {
          elapsed += ticker.deltaMS
          const progress = Math.min(1, elapsed / 600)
          ring.clear()
          ring.circle(x, y, 12 + progress * maxRadius)
            .stroke({ color: 0xffd68a, width: 5 * (1 - progress) + 0.5, alpha: 0.8 * (1 - progress) })
          ring.circle(x, y, 8 + progress * maxRadius * 0.58)
            .stroke({ color: 0xffffff, width: 2, alpha: 0.55 * (1 - progress) })
          if (progress >= 1) stop()
        }
        activeEffects.current.push(stop)
        app.ticker.add(tick)
        app.ticker.start()
      })
    })
    return () => window.cancelAnimationFrame(request)
  }, [cue])

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
