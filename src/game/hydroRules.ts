import type { GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'
import { grantShield } from './elemental'
import { summonFollowers } from './neutralRules'

function updatePlayer(
  state: GameState, ownerId: string, transform: (player: Player) => Player
): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  const players = [...state.players] as [Player, Player]
  players[index] = transform(players[index])
  return { ...state, players }
}

/** C031: Heal friendly leader and followers, then draw once or lose on deck out. */
export function resolveHydroSpell(state: GameState, ownerId: string, cardId: string): GameState {
  if (cardId !== 'C031' || state.winnerId !== null) return state
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  let result = updatePlayer(state, ownerId, player => ({
    ...player,
    leaderHealth: Math.min(player.leaderMaxHealth, player.leaderHealth + 2),
    field: player.field.map(f => f.health > 0
      ? { ...f, health: Math.min(f.maxHealth, f.health + 2) } : f),
  }))
  if (result.players[index].deck.length === 0) {
    return { ...result, winnerId: result.players[1 - index].id }
  }
  result = updatePlayer(result, ownerId, player => {
    const [card, ...deck] = player.deck
    return {
      ...player,
      deck,
      hand: card && player.hand.length < 9 ? [...player.hand, card] : player.hand,
    }
  })
  return result
}

/** C027 and C032: board and shield effects, resolved in field placement order. */
export function resolveHydroTurnEnd(state: GameState, ownerId: string, sourceId: string): GameState {
  if (state.winnerId !== null) return state
  const owner = state.players.find(p => p.id === ownerId)
  const source = owner?.field.find(f => f.instanceId === sourceId && f.health > 0)
  if (!source) return state
  if (source.cardId === 'C027') {
    return updatePlayer(state, ownerId, p => ({
      ...p,
      field: p.field.map(f => f.health > 0
        ? { ...f, health: Math.min(f.maxHealth, f.health + 1) } : f),
    }))
  }
  if (source.cardId === 'C032') {
    return updatePlayer(state, ownerId, p => ({
      ...p,
      field: p.field.map(f => f.instanceId === sourceId
        ? grantShield(f, 'normal', 2) : f),
    }))
  }
  return state
}

/** C033: summon a normal Hilichurl on an attack declaration (no fanfare). */
export function resolveHydroAttack(state: GameState, ownerId: string, attackerId: string): GameState {
  const owner = state.players.find(p => p.id === ownerId)
  const source = owner?.field.find(f => f.instanceId === attackerId && f.health > 0)
  if (!source || source.cardId !== 'C033') return state
  if (!getCard('C001')) return state
  return summonFollowers(state, ownerId, 'C001', 1)
}
