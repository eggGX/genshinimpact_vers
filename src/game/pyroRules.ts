import type { Follower, GameState, Player } from './types'
import { resolveElementalDamage, resolveReactionConsequence } from './elemental'

/** Dodoco last word: a random enemy follower takes pyro 2. */
export function resolvePyroDestroy(
  state: GameState, ownerId: string, destroyed: Follower
): GameState {
  if (destroyed.cardId !== 'C013' || state.winnerId !== null) return state
  const ownerIndex = state.players.findIndex(p => p.id === ownerId)
  if (ownerIndex < 0) return state
  const enemyIndex = 1 - ownerIndex
  const enemy = state.players[enemyIndex]
  const candidates = enemy.field.filter(f => f.health > 0)
  if (!candidates.length) return state

  const victim = candidates[Math.floor(Math.random() * candidates.length)]
  const hit = resolveElementalDamage(victim, 2, 'pyro')
  const players = [...state.players] as [Player, Player]
  players[enemyIndex] = {
    ...enemy,
    field: enemy.field.map(f => f.instanceId === victim.instanceId ? hit.follower : f),
  }
  return resolveReactionConsequence(
    { ...state, players }, enemyIndex, victim.instanceId,
    hit.reaction, hit.reactedElement, ownerIndex
  )
}
