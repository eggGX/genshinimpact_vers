import { captureFrame } from './presentation'
import type { Follower, GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'
import { resolveLeaderElementalHit } from './elemental'
import { grantShield, resolveElementalDamage, resolveReactionConsequence } from './elemental'
import { summonFollowers } from './neutralRules'

type ResolveDeaths = (state: GameState) => GameState

function updatePlayer(state: GameState, ownerId: string, fn: (p: Player) => Player): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  const players = [...state.players] as [Player, Player]
  players[index] = fn(players[index])
  return { ...state, players }
}

function electroHitRandom(state: GameState, ownerId: string, amount: number): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0 || state.winnerId !== null) return state
  const foeIndex = 1 - index
  const foe = state.players[foeIndex]
  const candidates = foe.field.filter(f => f.health > 0)
  if (!candidates.length) return state
  const victim = candidates[Math.floor(Math.random() * candidates.length)]
  const hit = resolveElementalDamage(victim, amount, 'electro')
  const players = [...state.players] as [Player, Player]
  players[foeIndex] = { ...foe,
    field: foe.field.map(f => f.instanceId === victim.instanceId ? hit.follower : f),
  }
  return resolveReactionConsequence({ ...state, players }, foeIndex, victim.instanceId,
    hit.reaction, hit.reactedElement, index)
}

/** C057 random electro last word; C059 electro damage to opposing leader. */
export function electroDestroy(
  state: GameState, ownerId: string, destroyed: Follower
): GameState {
  if (state.winnerId !== null) return state
  if (destroyed.cardId === 'C057') return captureFrame(electroHitRandom(state, ownerId, 2), 'グルグル雷キノコン：ラストワード・雷元素2ダメージ')
  if (destroyed.cardId !== 'C059') return state
  const enemy = state.players.find(p => p.id !== ownerId)
  if (!enemy) return state
  return captureFrame(resolveLeaderElementalHit(state, state.players.findIndex(p => p.id === enemy.id), 2, 'electro'), '雷フライム：ラストワード・雷元素2ダメージ')
}

/** C060 spell summons Oz after resolving its selected damage, if space remains. */
export function electroSpell(state: GameState, ownerId: string, cardId: string): GameState {
  if (state.winnerId !== null || cardId !== 'C060') return state
  return summonFollowers(state, ownerId, 'token-oz', 1)
}

/** C062 summons two Electro Cicins with the existing shared board capacity. */
export function electroPlay(state: GameState, ownerId: string, cardId: string): GameState {
  if (state.winnerId !== null || cardId !== 'C062') return state
  return summonFollowers(state, ownerId, 'token-electro-cicin', 2)
}

/** C062 conditional end-turn shield; Oz random electro 3. */
export function electroTurnEnd(
  state: GameState, ownerId: string, sourceId: string, deaths: ResolveDeaths
): GameState {
  if (state.winnerId !== null) return state
  const owner = state.players.find(p => p.id === ownerId)
  const source = owner?.field.find(f => f.instanceId === sourceId && f.health > 0)
  if (!source) return state
  if (source.cardId === 'C062') {
    if (!owner?.field.some(f => f.cardId === 'token-electro-cicin' && f.health > 0)) return state
    return updatePlayer(state, ownerId, p => ({
      ...p, field: p.field.map(f => f.instanceId === sourceId ? grantShield(f, 'normal', 2) : f),
    }))
  }
  if (source.cardId === 'token-oz') return captureFrame(deaths(electroHitRandom(state, ownerId, 3)), 'オズ：ランダム雷3ダメージ')
  return state
}

/** C063 attack declaration: non-elemental 1 damage to opposing leader. */
export function electroAttack(state: GameState, ownerId: string, attackerId: string): GameState {
  if (state.winnerId !== null) return state
  const own = state.players.find(p => p.id === ownerId)
  const attacker = own?.field.find(f => f.instanceId === attackerId && f.health > 0)
  if (!attacker || getCard(attacker.cardId)?.id !== 'C063') return state
  const enemy = state.players.find(p => p.id !== ownerId)
  if (!enemy) return state
  return resolveLeaderElementalHit(state, state.players.findIndex(p => p.id === enemy.id), 1)
}
