import { Graphics } from 'pixi.js'

export type ReactionFx =
  | '蒸発' | '溶解' | '感電' | '過負荷' | '凍結' | '超電導'
  | '燃焼' | '激化' | '拡散' | '結晶' | '開花' | '烈開花' | '超開花'

const names: ReactionFx[] = [
  '蒸発', '溶解', '感電', '過負荷', '凍結', '超電導',
  '燃焼', '激化', '拡散', '結晶', '開花', '烈開花', '超開花',
]

export function reactionFromFrameLabel(label: string): ReactionFx | null {
  const text = label.match(/元素反応：([^：\s／]+)/)?.[1]
  return names.find(name => name === text) ?? null
}

const palette: Record<ReactionFx, [number, number]> = {
  '蒸発': [0x9cdfff, 0xffffff],
  '溶解': [0xffa35a, 0xb6f3ff],
  '感電': [0xa16bff, 0x83dfff],
  '過負荷': [0xff6c43, 0xc98aff],
  '凍結': [0x77d8fc, 0xf3ffff],
  '超電導': [0xb0a5ff, 0xa5f6ff],
  '燃焼': [0xff923e, 0xb3df5a],
  '激化': [0x9cef62, 0xc897ff],
  '拡散': [0x72f5ce, 0xe4ffea],
  '結晶': [0xffd275, 0xfff3c3],
  '開花': [0x79de91, 0x89cfff],
  '烈開花': [0xff8254, 0xbaff7e],
  '超開花': [0x9be867, 0xae92ff],
}

/**
 * Distinct lightweight shapes for reaction bursts; no images, shaders or logic mutations.
 * Graphics are redrawn on the existing PixiJS ticker and destroyed after the effect.
 */
export function drawReactionBurst(
  g: Graphics, reaction: ReactionFx, x: number, y: number,
  radius: number, progress: number,
): void {
  const [primary, secondary] = palette[reaction]
  const fade = Math.pow(1 - progress, 1.3)
  const extent = 10 + radius * progress
  const isExplosion = reaction === '過負荷' || reaction === '烈開花'
  const isIce = reaction === '凍結' || reaction === '超電導' || reaction === '溶解'
  const isBloom = reaction === '開花' || reaction === '烈開花' || reaction === '超開花'
  const isVapor = reaction === '蒸発'
  const isSwirl = reaction === '拡散'
  const isElectric = reaction === '感電' || reaction === '超電導' || reaction === '超開花' || reaction === '激化'

  // Core shockwave. Explosions have two wider waves; freezing has a hexagonal boundary.
  if (isIce) {
    for (let side = 0; side <= 6; side++) {
      const angle = side * Math.PI / 3
      const px = x + extent * Math.cos(angle)
      const py = y + extent * Math.sin(angle)
      if (!side) g.moveTo(px, py)
      else g.lineTo(px, py)
    }
    g.stroke({ color: primary, alpha: fade * 0.85, width: 4 * fade + 0.5 })
  } else {
    g.circle(x, y, extent)
      .stroke({ color: primary, alpha: fade * 0.85, width: (isExplosion ? 8 : 4) * fade + 0.5 })
  }
  if (isExplosion || isBloom) {
    g.circle(x, y, extent * 0.72)
      .stroke({ color: secondary, alpha: fade * 0.65, width: 3 * fade + 0.5 })
  }

  for (let i = 0; i < 16; i++) {
    const seed = i * Math.PI * 2 / 16
    const angle = seed + (isSwirl ? progress * 2.8 : 0)
    const distance = extent * (0.55 + (i % 4) * 0.12)
    const px = x + Math.cos(angle) * distance
    const py = y + Math.sin(angle) * distance - (isVapor ? progress * radius * 0.75 : 0)
    const size = (3 + i % 4) * (0.55 + fade * 0.6)
    const color = i % 2 ? primary : secondary

    if (isVapor) {
      g.circle(px, py, size * 2.1)
        .fill({ color, alpha: fade * 0.15 })
    } else if (isElectric) {
      const displacement = size * (i % 2 ? 1 : -1)
      g.moveTo(px - size * 1.7, py - size)
        .lineTo(px + displacement, py - size * 0.1)
        .lineTo(px - displacement, py + size * 0.5)
        .lineTo(px + size * 1.6, py + size)
        .stroke({ color, alpha: fade * 0.88, width: 2.4 * fade + 0.5 })
    } else if (isIce || reaction === '結晶') {
      const corners = reaction === '結晶' ? 4 : 6
      for (let side = 0; side <= corners; side++) {
        const a = angle + side * Math.PI * 2 / corners
        const vx = px + Math.cos(a) * size * 1.5
        const vy = py + Math.sin(a) * size * 1.5
        if (!side) g.moveTo(vx, vy)
        else g.lineTo(vx, vy)
      }
      g.closePath().stroke({ color, alpha: fade, width: 2 })
    } else if (isBloom) {
      g.ellipse(px, py, size * 0.65, size * 1.8)
        .fill({ color, alpha: fade * 0.8 })
    } else if (isSwirl) {
      g.arc(px, py, size * 1.8, angle, angle + Math.PI * 1.3)
        .stroke({ color, alpha: fade, width: 2.5 })
    } else {
      // Melt / burning / overload: flame and impact sparks.
      g.moveTo(px, py - size * 2)
        .lineTo(px + size, py + size)
        .lineTo(px - size, py + size)
        .closePath().fill({ color, alpha: fade })
    }
  }
}
