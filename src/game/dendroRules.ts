import type { Follower, GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'
import { damageLeader, healLeader } from './leaderShield'

let nextDendroAmuletId = 1

function edit(state: GameState, ownerId: string, change: (p: Player) => Player): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  const players = [...state.players] as [Player, Player]
  players[index] = change(players[index])
  return { ...state, players }
}

/** C102: tutor a Dendro card first; then perform a real draw, losing to deck-out. */
export function dendroSpell(state: GameState, ownerId: string, cardId: string): GameState {
  if (cardId !== 'C102' || state.winnerId !== null) return state
  const ownerIndex = state.players.findIndex(p => p.id === ownerId)
  if (ownerIndex < 0) return state
  let result = edit(state, ownerId, p => {
    const matches = p.deck.map((id, index) => ({ id, index }))
      .filter(item => getCard(item.id)?.element === 'dendro')
    if (matches.length === 0) return p
    const selected = matches[Math.floor(Math.random() * matches.length)]
    return { ...p,
      deck: p.deck.filter((_, index) => index !== selected.index),
      hand: p.hand.length < 9 ? [...p.hand, selected.id] : p.hand,
    }
  })
  const player = result.players[ownerIndex]
  if (player.deck.length === 0) return { ...result, winnerId: result.players[1 - ownerIndex].id }
  result = edit(result, ownerId, p => ({
    ...p,
    deck: p.deck.slice(1),
    hand: p.hand.length < 9 ? [...p.hand, p.deck[0]] : p.hand,
  }))
  return result
}

/** C104: Dendro floaty last word, with normal leader shield absorption. */
export function dendroDestroy(state: GameState, ownerId: string, dead: Follower): GameState {
  if (dead.cardId !== 'C104' || state.winnerId !== null) return state
  const other = state.players.find(p => p.id !== ownerId)
  if (!other) return state
  const damaged = damageLeader(other, 2)
  return { ...edit(state, other.id, () => damaged),
    winnerId: damaged.leaderHealth === 0 ? ownerId : state.winnerId }
}

/** C107: three-turn Vanarana amulet. */
export function dendroAmuletPlay(state: GameState, ownerId: string, cardId: string): GameState {
  if (cardId !== 'C107' || state.winnerId !== null) return state
  return edit(state, ownerId, p => ({
    ...p, amulets: [...(p.amulets ?? []), {
      instanceId: `vanarana-${nextDendroAmuletId++}`, cardId, turnsRemaining: 3,
    }],
  }))
}

/** End-turn Vanarana: heal, draw, then decrement. Each separate draw can lose. */
export function dendroAmuletsTurnEnd(state: GameState, ownerId: string): GameState {
  const ids = (state.players.find(p => p.id === ownerId)?.amulets ?? [])
    .filter(a => a.cardId === 'C107').map(a => a.instanceId)
  let result = state
  for (const id of ids) {
    if (result.winnerId !== null) break
    result = edit(result, ownerId, p => healLeader(p, 1))
    const index = result.players.findIndex(p => p.id === ownerId)
    if (result.players[index].deck.length === 0) {
      result = { ...result, winnerId: result.players[1 - index].id }
      break
    }
    result = edit(result, ownerId, p => ({
      ...p, deck: p.deck.slice(1),
      hand: p.hand.length < 9 ? [...p.hand, p.deck[0]] : p.hand,
      amulets: (p.amulets ?? []).map(a =>
        a.instanceId === id ? { ...a, turnsRemaining: a.turnsRemaining - 1 } : a)
        .filter(a => a.turnsRemaining > 0),
    }))
  }
  return result
}
