import { Application, Graphics, type Ticker } from 'pixi.js'

/**
 * Visual-only burst at a destroyed follower's last DOM location.
 * The game already removes the follower from the authoritative board before
 * resolving its Last Word; this changes neither the board nor that ordering.
 */
export function spawnDestructionBurst(
  app: Application,
  x: number,
  y: number,
  width: number,
  height: number,
  durationMs: number,
  onEnd: (stop: () => void) => void,
): () => void {
  const particles = new Graphics()
  app.stage.addChild(particles)
  let elapsed = 0
  let stopped = false
  const duration = Math.max(240, Math.min(840, durationMs))
  const count = 28
  const halfWidth = Math.max(18, width * 0.43)
  const halfHeight = Math.max(24, height * 0.42)

  // Deterministic seeds avoid random movement on every render or replay.
  const seeds = Array.from({ length: count }, (_, index) => {
    const angle = (index * 2.399963229728653) % (Math.PI * 2)
    const column = (index % 7 + 0.5) / 7 - 0.5
    const row = (Math.floor(index / 7) + 0.5) / 4 - 0.5
    return {
      startX: column * halfWidth * 1.75,
      startY: row * halfHeight * 1.75,
      vx: Math.cos(angle) * (22 + (index % 5) * 10),
      vy: -34 - (index % 4) * 14 + Math.sin(angle) * 18,
      radius: 1.7 + (index % 4) * 0.85,
      color: index % 4 === 0 ? 0xffffff : index % 3 === 0 ? 0xffd58a : 0x9be9ff,
    }
  })

  const stop = () => {
    if (stopped) return
    stopped = true
    app.ticker.remove(tick)
    particles.destroy()
    onEnd(stop)
  }
  const tick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS
    const t = Math.min(1, elapsed / duration)
    const fade = Math.pow(1 - t, 1.5)
    particles.clear()

    // Brief collapse of the dying card into a luminous outline.
    if (t < 0.36) {
      const pulse = 1 - t / 0.36
      particles.roundRect(
        x - width / 2 - t * 9,
        y - height / 2 - t * 9,
        width + t * 18,
        height + t * 18,
        9,
      ).stroke({ color: 0xffe7bc, alpha: 0.9 * pulse, width: 3.5 * pulse + 0.5 })
    }

    // Break into many small fragments that float upward rather than explode outward.
    seeds.forEach((seed, index) => {
      const delay = (index % 5) * 0.018
      const p = Math.max(0, Math.min(1, (t - delay) / (1 - delay)))
      const px = x + seed.startX * (1 - p * 0.18) + seed.vx * p
      const py = y + seed.startY + seed.vy * p - p * p * 24
      const alpha = Math.min(1, p * 9) * fade * (index % 6 === 0 ? 1 : 0.8)
      if (alpha <= 0) return
      const size = seed.radius * (1 - p * 0.48)
      particles.circle(px, py, size).fill({ color: seed.color, alpha })
      if (index % 6 === 0) {
        particles.moveTo(px, py - size * 2.3).lineTo(px, py + size * 2.3)
          .stroke({ color: seed.color, alpha: alpha * 0.7, width: 1.1 })
      }
    })
    if (t >= 1) stop()
  }

  app.ticker.add(tick)
  app.ticker.start()
  return stop
}
