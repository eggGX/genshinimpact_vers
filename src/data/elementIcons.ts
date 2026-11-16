import type { ElementType } from '../game/types'

/**
 * Element visual metadata. Register the approved transparent SVGs here when
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
}

export const ELEMENT_VISUALS: Readonly<Record<ElementType, ElementVisual>> = {
  none:    { label: '無元素', symbol: '◇', color: '#c5bdad' },
  pyro:    { label: '炎', symbol: '炎', color: '#f07e63' },
  hydro:   { label: '水', symbol: '水', color: '#6bc9f1' },
  cryo:    { label: '氷', symbol: '氷', color: '#a1e4f0' },
  electro: { label: '雷', symbol: '雷', color: '#cba0f2' },
  anemo:   { label: '風', symbol: '風', color: '#89e3ca' },
  geo:     { label: '岩', symbol: '岩', color: '#edc575' },
  dendro:  { label: '草', symbol: '草', color: '#a7d782' },
}

export function getElementVisual(element: ElementType): ElementVisual {
  return ELEMENT_VISUALS[element]
}
