import { captureFrame } from './presentation'
import type { GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'
import { damageLeader, healLeader } from './leaderShield'
import { resolveElementalDamage, resolveReactionConsequence, absorbDamage } from './elemental'
import { summonFollowers } from './neutralRules'

type DeathResolver = (state: GameState) => GameState
let nextSakuraId = 1

function edit(state: GameState, id: string, fn: (p: Player) => Player): GameState {
  const i = state.players.findIndex(p => p.id === id)
  if (i < 0) return state
  const players = [...state.players] as [Player, Player]
  players[i] = fn(players[i])
  return { ...state, players }
}

function hit(state: GameState, ownerId: string, targetId: string, value: number): GameState {
  const i = state.players.findIndex(p => p.id === ownerId)
  if (i < 0 || state.winnerId !== null) return state
  const j = 1 - i
  const opponent = state.players[j]
  const target = opponent.field.find(f => f.instanceId === targetId && f.health > 0)
  if (!target) return state
  const outcome = resolveElementalDamage(target, value, 'electro')
  const players = [...state.players] as [Player, Player]
  players[j] = { ...opponent,
    field: opponent.field.map(f => f.instanceId === targetId ? outcome.follower : f) }
  return resolveReactionConsequence({ ...state, players }, j, targetId,
    outcome.reaction, outcome.reactedElement, i)
}

function randomHit(
  state: GameState, ownerId: string, value: number, deaths: DeathResolver,
  excluding?: string
): GameState {
  const opponent = state.players.find(p => p.id !== ownerId)
  const targets = opponent?.field.filter(f => f.health > 0 && f.instanceId !== excluding) ?? []
  if (!targets.length || state.winnerId !== null) return state
  return captureFrame(deaths(hit(state, ownerId, targets[Math.floor(Math.random() * targets.length)].instanceId, value)), 'ランダム雷元素ダメージ')
}

function allHit(state: GameState, ownerId: string, value: number, deaths: DeathResolver): GameState {
  const opponent = state.players.find(p => p.id !== ownerId)
  const ids = opponent?.field.filter(f => f.health > 0).map(f => f.instanceId) ?? []
  let result = state
  for (const id of ids) {
    if (result.winnerId !== null) break
    result = deaths(hit(result, ownerId, id, value))
  }
  return result
}

export function advancedElectroSpell(
  state: GameState, ownerId: string, cardId: string, deaths: DeathResolver
): GameState {
  if (cardId !== 'C061' || state.winnerId !== null) return state
  const owner = state.players.find(p => p.id === ownerId)
  let result = state
  for (let n = 0; n < (owner && owner.leaderHealth <= 10 ? 5 : 3); n++) {
    result = randomHit(result, ownerId, 1, deaths)
  }
  return result
}

export function advancedElectroPlay(
  state: GameState, ownerId: string, cardId: string, sourceId: string,
  targetId?: string
): GameState {
  if (cardId !== 'C066' || state.winnerId !== null || !targetId) return state
  return edit(state, ownerId, p => ({
    ...p, field: p.field.map(f => f.instanceId === targetId && f.instanceId !== sourceId
      && getCard(f.cardId)?.element === 'electro'
      ? { ...f, attack: f.attack + 1 } : f),
  }))
}

export function advancedElectroSkill(
  state: GameState, ownerId: string, sourceId: string, cardId: string,
  targetId: string | undefined, deaths: DeathResolver
): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C064') return summonFollowers(state, ownerId, 'token-oz', 1)
  if (cardId === 'C065') {
    const owner = state.players.find(p => p.id === ownerId)
    const source = owner?.field.find(f => f.instanceId === sourceId)
    if (!source) return state
    let result = edit(state, ownerId, p => ({
      ...p, field: p.field.map(f => f.instanceId === sourceId ? absorbDamage(f, 1) : f),
    }))
    result = deaths(result)
    if (result.winnerId !== null) return result
    result = edit(result, ownerId, p => ({
      ...p, ...healLeader(p, 2),
    }))
    return randomHit(result, ownerId, 1, deaths)
  }
  if (cardId === 'C066') {
    let result = edit(state, ownerId, p => ({
      ...p, field: p.field.map(f => f.instanceId === targetId
        && getCard(f.cardId)?.element === 'electro' && f.health > 0
        ? { ...f, attack: f.attack + 2 } : f),
    }))
    result = randomHit(result, ownerId, 1, deaths)
    return result
  }
  if (cardId === 'C067') return randomHit(state, ownerId, 1, deaths, targetId)
  if (cardId === 'C069') {
    return edit(state, ownerId, p => {
      if (p.field.length + (p.amulets?.length ?? 0) >= 5) return p
      return { ...p, amulets: [...(p.amulets ?? []), {
        instanceId: `sakura-${nextSakuraId++}`,
        cardId: 'token-sesshou-sakura',
        turnsRemaining: 3,
      }] }
    })
  }
  if (cardId === 'C070') return edit(state, ownerId, p => ({
    ...p, field: p.field.map(f => f.instanceId === sourceId
      ? { ...f, keywords: [...new Set([...f.keywords, 'normal_attack_electro', 'plunge_attack'])] }
      : f),
  }))
  return state
}

export function advancedElectroBurst(
  state: GameState, ownerId: string, sourceId: string, cardId: string,
  deaths: DeathResolver
): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C068') return edit(state, ownerId, p => ({
    ...p, field: p.field.map(f => f.instanceId === sourceId ? {
      ...f, attack: f.attack + 2, health: f.health + 2, maxHealth: f.maxHealth + 2,
      keywords: [...new Set([...f.keywords, 'double_attack', 'normal_attack_electro'])],
    } : f),
  }))
  if (cardId === 'C069') {
    let result = allHit(state, ownerId, 3, deaths)
    if (result.winnerId !== null) return result
    const amount = result.players.find(p => p.id === ownerId)?.amulets
      ?.filter(a => a.cardId === 'token-sesshou-sakura').length ?? 0
    result = edit(result, ownerId, p => ({
      ...p, amulets: (p.amulets ?? []).filter(a => a.cardId !== 'token-sesshou-sakura'),
    }))
    for (let i = 0; i < amount && result.winnerId === null; i++) {
      const enemy = result.players.find(p => p.id !== ownerId)!
      const options = enemy.field.filter(f => f.health > 0)
      const index = Math.floor(Math.random() * (options.length + 1))
      if (index === options.length) {
        const damaged = damageLeader(enemy, 2)
        result = edit(result, enemy.id, () => damaged)
        if (damaged.leaderHealth === 0) result = { ...result, winnerId: ownerId }
      } else {
        result = deaths(hit(result, ownerId, options[index].instanceId, 2))
      }
    }
    return result
  }
  if (cardId === 'C070') {
    const result = allHit(state, ownerId, 3, deaths)
    if (result.winnerId !== null) return result
    return edit(result, ownerId, p => ({
      ...p, field: p.field.map(f => f.instanceId === sourceId
        ? { ...f, attack: f.attack + 2 } : f),
    }))
  }
  return state
}

export function advancedElectroTurnEnd(
  state: GameState, ownerId: string, sourceId: string
): GameState {
  if (state.winnerId !== null) return state
  const owner = state.players.find(p => p.id === ownerId)
  const source = owner?.field.find(f => f.instanceId === sourceId && f.health > 0)
  if (!source) return state
  if (source.cardId === 'C064') {
    const os = owner!.field.filter(f => f.cardId === 'token-oz' && f.health > 0)
    if (!os.length) return state
    const selected = os[Math.floor(Math.random() * os.length)]
    return edit(state, ownerId, p => ({
      ...p, field: p.field.map(f => f.instanceId === selected.instanceId
        ? { ...f, keywords: [...new Set([...f.keywords, 'stealth'])] } : f),
    }))
  }
  if (source.cardId === 'C065') return edit(state, ownerId, p => ({
    ...p, ...healLeader(p, 1),
  }))
  return state
}

/** Resolve Sakura in placement order then decrement countdown, discard at zero. */
export function electroAmuletsTurnEnd(
  state: GameState, ownerId: string, deaths: DeathResolver
): GameState {
  let result = state
  const ids = (state.players.find(p => p.id === ownerId)?.amulets ?? [])
    .filter(a => a.cardId === 'token-sesshou-sakura').map(a => a.instanceId)
  for (const id of ids) {
    if (result.winnerId !== null) break
    result = randomHit(result, ownerId, 2, deaths)
    result = edit(result, ownerId, p => ({
      ...p, amulets: (p.amulets ?? []).map(a => a.instanceId === id
        ? { ...a, turnsRemaining: a.turnsRemaining - 1 } : a)
        .filter(a => a.turnsRemaining > 0),
    }))
  }
  return result
}

/** Attack declaration buff and after-attack plunge are distinct timing windows. */
export function advancedElectroAttack(
  state: GameState, ownerId: string, attackerId: string
): GameState {
  const source = state.players.find(p => p.id === ownerId)?.field
    .find(f => f.instanceId === attackerId && f.health > 0)
  if (source?.cardId !== 'C070') return state
  return edit(state, ownerId, p => ({
    ...p, field: p.field.map(f => f.instanceId === attackerId
      ? { ...f, attack: f.attack + 1 } : f),
  }))
}

export function advancedElectroAttackAfter(
  state: GameState, ownerId: string, attackerId: string, deaths: DeathResolver
): GameState {
  const source = state.players.find(p => p.id === ownerId)?.field
    .find(f => f.instanceId === attackerId)
  if (!source?.keywords.includes('plunge_attack') || state.winnerId !== null) return state
  const normalElement = source.keywords.includes('normal_attack_electro')
    ? 'electro' : getCard(source.cardId)?.normalAttackElement
  if (normalElement !== 'electro') return state
  return allHit(state, ownerId, 1, deaths)
}
