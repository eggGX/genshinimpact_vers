import type { Card } from '../game/types'
import { productionCards } from './productionCards'
import { productionTokens } from './productionTokens'

/** Data-driven card catalogue shared by the game engine and elemental rules. */
export function createCardRegistry(cards: readonly Card[]): ReadonlyMap<string, Card> {
  const registry = new Map<string, Card>()
  for (const card of cards) {
    if (!card.id.trim()) throw new Error('Card ID must not be blank')
    if (registry.has(card.id)) throw new Error(`Duplicate card ID: ${card.id}`)
    registry.set(card.id, card)
  }
  return registry
}

const cards = [...productionCards, ...productionTokens]
export const cardRegistry = createCardRegistry(cards)

export function getCard(cardId: string): Card | undefined {
  return cardRegistry.get(cardId)
}

/** Tokens and unimplemented formal cards can be resolved from the catalogue but never enter starting decks. */
export function getDeckCardPool(): Card[] {
  // Every playable production card (including expansions) can enter normal decks.
  return productionCards.filter(card => !card.token && card.implementationStatus === 'playable')
}

/** Stable copy for listing, validation, and future deck building UIs. */
export function getAllCards(): Card[] {
  return [...cardRegistry.values()]
}
