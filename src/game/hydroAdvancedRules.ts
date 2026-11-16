import { captureFrame } from './presentation'
import type { Follower, GameState, Player } from './types'
import { summonFollowers } from './neutralRules'
import { damageLeader, healLeader } from './leaderShield'
import { resolveElementalDamage, resolveReactionConsequence } from './elemental'

let nextHydroAmuletId = 1

function updatePlayer(
  state: GameState, ownerId: string, fn: (p: Player) => Player
): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  const players = [...state.players] as [Player, Player]
  players[index] = fn(players[index])
  return { ...state, players }
}

function dealLeaderDamage(state: GameState, targetIndex: number, amount: number, element?: 'hydro'): GameState {
  if (state.winnerId !== null) return state
  const players = [...state.players] as [Player, Player]
  const target = players[targetIndex]
  const damaged = damageLeader(target, amount, element)
  const hp = damaged.leaderHealth
  players[targetIndex] = damaged
  return {
    ...state, players,
    winnerId: hp === 0 ? players[1 - targetIndex].id : state.winnerId,
  }
}

function hydroFollowerDamage(
  state: GameState,
  sourceOwnerIndex: number,
  victimId: string,
  amount: number
): GameState {
  if (state.winnerId !== null) return state
  const targetIndex = 1 - sourceOwnerIndex
  const opponent = state.players[targetIndex]
  const victim = opponent.field.find(f => f.instanceId === victimId && f.health > 0)
  if (!victim) return state
  const outcome = resolveElementalDamage(victim, amount, 'hydro')
  const players = [...state.players] as [Player, Player]
  players[targetIndex] = {
    ...opponent,
    field: opponent.field.map(f => f.instanceId === victimId ? outcome.follower : f),
  }
  return resolveReactionConsequence(
    { ...state, players }, targetIndex, victimId,
    outcome.reaction, outcome.reactedElement, sourceOwnerIndex
  )
}

function hitAllHydro(
  state: GameState,
  ownerId: string,
  amount: number,
  resolveDeaths: (s: GameState) => GameState
): GameState {
  const ownerIndex = state.players.findIndex(p => p.id === ownerId)
  if (ownerIndex < 0) return state
  const initialIds = state.players[1 - ownerIndex].field.map(f => f.instanceId)
  let result = state
  for (const id of initialIds) {
    if (result.winnerId !== null) break
    result = hydroFollowerDamage(result, ownerIndex, id, amount)
    result = resolveDeaths(result)
  }
  return result
}

/** C035 draws before the next action. C037 summons one device if space permits. */
export function resolveHydroAdvancedPlay(
  state: GameState, ownerId: string, cardId: string
): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C035') {
    const ownerIndex = state.players.findIndex(p => p.id === ownerId)
    if (ownerIndex < 0) return state
    const owner = state.players[ownerIndex]
    if (owner.deck.length === 0) {
      return { ...state, winnerId: state.players[1 - ownerIndex].id }
    }
    return updatePlayer(state, ownerId, p => {
      const [drawn, ...deck] = p.deck
      return { ...p, deck, hand: p.hand.length >= 9 ? p.hand : [...p.hand, drawn] }
    })
  }
  if (cardId === 'C037') {
    return updatePlayer(state, ownerId, p => {
      if (p.field.length + (p.amulets?.length ?? 0) >= 5) return p
      return {
        ...p,
        amulets: [...(p.amulets ?? []), {
          instanceId: `hydro-amulet-${nextHydroAmuletId++}`,
          cardId: 'token-hydro-pressure-device',
          turnsRemaining: 2,
        }],
      }
    })
  }
  return state
}

/** Applies the secondary effects after the standard skill damage has resolved. */
export function resolveHydroAdvancedSkill(
  state: GameState, ownerId: string,
  sourceId: string, cardId: string
): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C034') {
    return updatePlayer(state, ownerId, p => ({
      ...p,
      crests: [...(p.crests ?? []), {
        id: 'C034', turnsRemaining: 3, usedElements: [],
      }],
    }))
  }
  if (cardId === 'C037') {
    return updatePlayer(state, ownerId, p => ({
      ...p,
      amulets: (p.amulets ?? []).map(a =>
        a.cardId === 'token-hydro-pressure-device'
          ? { ...a, turnsRemaining: a.turnsRemaining + 1 } : a),
    }))
  }
  if (cardId === 'C038') {
    return summonFollowers(state, ownerId, 'token-hydro-phantom', 1)
  }
  if (cardId === 'C039') {
    return summonFollowers(state, ownerId, 'token-hydro-jellyfish', 1)
  }
  if (cardId === 'C035' || cardId === 'C040') {
    return updatePlayer(state, ownerId, p => ({
      ...p,
      field: p.field.map(f => f.instanceId === sourceId ? {
        ...f,
        canAttack: f.hasAttacked ? f.canAttack : true,
        keywords: [...new Set([
          ...f.keywords.filter(k => k !== 'rush_only'),
          'rush', ...(f.canAttack ? [] : ['rush_only']),
          'double_attack', 'normal_attack_hydro',
        ])],
      } : f),
    }))
  }
  return state
}

export function resolveHydroAdvancedBurst(
  state: GameState, ownerId: string,
  sourceId: string, cardId: string,
  resolveDeaths: (s: GameState) => GameState
): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0 || state.winnerId !== null) return state
  if (cardId === 'C038') {
    let result = hitAllHydro(state, ownerId, 2, resolveDeaths)
    if (result.winnerId !== null) return result
    // Mark only followers still on the enemy field when the damage resolves.
    result = updatePlayer(result, result.players[1 - index].id, p => ({
      ...p,
      field: p.field.map(f => f.health > 0
        ? { ...f, keywords: [...f.keywords.filter(k => k !== 'next_damage_plus_2'),
            'next_damage_plus_2'] } : f),
    }))
    return result
  }
  if (cardId === 'C039') {
    return updatePlayer(state, ownerId, p => ({
      ...p,
      field: p.field.map(f => f.instanceId === sourceId ? {
        ...f, attack: f.attack + 2, canAttack: f.hasAttacked ? f.canAttack : true,
        keywords: [...new Set([...f.keywords.filter(k => k !== 'rush_only'),
          'guard', 'rush', ...(f.canAttack ? [] : ['rush_only']), 'attack_heal_2'])],
      } : f),
    }))
  }
  if (cardId === 'C040') {
    const attacker = state.players[index].field.find(f => f.instanceId === sourceId)
    const damage = attacker?.hasAttacked ? 5 : 3
    let result = hitAllHydro(state, ownerId, damage, resolveDeaths)
    if (result.winnerId !== null) return result
    result = dealLeaderDamage(result, 1 - index, damage)
    return result
  }
  return state
}

/** End-of-turn personal triggers, in stable follower layout order. */
export function resolveHydroAdvancedTurnEnd(
  state: GameState, ownerId: string,
  sourceId: string, resolveDeaths: (s: GameState) => GameState
): GameState {
  if (state.winnerId !== null) return state
  const player = state.players.find(p => p.id === ownerId)
  const source = player?.field.find(f => f.instanceId === sourceId && f.health > 0)
  if (!source) return state
  if (source.cardId === 'C034') {
    return updatePlayer(state, ownerId, p => ({
      ...p,
      field: p.field.map(f => f.health > 0 ? {
        ...f, health: Math.min(f.maxHealth, f.health + 1),
      } : f),
    }))
  }
  if (source.cardId === 'C039') {
    return updatePlayer(state, ownerId, p => ({
      ...p, ...healLeader(p, 2),
    }))
  }
  if (source.cardId === 'token-hydro-jellyfish') {
    let result = updatePlayer(state, ownerId, p => ({
      ...p,
      ...healLeader(p, 1),
      field: p.field.map(f => f.health > 0 ? {
        ...f, health: Math.min(f.maxHealth, f.health + 1),
      } : f),
    }))
    const i = result.players.findIndex(p => p.id === ownerId)
    const candidates = result.players[1 - i].field.filter(f => f.health > 0)
    if (candidates.length) {
      const victim = candidates[Math.floor(Math.random() * candidates.length)]
      result = captureFrame(resolveDeaths(hydroFollowerDamage(result, i, victim.instanceId, 1)), '水元素：ランダムダメージ')
    }
    return result
  }
  return state
}

/** Resolve existing Hydro crests and countdown amulets on their owner's turn end. */
export function resolveHydroPermanentsTurnEnd(
  state: GameState, ownerId: string,
  resolveDeaths: (s: GameState) => GameState
): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  let result = state
  const crestIds = (result.players[index].crests ?? [])
    .map((c, i) => ({ index: i, crest: c })).filter(x => x.crest.id === 'C034')
  for (const { index: crestIndex } of crestIds) {
    if (result.winnerId !== null) break
    result = updatePlayer(result, ownerId, p => ({
      ...p,
      ...healLeader(p, 3),
      leaderAura: (p.leaderAura ?? []).some(a => a.element === 'hydro')
        ? p.leaderAura : [...(p.leaderAura ?? []), { element: 'hydro' }],
      crests: (p.crests ?? []).map((c, i) => i === crestIndex ? {
        ...c, turnsRemaining: c.turnsRemaining - 1,
      } : c),
    }))
  }
  result = updatePlayer(result, ownerId, p => ({
    ...p, crests: (p.crests ?? []).filter(c => c.turnsRemaining > 0),
  }))

  const amuletIds = (result.players[index].amulets ?? [])
    .filter(a => a.cardId === 'token-hydro-pressure-device')
    .map(a => a.instanceId)
  for (const id of amuletIds) {
    if (result.winnerId !== null) break
    const owner = result.players[index]
    const amulet = (owner.amulets ?? []).find(a => a.instanceId === id)
    if (!amulet) continue
    const candidates = result.players[1 - index].field.filter(f => f.health > 0)
    if (candidates.length) {
      const victim = candidates[Math.floor(Math.random() * candidates.length)]
      result = resolveDeaths(hydroFollowerDamage(result, index, victim.instanceId, 1))
    }
    result = updatePlayer(result, ownerId, p => ({
      ...p,
      amulets: (p.amulets ?? []).map(a => a.instanceId === id
        ? { ...a, turnsRemaining: a.turnsRemaining - 1 } : a)
        .filter(a => a.turnsRemaining > 0),
    }))
  }
  return result
}

/** Phantom death deals hydro 2 to one random enemy follower. */
export function resolveHydroAdvancedDestroy(
  state: GameState, ownerId: string, destroyed: Follower
): GameState {
  if (state.winnerId !== null || destroyed.cardId !== 'token-hydro-phantom') return state
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  const choices = state.players[1 - index].field.filter(f => f.health > 0)
  if (!choices.length) return state
  const victim = choices[Math.floor(Math.random() * choices.length)]
  return hydroFollowerDamage(state, index, victim.instanceId, 2)
}

/** Kokomi's burst grants 'heal 2 on attack declaration'. */
export function resolveHydroAdvancedAttack(state: GameState, ownerId: string, sourceId: string): GameState {
  const player = state.players.find(p => p.id === ownerId)
  if (!player?.field.some(f => f.instanceId === sourceId &&
    f.health > 0 && f.keywords.includes('attack_heal_2'))) return state
  return updatePlayer(state, ownerId, p => ({
    ...p, ...healLeader(p, 2),
  }))
}
