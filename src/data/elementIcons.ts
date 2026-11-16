import type { ElementType } from '../game/types'

/**
 * Element visual metadata. Seven extracted element marks are stored in /public/elements/elements-sprite.png.
 * Replace them with approved transparent individual SVGs here when
 * available; every screen using ElementIcon will update automatically.
 *
 * Example:
 *   pyro: { ...ELEMENT_VISUALS.pyro, image: '/elements/pyro.svg' }
 *
 * Keep original character art separate from these reusable UI assets.
 */
export interface ElementVisual {
  label: string
  symbol: string
  color: string
  image?: string
  spriteIndex?: number
}

export const ELEMENT_VISUALS: Readonly<Record<ElementType, ElementVisual>> = {
  none:    { label: '無元素', symbol: '◇', color: '#c5bdad' },
  pyro:    { label: '炎', symbol: '炎', color: '#f07e63', spriteIndex: 0 },
  hydro:   { label: '水', symbol: '水', color: '#6bc9f1', spriteIndex: 1 },
  cryo:    { label: '氷', symbol: '氷', color: '#a1e4f0', spriteIndex: 2 },
  electro: { label: '雷', symbol: '雷', color: '#cba0f2', spriteIndex: 3 },
  anemo:   { label: '風', symbol: '風', color: '#89e3ca', spriteIndex: 4 },
  geo:     { label: '岩', symbol: '岩', color: '#edc575', spriteIndex: 5 },
  dendro:  { label: '草', symbol: '草', color: '#a7d782', spriteIndex: 6 },
}

export function getElementVisual(element: ElementType): ElementVisual {
  return ELEMENT_VISUALS[element]
}
