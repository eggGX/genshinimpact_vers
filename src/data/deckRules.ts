import { productionCards } from './productionCards'
import type { Card, ElementType } from '../game/types'

export type PlayableElement = Exclude<ElementType, 'none'>
export interface DeckDefinition {
  elements: PlayableElement[]
  cards: string[]
}

export const DECK_SIZE = 40
export const MAX_CARD_COPIES = 3
export const MAX_DECK_ELEMENTS = 3
export const SELECTABLE_ELEMENTS: PlayableElement[] = [
  'pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro',
]

const official = new Map(productionCards.map(card => [card.id, card]))

export function getDeckCard(id: string): Card | undefined {
  const card = official.get(id)
  return card && !card.token && card.implementationStatus === 'playable' ? card : undefined
}

/** Element choices include only the seven elements; neutral consumes no element slot. */
export function validateDeck(deck: DeckDefinition): string[] {
  const errors: string[] = []
  if (!deck || !Array.isArray(deck.elements) || !Array.isArray(deck.cards)) {
    return ['デッキの形式が不正です']
  }
  const chosen = new Set(deck.elements)
  if (chosen.size !== deck.elements.length ||
      chosen.size > MAX_DECK_ELEMENTS ||
      deck.elements.some(e => !SELECTABLE_ELEMENTS.includes(e))) {
    errors.push('元素は7元素から重複なく最大3種類まで選択してください')
  }
  if (deck.cards.length !== DECK_SIZE) {
    errors.push(`カードは40枚必要です（現在${deck.cards.length}枚）`)
  }
  const copies = new Map<string, number>()
  const used = new Set<PlayableElement>()
  for (const id of deck.cards) {
    const card = getDeckCard(id)
    if (!card) {
      errors.push(`正式カードではありません：${id}`)
      continue
    }
    const n = (copies.get(id) ?? 0) + 1
    copies.set(id, n)
    if (n > MAX_CARD_COPIES) {
      if (n === MAX_CARD_COPIES + 1) errors.push(`${card.name}は最大3枚までです`)
    }
    if (card.element !== 'none') {
      const element = card.element as PlayableElement
      used.add(element)
      if (!chosen.has(element)) {
        errors.push(`${card.name}の元素が選択されていません`)
      }
    }
  }
  if (used.size > MAX_DECK_ELEMENTS) {
    errors.push('使用する元素は最大3種類までです')
  }
  return errors
}

export function createStarterDeck(elements: readonly PlayableElement[]): DeckDefinition {
  const selected = [...elements].filter(e => SELECTABLE_ELEMENTS.includes(e)).slice(0, 3)
  const available = productionCards.filter(card => getDeckCard(card.id))
  const buckets = (['none', ...selected] as ElementType[])
    .map(element => available.filter(card => card.element === element))
  const pointers = buckets.map(() => 0)
  const copies = new Map<string,number>()
  const cards: string[] = []
  // Distribute the initial sample across neutral and the chosen elements.
  // Actual deck construction remains fully editable by each player.
  while (cards.length < DECK_SIZE) {
    let added = false
    for (let i = 0; i < buckets.length && cards.length < DECK_SIZE; i++) {
      const bucket = buckets[i]
      for (let j = 0; j < bucket.length; j++) {
        const card = bucket[pointers[i] % bucket.length]
        pointers[i]++
        if ((copies.get(card.id) ?? 0) >= MAX_CARD_COPIES) continue
        cards.push(card.id)
        copies.set(card.id, (copies.get(card.id) ?? 0) + 1)
        added = true
        break
      }
    }
    if (!added) break
  }
  return { elements: selected, cards }
}
