import { Application, Graphics, type Ticker } from 'pixi.js'

/** Decorative summoning light at an already-mounted follower position.
 * No card image, DOM, game rules or input handling are changed.
 */
export function spawnSummonBurst(
  app: Application, x: number, y: number, width: number, height: number,
  onEnd: (stop: () => void) => void,
): () => void {
  const graphics = new Graphics()
  app.stage.addChild(graphics)
  let elapsed = 0
  let stopped = false
  const duration = 640
  const radius = Math.max(35, Math.min(85, width * 0.8))
  const particles = Array.from({ length: 18 }, (_, i) => {
    const a = (i * 2.399963229728653) % (Math.PI * 2)
    return {
      x: Math.cos(a) * (radius * (0.55 + (i % 4) * 0.13)),
      y: Math.sin(a) * (Math.min(height, 120) * (0.28 + (i % 3) * 0.06)),
      size: 1.7 + (i % 3),
    }
  })
  const stop = () => {
    if (stopped) return
    stopped = true
    app.ticker.remove(tick)
    graphics.destroy()
    onEnd(stop)
  }
  const tick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS
    const t = Math.min(1, elapsed / duration)
    graphics.clear()
    const bright = Math.sin(Math.PI * t)
    // A small contracting circle, then a halo surrounding the new card.
    if (t < 0.46) {
      const p = t / 0.46
      graphics.circle(x, y, radius * (1 - p * 0.72))
        .stroke({ color: 0xffd791, width: 3, alpha: p * 0.75 })
    }
    graphics.ellipse(x, y + height * 0.28, radius * (0.5 + 0.55 * t), 10 + 13 * t)
      .stroke({ color: 0xffd99a, width: 2.6 * (1 - t) + 0.5, alpha: bright * 0.8 })
    particles.forEach((particle, index) => {
      const delay = (index % 4) * 0.035
      const p = Math.min(1, Math.max(0, (t - delay) / (1 - delay)))
      if (!p || p >= 1) return
      const px = x + particle.x * (1 - p * 0.67)
      const py = y + particle.y * (1 - p * 0.78) - p * 27
      const alpha = Math.sin(Math.PI * p) * 0.85
      graphics.circle(px, py, particle.size * (1 - p * 0.5))
        .fill({ color: index % 3 === 0 ? 0xffffff : 0xffd99a, alpha })
    })
    if (t >= 1) stop()
  }
  app.ticker.add(tick)
  app.ticker.start()
  return stop
}
