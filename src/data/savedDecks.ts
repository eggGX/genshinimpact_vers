import { SELECTABLE_ELEMENTS, validateDeck, type DeckDefinition, type PlayableElement } from './deckRules'

export interface SavedDeck {
  id: string
  name: string
  deck: DeckDefinition
}

export const SAVED_DECKS_STORAGE_KEY = 'genshin-saved-decks-v1'

export function copyDeck(deck: DeckDefinition): DeckDefinition {
  return { elements: [...deck.elements], cards: [...deck.cards] }
}

function isDeck(value: unknown): value is DeckDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const input = value as Record<string, unknown>
  return Array.isArray(input.elements) && input.elements.every(element =>
    typeof element === 'string' && SELECTABLE_ELEMENTS.includes(element as PlayableElement)) &&
    Array.isArray(input.cards) && input.cards.every(card => typeof card === 'string')
}

/** Never trust saved browser data: ignore malformed or no-longer-playable decks. */
export function parseSavedDecks(raw: string | null): SavedDeck[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const result: SavedDeck[] = []
    for (const value of parsed) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue
      const entry = value as Record<string, unknown>
      if (typeof entry.id !== 'string' || !entry.id || seen.has(entry.id) ||
          typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 40 ||
          !isDeck(entry.deck) || validateDeck(entry.deck).length > 0) continue
      seen.add(entry.id)
      result.push({ id: entry.id, name: entry.name.trim(), deck: copyDeck(entry.deck) })
    }
    return result
  } catch {
    return []
  }
}

export function loadSavedDecks(): SavedDeck[] {
  try {
    return parseSavedDecks(window.localStorage.getItem(SAVED_DECKS_STORAGE_KEY))
  } catch {
    return []
  }
}

export function persistSavedDecks(decks: SavedDeck[]): boolean {
  try {
    window.localStorage.setItem(SAVED_DECKS_STORAGE_KEY, JSON.stringify(decks))
    return true
  } catch {
    return false
  }
}
