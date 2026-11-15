import type { GameState, Player } from './types'
import { grantShield } from './elemental'
import { summonFollowers } from './neutralRules'

function editOwner(state: GameState, ownerId: string, edit: (p: Player) => Player): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  const players = [...state.players] as [Player, Player]
  players[index] = edit(players[index])
  return { ...state, players }
}

/** C047 summons two Cryo Cicins on play, respecting the shared five slots. */
export function resolveCryoPlay(state: GameState, ownerId: string, cardId: string): GameState {
  if (cardId !== 'C047' || state.winnerId !== null) return state
  return summonFollowers(state, ownerId, 'token-cryo-cicin', 2)
}

/** C047 and C048 end-turn shields, applied in the established field order. */
export function resolveCryoTurnEnd(
  state: GameState, ownerId: string, sourceId: string
): GameState {
  if (state.winnerId !== null) return state
  const player = state.players.find(p => p.id === ownerId)
  const source = player?.field.find(f => f.instanceId === sourceId && f.health > 0)
  if (!source) return state
  if (source.cardId === 'C047') {
    const hasCicin = player!.field.some(f => f.cardId === 'token-cryo-cicin' && f.health > 0)
    if (!hasCicin) return state
    return editOwner(state, ownerId, p => ({
      ...p,
      field: p.field.map(f => f.instanceId === sourceId ? grantShield(f, 'normal', 2) : f),
    }))
  }
  if (source.cardId === 'C048') {
    return editOwner(state, ownerId, p => ({
      ...p,
      field: p.field.map(f => f.instanceId === sourceId ? grantShield(f, 'normal', 3) : f),
    }))
  }
  return state
}
