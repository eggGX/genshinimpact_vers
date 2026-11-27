import { grantUniqueCrest } from './crestUtils'
import { captureFrame } from './presentation'
import type { Follower, GameState, Player } from './types'
import { summonFollowers } from './neutralRules'
import { getCard } from '../data/cardRegistry'
import { healLeader } from './leaderShield'
import { resolveElementalDamage, resolveReactionConsequence, resolveLeaderElementalHit } from './elemental'

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
  return resolveLeaderElementalHit(state, targetIndex, amount, element)
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

/** C124: deck contents are checked at fanfare resolution, not at deck construction. */
export function resolveNilouPlay(state: GameState, ownerId: string): GameState {
  if (state.winnerId !== null) return state
  const owner = state.players.find(p => p.id === ownerId)
  if (!owner || !owner.deck.every(id => {
    const element = getCard(id)?.element
    return element === 'none' || element === 'hydro' || element === 'dendro'
  })) return state
  return updatePlayer(state, ownerId, p => ({
    ...p,
    crests: (p.crests ?? []).some(crest => crest.id === 'C124') ||
      (p.crests ?? []).length >= 5
      ? (p.crests ?? [])
      : [...(p.crests ?? []), {
        id: 'C124', turnsRemaining: -1, usedElements: [],
      }],
  }))
}

/** Each individual skill hit is immediately followed by death/Last Word resolution. */
export function resolveNilouSkill(
  state: GameState, ownerId: string, sourceId: string,
  deaths: (state: GameState) => GameState,
): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0 || state.winnerId !== null) return state
  let result = state
  for (let n = 0; n < 3; n++) {
    if (result.winnerId !== null) break
    const candidates = result.players[1 - index].field.filter(f => f.health > 0)
    if (!candidates.length) break
    const target = candidates[Math.floor(Math.random() * candidates.length)]
    result = deaths(hydroFollowerDamage(result, index, target.instanceId, 1))
    result = captureFrame(result, '七域のダンス：水元素1ダメージ')
  }
  return updatePlayer(result, ownerId, p => ({
    ...p,
    field: p.field.map(f => f.instanceId === sourceId && f.health > 0
      ? { ...f, keywords: [...new Set([...f.keywords, 'nilou_engage_hydro'])] } : f),
  }))
}

/** Every follower present when the burst begins takes Hydro damage. */
export function resolveNilouBurst(
  state: GameState, ownerId: string,
  deaths: (state: GameState) => GameState,
): GameState {
  if (state.winnerId !== null) return state
  return hitAllHydro(state, ownerId, 2, deaths)
}

/** The granted encounter ability applies Hydro with 0 damage, allowing reactions.
 * Resolve on the attacker's and then the defender's side for turn priority. */
export function resolveNilouEngage(
  state: GameState, attackerId: string, defenderId: string,
  deaths: (state: GameState) => GameState,
): GameState {
  const activeIndex = state.players.findIndex(p => p.id === state.currentPlayerId)
  if (activeIndex < 0 || state.winnerId !== null) return state
  let result = state
  for (const [sourceIndex, sourceId, targetId] of [
    [activeIndex, attackerId, defenderId],
    [1 - activeIndex, defenderId, attackerId],
  ] as const) {
    if (result.winnerId !== null) break
    const source = result.players[sourceIndex].field.find(f => f.instanceId === sourceId && f.health > 0)
    if (!source?.keywords.includes('nilou_engage_hydro')) continue
    const affectedIndex = 1 - sourceIndex
    const target = result.players[affectedIndex].field.find(f => f.instanceId === targetId && f.health > 0)
    if (!target) continue
    const outcome = resolveElementalDamage(target, 0, 'hydro')
    const players = [...result.players] as [Player, Player]
    const affected = players[affectedIndex]
    players[affectedIndex] = { ...affected, field: affected.field.map(f =>
      f.instanceId === targetId ? outcome.follower : f),
    }
    result = resolveReactionConsequence({ ...result, players },
      affectedIndex, targetId, outcome.reaction, outcome.reactedElement, sourceIndex)
    result = deaths(result)
    result = captureFrame(result, 'ニィロウ：交戦時水元素付着')
  }
  return result
}

/** The core's self-destruction is handled by the engine's normal death pass.
 * The Last Word randomly hits its owner or one of their living followers. */
export function resolveBountifulCoreDestroy(
  state: GameState, ownerId: string,
): GameState {
  if (state.winnerId !== null) return state
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  const owner = state.players[index]
  const living = owner.field.filter(f => f.health > 0)
  const choice = Math.floor(Math.random() * (living.length + 1))
  if (choice === 0) return resolveLeaderElementalHit(state, index, 3, 'dendro', 1 - index)
  const target = living[choice - 1]
  const outcome = resolveElementalDamage(target, 3, 'dendro')
  const players = [...state.players] as [Player, Player]
  players[index] = { ...owner, field: owner.field.map(f =>
    f.instanceId === target.instanceId ? outcome.follower : f),
  }
  return resolveReactionConsequence({ ...state, players }, index, target.instanceId,
    outcome.reaction, outcome.reactedElement, 1 - index)
}

/** C118 chooses only among enemies with the greatest current attack.
 * This random effect does not select a target, so stealth/aura do not block it.
 * Deaths and existing Last Words go through the normal engine dispatcher. */
function destroyCardinalTarget(
  state: GameState, ownerId: string,
  resolveDeaths: (state: GameState) => GameState,
): GameState {
  if (state.winnerId !== null) return state
  const ownerIndex = state.players.findIndex(player => player.id === ownerId)
  if (ownerIndex < 0) return state
  const enemyIndex = 1 - ownerIndex
  const enemy = state.players[enemyIndex]
  const living = enemy.field.filter(follower => follower.health > 0)
  if (!living.length) return state
  const strongest = Math.max(...living.map(follower => follower.attack))
  const candidates = living.filter(follower => follower.attack === strongest)
  const victim = candidates[Math.floor(Math.random() * candidates.length)]
  const players = [...state.players] as [Player, Player]
  players[enemyIndex] = {
    ...enemy,
    field: enemy.field.map(follower => follower.instanceId === victim.instanceId
      ? { ...follower, health: 0 } : follower),
  }
  return resolveDeaths({ ...state, players })
}

/** Fanfare first places the amulet, then destroys the highest-attack enemy. */
export function resolveCardinalPlay(
  state: GameState, ownerId: string,
  resolveDeaths: (state: GameState) => GameState,
): GameState {
  if (state.winnerId !== null) return state
  const placed = updatePlayer(state, ownerId, player => ({
    ...player,
    amulets: [...(player.amulets ?? []), {
      instanceId: `cardinal-${nextHydroAmuletId++}`,
      cardId: 'C118',
      turnsRemaining: 2,
    }],
  }))
  return destroyCardinalTarget(captureFrame(placed, '諭示裁定カーディナル：設置'), ownerId, resolveDeaths)
}

/** Countdown advances at the end of its owner's turn, including its play turn.
 * On expiry the amulet leaves the board before its Last Word resolves. */
export function resolveCardinalTurnEnd(
  state: GameState, ownerId: string,
  resolveDeaths: (state: GameState) => GameState,
): GameState {
  const ids = (state.players.find(player => player.id === ownerId)?.amulets ?? [])
    .filter(amulet => amulet.cardId === 'C118')
    .map(amulet => amulet.instanceId)
  let result = state
  for (const id of ids) {
    if (result.winnerId !== null) break
    const owner = result.players.find(player => player.id === ownerId)
    const amulet = owner?.amulets?.find(item => item.instanceId === id)
    if (!amulet) continue
    const expires = amulet.turnsRemaining <= 1
    result = updatePlayer(result, ownerId, player => ({
      ...player,
      amulets: (player.amulets ?? []).flatMap(item => item.instanceId !== id
        ? [item]
        : expires ? [] : [{ ...item, turnsRemaining: item.turnsRemaining - 1 }]),
    }))
    if (expires) {
      result = captureFrame(result, '諭示裁定カーディナル：カウントダウン終了')
      result = destroyCardinalTarget(result, ownerId, resolveDeaths)
    }
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
      crests: grantUniqueCrest(p, {
        id: 'C034', turnsRemaining: 3, usedElements: [],
      }),
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
      crests: (p.crests ?? []).map((c, i) => i === crestIndex ? {
        ...c, turnsRemaining: c.turnsRemaining - 1,
      } : c),
    }))
    // Apply Hydro through the leader reaction resolver, not by replacing the aura.
    // For self-application, reactions such as Bloom belong on the affected side.
    result = resolveDeaths(resolveLeaderElementalHit(result, index, 0, 'hydro', 1 - index))
  }
  result = updatePlayer(result, ownerId, p => ({
    ...p, crests: (p.crests ?? []).filter(c => c.turnsRemaining !== 0),
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
