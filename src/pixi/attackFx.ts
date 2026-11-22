import { Graphics, type Application, type Ticker } from 'pixi.js'

export interface AttackCue {
  /** Stable for the duration of one declared attack; not tied to mouse renders. */
  key: object
  attackerId: string
  targetId: string
  duration: number
}

/**
 * Decorative attack afterimage. The real card keeps its existing CSS motion
 * and remains the only interactive object.
 */
export function spawnAttackTrail(
  app: Application,
  source: { x: number; y: number },
  target: { x: number; y: number },
  duration: number,
  onEnd: (stop: () => void) => void,
): () => void {
  const graphic = new Graphics()
  app.stage.addChild(graphic)
  let elapsed = 0
  let stopped = false
  const dx = target.x - source.x
  const dy = target.y - source.y
  const distance = Math.hypot(dx, dy)
  // Preserve the existing board composition: no full-sized card is relocated.
  const travel = Math.min(distance * 0.78, 230)
  const ux = distance > 0 ? dx / distance : 0
  const uy = distance > 0 ? dy / distance : -1
  const endX = source.x + ux * travel
  const endY = source.y + uy * travel
  const length = Math.max(240, Math.min(800, duration))

  const tick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS
    const t = Math.min(1, elapsed / length)
    const step = t < 0.55 ? (t / 0.55) ** 2 : 1 - (t - 0.55) / 0.45
    const centerX = source.x + (endX - source.x) * step
    const centerY = source.y + (endY - source.y) * step
    const alpha = Math.min(1, t * 10) * (1 - t) * 0.84
    graphic.clear()
    // A directional motion ribbon and short card-shaped afterimage.
    for (let i = 0; i < 4; i += 1) {
      const tail = (i + 1) * 14
      const bx = centerX - ux * tail
      const by = centerY - uy * tail
      graphic.moveTo(bx - uy * (8 - i), by + ux * (8 - i))
        .lineTo(centerX - uy * 5, centerY + ux * 5)
        .stroke({ color: i % 2 ? 0xffffff : 0xffcf72, width: 5 - i, alpha: alpha * (1 - i * 0.18) })
    }
    const angle = Math.atan2(dy, dx) + Math.PI / 2
    const size = 0.7 + Math.sin(Math.PI * t) * 0.3
    const w = 43 * size
    const h = 64 * size
    const points = [
      [-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2],
    ]
    points.forEach(([px, py], index) => {
      const rx = centerX + Math.cos(angle) * px - Math.sin(angle) * py
      const ry = centerY + Math.sin(angle) * px + Math.cos(angle) * py
      if (!index) graphic.moveTo(rx, ry)
      else graphic.lineTo(rx, ry)
    })
    graphic.closePath()
      .fill({ color: 0xffdb89, alpha: alpha * 0.16 })
      .stroke({ color: 0xffe5b4, alpha, width: 2.6 })
    graphic.circle(centerX, centerY, 6 + 9 * Math.sin(Math.PI * t))
      .fill({ color: 0xffffff, alpha: alpha * 0.55 })
    if (t >= 1) stop()
  }
  const stop = () => {
    if (stopped) return
    stopped = true
    app.ticker.remove(tick)
    graphic.destroy()
    onEnd(stop)
  }
  app.ticker.add(tick)
  app.ticker.start()
  return stop
}
