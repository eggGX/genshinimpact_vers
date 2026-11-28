import type { Card, ElementType, Rarity } from '../game/types'

export interface CardFilters {
  element: ElementType | 'all'
  rarity: Rarity | 'all'
  origin: 'all' | 'token' | 'production'
  search: string
}

export function filterCards(
  cards: readonly Card[],
  filters: CardFilters,
  productionIds: ReadonlySet<string>
): Card[] {
  const query = filters.search.trim().toLocaleLowerCase()
  return cards.filter(card => {
    if (filters.element !== 'all' && card.element !== filters.element) return false
    if (filters.rarity !== 'all' && card.rarity !== filters.rarity) return false
    const formal = productionIds.has(card.id)
    // Tokens are visible only when the Token filter is explicitly selected.
    if (filters.origin !== 'token' && card.token) return false
    if (filters.origin === 'token' && !card.token) return false
    if (filters.origin === 'production' && !formal) return false
    return !query || card.name.toLocaleLowerCase().includes(query) ||
      card.id.toLocaleLowerCase().includes(query)
  })
}
