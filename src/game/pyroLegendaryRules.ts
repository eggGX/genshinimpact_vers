import type { Follower, GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'
import { resolveLeaderElementalHit } from './elemental'
import { createSummonedFollower, summonFollowers } from './neutralRules'
import { resolveElementalDamage, resolveReactionConsequence } from './elemental'
import { hitAllEnemyFollowers } from './pyroRules'

function updateOwner(
  state: GameState, ownerIndex: number,
  update: (player: Player) => Player
): GameState {
  const players = [...state.players] as [Player, Player]
  players[ownerIndex] = update(players[ownerIndex])
  return { ...state, players }
}

/** Diluc: X = 2 + current use number, counting this activation. */
export function resolveDilucSkill(
  state: GameState, ownerIndex: number,
  sourceId: string, targetId: string
): GameState {
  const owner = state.players[ownerIndex]
  const source = owner.field.find(f => f.instanceId === sourceId && f.health > 0)
  const enemyIndex = 1 - ownerIndex
  const enemy = state.players[enemyIndex]
  const target = enemy.field.find(f => f.instanceId === targetId && f.health > 0)
  if (!source || !target) return state

  const value = 2 + (source.skillUsesThisTurn ?? 1)
  const outcome = resolveElementalDamage(target, value, 'pyro')
  const players = [...state.players] as [Player, Player]
  players[enemyIndex] = {
    ...enemy,
    field: enemy.field.map(f => f.instanceId === targetId ? outcome.follower : f),
  }
  return resolveReactionConsequence(
    { ...state, players }, enemyIndex, targetId,
    outcome.reaction, outcome.reactedElement, ownerIndex
  )
}

/** Diluc burst: pyro 3 to every enemy follower and the opposing leader. */
export function resolveDilucBurst(
  state: GameState, ownerId: string,
  resolveDeaths: (state: GameState) => GameState
): GameState {
  const ownerIndex = state.players.findIndex(p => p.id === ownerId)
  if (ownerIndex < 0) return state
  const result = hitAllEnemyFollowers(state, ownerId, 3, resolveDeaths)
  if (result.winnerId !== null) return result
  const enemyIndex = 1 - ownerIndex
  return resolveLeaderElementalHit(result, enemyIndex, 3, 'pyro', ownerIndex)
}

/**
 * Transformation is not destruction: Lyney gets no last-word resolution or
 * graveyard entry. The transformed card has a NEW instance ID and fresh stats,
 * shields, elemental aura, keywords, and action flags.
 */
export function transformLyney(
  state: GameState, ownerIndex: number, sourceId: string
): GameState {
  const replacement = createSummonedFollower('token-funny-hat-cat')
  return updateOwner(state, ownerIndex, p => ({
    ...p,
    field: p.field.map(f => f.instanceId === sourceId ? replacement : f),
  }))
}

/** On attack start: Lyney gains +1/+0 if at least 3 friendly pyro cards are in play. */
export function resolveLegendaryAttack(
  state: GameState, ownerId: string, attackerId: string
): GameState {
  const ownerIndex = state.players.findIndex(p => p.id === ownerId)
  if (ownerIndex < 0) return state
  const owner = state.players[ownerIndex]
  const attacker = owner.field.find(f => f.instanceId === attackerId)
  if (attacker?.cardId !== 'C024') return state
  const count = owner.field.filter(f => f.health > 0 &&
    getCard(f.cardId)?.element === 'pyro').length +
    (owner.amulets ?? []).filter(a => getCard(a.cardId)?.element === 'pyro').length
  if (count < 3) return state
  return updateOwner(state, ownerIndex, p => ({
    ...p,
    field: p.field.map(f => f.instanceId === attackerId
      ? { ...f, attack: f.attack + 1 } : f),
  }))
}

/** Hutao's HP<=10 modifier remains conditional, rather than permanently buffing base attack. */
export function effectiveAttack(
  state: GameState, ownerId: string, follower: Follower
): number {
  const hp = state.players.find(p => p.id === ownerId)?.leaderHealth ?? 20
  return Math.max(0, follower.attack + (follower.cardId === 'C025' && hp <= 10 ? 2 : 0))
}

/** Starts of owner turns: Funny Hat Cat destroys itself, triggering its last word. */
export function resolveLegendaryTurnStart(
  state: GameState, ownerId: string,
  resolveDeaths: (state: GameState) => GameState
): GameState {
  const ownerIndex = state.players.findIndex(p => p.id === ownerId)
  if (ownerIndex < 0) return state
  const ids = state.players[ownerIndex].field
    .filter(f => f.cardId === 'token-funny-hat-cat' && f.health > 0)
    .map(f => f.instanceId)
  let result = state
  for (const id of ids) {
    if (result.winnerId !== null) break
    result = updateOwner(result, ownerIndex, p => ({
      ...p,
      field: p.field.map(f => f.instanceId === id ? { ...f, health: 0 } : f),
    }))
    result = resolveDeaths(result)
  }
  return result
}

/** Cat death summons one Lyney with no fanfare; transformations don't come here. */
export function resolveLegendaryDestroy(
  state: GameState, ownerId: string, destroyed: Follower
): GameState {
  if (destroyed.cardId !== 'token-funny-hat-cat') return state
  return summonFollowers(state, ownerId, 'C024', 1)
}
