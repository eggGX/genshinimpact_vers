import type { Follower, GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'
import { resolveElementalDamage, resolveReactionConsequence } from './elemental'

function updateOwner(state: GameState, ownerId: string, update: (player: Player) => Player): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  const players = [...state.players] as [Player, Player]
  players[index] = update(players[index])
  return { ...state, players }
}

/**
 * Applies elemental damage one follower at a time, resolving reactions and deaths
 * before the next follower. The original field order is preserved for simultaneous
 * selection; effects with lethal damage never hit newly summoned replacements.
 */
export function hitAllEnemyFollowers(
  state: GameState,
  ownerId: string,
  amount: number,
  resolveDeaths: (state: GameState) => GameState
): GameState {
  const ownerIndex = state.players.findIndex(p => p.id === ownerId)
  if (ownerIndex < 0) return state
  const enemyIndex = 1 - ownerIndex
  const initialIds = state.players[enemyIndex].field.map(f => f.instanceId)
  let result = state
  for (const id of initialIds) {
    if (result.winnerId !== null) break
    const enemy = result.players[enemyIndex]
    const follower = enemy.field.find(f => f.instanceId === id && f.health > 0)
    if (!follower) continue
    const hit = resolveElementalDamage(follower, amount, 'pyro')
    const players = [...result.players] as [Player, Player]
    players[enemyIndex] = {
      ...enemy,
      field: enemy.field.map(f => f.instanceId === id ? hit.follower : f),
    }
    result = resolveReactionConsequence(
      { ...result, players }, enemyIndex, id, hit.reaction, hit.reactedElement, ownerIndex
    )
    result = resolveDeaths(result)
  }
  return result
}

function dealLeaderDamage(state: GameState, targetIndex: number, amount: number): GameState {
  if (state.winnerId !== null) return state
  const players = [...state.players] as [Player, Player]
  const target = players[targetIndex]
  const hp = Math.max(0, target.leaderHealth - amount)
  players[targetIndex] = { ...target, leaderHealth: hp }
  return {
    ...state,
    players,
    winnerId: hp === 0 ? players[1 - targetIndex].id : state.winnerId,
  }
}

/** Pyro silver spells C015 and C018. */
export function resolvePyroSpell(
  state: GameState,
  ownerId: string,
  cardId: string,
  targetId: string | undefined,
  resolveDeaths: (state: GameState) => GameState
): GameState {
  const ownerIndex = state.players.findIndex(p => p.id === ownerId)
  if (ownerIndex < 0 || state.winnerId !== null) return state
  const enemyIndex = 1 - ownerIndex

  if (cardId === 'C015') {
    let result = hitAllEnemyFollowers(state, ownerId, 1, resolveDeaths)
    if (result.winnerId !== null) return result
    result = updateOwner(result, ownerId, p => ({
      ...p,
      crests: [...(p.crests ?? []), { id: 'C015', turnsRemaining: 2, usedElements: [] }],
    }))
    return result
  }

  if (cardId === 'C018' && targetId) {
    const target = state.players[enemyIndex].field.find(
      f => f.instanceId === targetId && f.health > 0 &&
        !f.keywords.includes('aura') && !f.keywords.includes('stealth')
    )
    if (!target) return state
    const players = [...state.players] as [Player, Player]
    const enemy = players[enemyIndex]
    players[enemyIndex] = {
      ...enemy,
      field: enemy.field.map(f => f.instanceId === targetId ? { ...f, health: 0 } : f),
    }
    let result = resolveDeaths({ ...state, players })
    result = dealLeaderDamage(result, enemyIndex, 2)
    result = dealLeaderDamage(result, ownerIndex, 2)
    return result
  }
  return state
}

/** C016 is a countdown amulet, tracked separately from followers. */
export function resolvePyroAmuletPlay(state: GameState, ownerId: string): GameState {
  return updateOwner(state, ownerId, player => ({
    ...player,
    amulets: [...(player.amulets ?? []), {
      instanceId: `amulet-${nextAmuletId++}`,
      cardId: 'C016',
      turnsRemaining: 3,
    }],
  }))
}
let nextAmuletId = 1

/** End-turn effects resolve with the owner's order: amulets then crests. */
export function resolvePyroTurnEnd(
  state: GameState,
  ownerId: string,
  resolveDeaths: (state: GameState) => GameState
): GameState {
  const ownerIndex = state.players.findIndex(p => p.id === ownerId)
  if (ownerIndex < 0) return state
  let result = state

  // Countdowns already on the board at turn end activate, including the turn played.
  const amuletIds = (state.players[ownerIndex].amulets ?? [])
    .filter(a => a.cardId === 'C016')
    .map(a => a.instanceId)
  for (const amuletId of amuletIds) {
    if (result.winnerId !== null) break
    const owner = result.players[ownerIndex]
    if (!(owner.amulets ?? []).some(a => a.instanceId === amuletId)) continue
    result = updateOwner(result, ownerId, player => ({
      ...player,
      leaderHealth: Math.min(player.leaderMaxHealth, player.leaderHealth + 2),
      field: player.field.map(f => ({
        ...f, attack: f.attack + 1,
      })),
      amulets: (player.amulets ?? []).map(a => a.instanceId === amuletId
        ? { ...a, turnsRemaining: a.turnsRemaining - 1 } : a),
    }))
    result = updateOwner(result, ownerId, player => ({
      ...player,
      amulets: (player.amulets ?? []).filter(a => a.turnsRemaining > 0),
    }))
  }

  // Each C015 crest triggers independently, dealing 1 pyro to each enemy follower
  // then 1 to the enemy leader; countdown 0 crests expire afterwards.
  const crests = result.players[ownerIndex].crests ?? []
  for (let i = 0; i < crests.length; i++) {
    if (result.winnerId !== null) break
    const crest = result.players[ownerIndex].crests?.[i]
    if (!crest || crest.id !== 'C015' || crest.turnsRemaining <= 0) continue
    result = hitAllEnemyFollowers(result, ownerId, 1, resolveDeaths)
    if (result.winnerId !== null) break
    result = dealLeaderDamage(result, 1 - ownerIndex, 1)
    result = updateOwner(result, ownerId, p => ({
      ...p,
      crests: (p.crests ?? []).map((c, index) => index === i
        ? { ...c, turnsRemaining: c.turnsRemaining - 1 } : c),
    }))
  }
  return updateOwner(result, ownerId, p => ({
    ...p,
    crests: (p.crests ?? []).filter(c => c.turnsRemaining > 0),
  }))
}

/** Removes stealth upon declaring a normal attack, then reapplies for Fatui agent. */
export function resolvePyroAttackAfter(state: GameState, ownerId: string, attackerId: string): GameState {
  const owner = state.players.find(p => p.id === ownerId)
  const attacker = owner?.field.find(f => f.instanceId === attackerId)
  if (!owner || !attacker || attacker.cardId !== 'C017' || attacker.health <= 0) return state
  const hasOtherFatui = owner.field.some(f =>
    f.instanceId !== attackerId && f.health > 0 &&
    getCard(f.cardId)?.traits?.includes('ファデュイ')
  )
  if (!hasOtherFatui) return state
  return updateOwner(state, ownerId, p => ({
    ...p,
    field: p.field.map(f => f.instanceId === attackerId
      ? { ...f, keywords: [...f.keywords, 'stealth'] } : f),
  }))
}

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
