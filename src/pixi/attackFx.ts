import { Container, Graphics, Sprite, Text, Texture, type Application, type Ticker } from 'pixi.js'

export interface AttackCue {
  /** Stable for one attack declaration, independent of hover and pointer movement. */
  key: object
  attackerId: string
  targetId: string
  duration: number
  attackerSurvives: boolean
}

export interface CardImage {
  image: HTMLImageElement | null
  name: string
  attack: string
  health: string
}

type Point = { x: number; y: number }

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2

/**
 * A temporary Pixi card duplicate that travels from its source to the target.
 * The original React card stays mounted and interactive underneath.
 * The texture is shared with the already loaded DOM artwork, never destroyed.
 */
export function spawnCardAttack(
  app: Application,
  source: Point,
  target: Point,
  duration: number,
  attackerSurvives: boolean,
  card: CardImage,
  onEnd: (stop: () => void) => void,
): () => void {
  const root = new Container()
  const trail = new Graphics()
  const shell = new Graphics()
  const flash = new Graphics()
  const cardWidth = 106
  const cardHeight = 139

  app.stage.addChild(trail)
  app.stage.addChild(root)
  app.stage.addChild(flash)
  // A dark body and metallic border read as a real card, not an empty outline.
  shell.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
    .fill({ color: 0x162133, alpha: 0.97 })
    .stroke({ color: 0xffd895, width: 3 })
  root.addChild(shell)

  if (card.image?.complete && card.image.naturalWidth > 0) {
    // Sprite.from(DOM image) reuses decoded artwork without extra network requests.
    const sprite = new Sprite(Texture.from(card.image))
    const artHeight = 104
    const artWidth = cardWidth - 10
    const scale = Math.max(artWidth / sprite.texture.width, artHeight / sprite.texture.height)
    sprite.width = sprite.texture.width * scale
    sprite.height = sprite.texture.height * scale
    sprite.x = -sprite.width / 2
    sprite.y = -cardHeight / 2 + 5 + (artHeight - sprite.height) / 2
    // Crop portrait to the existing field-card artwork window.
    const mask = new Graphics()
    mask.roundRect(-artWidth / 2, -cardHeight / 2 + 5, artWidth, artHeight, 7)
      .fill(0xffffff)
    root.addChild(mask)
    root.addChild(sprite)
    sprite.mask = mask
  } else {
    // Missing/undecoded images do not break the attack animation.
    const fallback = new Graphics()
    fallback.roundRect(-46, -64, 92, 100, 7).fill({ color: 0x33445c })
    fallback.star(0, -16, 6, 25, 12).fill({ color: 0xe0b96d, alpha: 0.7 })
    root.addChild(fallback)
  }

  const bottomBar = new Graphics()
  bottomBar.roundRect(-50, 39, 100, 26, 5).fill({ color: 0x19273e, alpha: 0.97 })
  root.addChild(bottomBar)

  // Name and stats make the flying image visibly recognizable as a real card.
  const name = new Text({
    text: card.name.length > 9 ? card.name.slice(0, 9) + '…' : card.name,
    style: { fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'bold',
      fill: 0xffedca, align: 'center' },
  })
  name.anchor.set(0.5)
  name.y = 53
  root.addChild(name)

  const leftStat = new Text({
    text: card.attack,
    style: { fontFamily: 'sans-serif', fontSize: 13, fontWeight: 'bold',
      fill: 0xffe4a3, stroke: { color: 0x182236, width: 2 } },
  })
  leftStat.anchor.set(0.5)
  leftStat.position.set(-40, 53)
  root.addChild(leftStat)

  const rightStat = new Text({
    text: card.health,
    style: { fontFamily: 'sans-serif', fontSize: 13, fontWeight: 'bold',
      fill: 0xb5f9dc, stroke: { color: 0x182236, width: 2 } },
  })
  rightStat.anchor.set(0.5)
  rightStat.position.set(40, 53)
  root.addChild(rightStat)

  const dx = target.x - source.x
  const dy = target.y - source.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  // Stop at the front edge of the target rather than covering its centre.
  const hitPoint = { x: target.x - ux * 34, y: target.y - uy * 34 }
  const total = Math.max(300, Math.min(820, duration))
  let elapsed = 0
  let stopped = false

  const tick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS
    const p = Math.min(1, elapsed / total)
    const chargeEnd = 0.17
    const impactEnd = 0.59
    let x: number
    let y: number
    let scale: number
    if (p < chargeEnd) {
      const t = easeOutCubic(p / chargeEnd)
      x = source.x - ux * 16 * t
      y = source.y - uy * 16 * t
      scale = 1 + 0.14 * t
    } else if (p < impactEnd) {
      const t = easeInOutCubic((p - chargeEnd) / (impactEnd - chargeEnd))
      x = source.x - ux * 16 + (hitPoint.x - source.x + ux * 16) * t
      y = source.y - uy * 16 + (hitPoint.y - source.y + uy * 16) * t - 18 * Math.sin(Math.PI * t)
      scale = 1.14 + 0.22 * Math.sin(Math.PI * t)
    } else if (attackerSurvives) {
      const t = easeOutCubic((p - impactEnd) / (1 - impactEnd))
      x = hitPoint.x + (source.x - hitPoint.x) * t
      y = hitPoint.y + (source.y - hitPoint.y) * t
      scale = 1.14 - 0.14 * t
    } else {
      // A destroyed attacker fades at the impact point; it does not fly home.
      x = hitPoint.x
      y = hitPoint.y
      scale = 1.14 + (p - impactEnd) * 0.12
    }
    root.position.set(x, y)
    root.scale.set(scale)
    root.rotation = Math.sin(Math.PI * Math.min(1, p / impactEnd)) * (ux >= 0 ? 0.055 : -0.055)
    root.alpha = p < 0.06 ? p / 0.06
      : p > 0.86 ? (1 - p) / 0.14 : 1

    trail.clear()
    if (p >= chargeEnd && p <= impactEnd) {
      const intensity = Math.sin(Math.PI * (p - chargeEnd) / (impactEnd - chargeEnd))
      for (let i = 1; i <= 4; i++) {
        const tx = x - ux * (24 + i * 20)
        const ty = y - uy * (24 + i * 20)
        trail.moveTo(tx, ty).lineTo(x - ux * 24, y - uy * 24)
          .stroke({ color: i % 2 ? 0xffdb91 : 0xffffff,
            width: Math.max(1, 9 - i * 1.7), alpha: intensity * (0.55 - i * 0.08) })
      }
    }

    flash.clear()
    if (p >= impactEnd && p < impactEnd + 0.16) {
      const t = (p - impactEnd) / 0.16
      flash.circle(hitPoint.x, hitPoint.y, 18 + t * 68)
        .stroke({ color: 0xffe4aa, width: 8 * (1 - t) + 1, alpha: 0.9 * (1 - t) })
      flash.circle(hitPoint.x, hitPoint.y, 9 + t * 43)
        .stroke({ color: 0xffffff, width: 4 * (1 - t) + 1, alpha: 0.8 * (1 - t) })
    }
    if (p >= 1) stop()
  }
  const stop = () => {
    if (stopped) return
    stopped = true
    app.ticker.remove(tick)
    trail.destroy()
    flash.destroy()
    root.destroy({ children: true })
    onEnd(stop)
  }
  app.ticker.add(tick)
  app.ticker.start()
  return stop
}
