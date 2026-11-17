import type { Follower, GameState, Player } from './types'
import { addLeaderShield } from './leaderShield'
import { grantShield, resolveElementalDamage, resolveReactionConsequence, resolveLeaderElementalHit } from './elemental'
import { summonFollowers } from './neutralRules'

type DeathResolver = (s: GameState) => GameState

function edit(state: GameState, id: string, fn: (p: Player) => Player): GameState {
  const i = state.players.findIndex(p => p.id === id)
  if (i < 0) return state
  const players = [...state.players] as [Player, Player]
  players[i] = fn(players[i])
  return { ...state, players }
}

function cryoHit(state: GameState, ownerId: string, victimId: string, amount: number): GameState {
  const own = state.players.findIndex(p => p.id === ownerId)
  if (own < 0 || state.winnerId !== null) return state
  const foe = 1 - own
  const opponent = state.players[foe]
  const victim = opponent.field.find(f => f.instanceId === victimId && f.health > 0)
  if (!victim) return state
  const hit = resolveElementalDamage(victim, amount, 'cryo')
  const players = [...state.players] as [Player, Player]
  players[foe] = { ...opponent,
    field: opponent.field.map(f => f.instanceId === victimId ? hit.follower : f),
  }
  return resolveReactionConsequence({ ...state, players }, foe, victimId,
    hit.reaction, hit.reactedElement, own)
}

function cryoAll(state: GameState, ownerId: string, amount: number, deaths: DeathResolver): GameState {
  const own = state.players.findIndex(p => p.id === ownerId)
  if (own < 0) return state
  let result = state
  const ids = state.players[1 - own].field.filter(f => f.health > 0).map(f => f.instanceId)
  for (const id of ids) {
    if (result.winnerId !== null) break
    result = deaths(cryoHit(result, ownerId, id, amount))
  }
  return result
}

function randomCryo(state: GameState, ownerId: string, amount: number, deaths: DeathResolver): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0 || state.winnerId !== null) return state
  const candidates = state.players[1 - index].field.filter(f => f.health > 0)
  if (!candidates.length) return state
  const chosen = candidates[Math.floor(Math.random() * candidates.length)]
  return deaths(cryoHit(state, ownerId, chosen.instanceId, amount))
}

function addCrest(state: GameState, id: string, cardId: string): GameState {
  return edit(state, id, p => ({ ...p,
    crests: [...(p.crests ?? []), { id: cardId, turnsRemaining: 3, usedElements: [] }],
  }))
}

/** C044 buffs another existing ally (never itself); C049 shield and C052 draw. */
export function cryoPlay(state: GameState, ownerId: string, id: string, sourceId: string, targetId?: string): GameState {
  if (state.winnerId !== null) return state
  if (id === 'C044') return edit(state, ownerId, p => ({
    ...p, field: p.field.map(f =>
      targetId && targetId !== 'self' && f.instanceId === targetId && f.instanceId !== sourceId
        ? { ...f, attack: f.attack + 2 } : f),
  }))
  if (id === 'C049') return edit(state, ownerId, p => addLeaderShield(p, 2))
  if (id !== 'C052') return state
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  if (state.players[index].deck.length === 0) {
    return { ...state, winnerId: state.players[1 - index].id }
  }
  return edit(state, ownerId, p => {
    const [card, ...deck] = p.deck
    return { ...p, deck, hand: p.hand.length < 9 ? [...p.hand, card] : p.hand }
  })
}

/** Cryo silver spells. */
export function cryoSpell(state: GameState, ownerId: string, id: string, deaths: DeathResolver): GameState {
  if (state.winnerId !== null) return state
  if (id === 'C045') return addCrest(state, ownerId, 'C045')
  if (id !== 'C046') return state
  let result = edit(state, ownerId, p => ({
    ...addLeaderShield(p, 2),
    field: p.field.map(f => f.health > 0 ? grantShield(f, 'normal', 2) : f),
  }))
  result = cryoAll(result, ownerId, 1, deaths)
  return result
}

/** PP-cost skills. C049 receives one or two explicitly selected enemy IDs. */
export function cryoSkill(
  state: GameState, ownerId: string, cardId: string, sourceId: string,
  targetId: string | undefined, deaths: DeathResolver
): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C049') {
    const i = state.players.findIndex(p => p.id === ownerId)
    if (i < 0) return state
    const viable = state.players[1 - i].field.filter(f =>
      f.health > 0 && !f.keywords.includes('aura') && !f.keywords.includes('stealth'))
    const ids = (targetId?.split('|') ?? [])
      .filter(id => viable.some(f => f.instanceId === id))
    let result = state
    for (const id of ids) result = deaths(cryoHit(result, ownerId, id, 2))
    return edit(result, ownerId, p => addLeaderShield(p, 2))
  }
  if (cardId === 'C051') return edit(state, ownerId, p => addLeaderShield(p, 3))
  if (cardId === 'C052') return edit(state, state.players.find(p => p.id !== ownerId)?.id ?? '', p => ({
    ...p, field: p.field.map(f => f.instanceId === targetId && f.health > 0
      ? { ...f, attack: Math.max(0, f.attack - 1) } : f),
  }))
  if (cardId === 'C053') return summonFollowers(state, ownerId, 'token-cryo-ice-lotus', 1)
  if (cardId === 'C054') return summonFollowers(state, ownerId, 'token-cryo-itzpapa', 1)
  if (cardId === 'C055') {
    let result = cryoAll(state, ownerId, 1, deaths)
    result = edit(result, ownerId, p => ({
      ...p, field: p.field.map(f => f.instanceId === sourceId
        ? { ...f, keywords: [...new Set([...f.keywords, 'normal_attack_cryo'])] } : f),
    }))
    return result
  }
  return state
}

/** Cryo legendary bursts. */
export function cryoBurst(
  state: GameState, ownerId: string, cardId: string,
  deaths: DeathResolver
): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C053') return addCrest(cryoAll(state, ownerId, 2, deaths), ownerId, 'C053')
  if (cardId === 'C054') {
    return edit(cryoAll(state, ownerId, 3, deaths), ownerId, p => addLeaderShield(p, 3))
  }
  if (cardId === 'C055') {
    let result = state
    for (let n = 0; n < 5 && result.winnerId === null; n++) {
      result = randomCryo(result, ownerId, 2, deaths)
    }
    return result
  }
  return state
}

export function cryoTurnEnd(
  state: GameState, ownerId: string, sourceId: string,
  deaths: DeathResolver
): GameState {
  if (state.winnerId !== null) return state
  const source = state.players.find(p => p.id === ownerId)?.field.find(f => f.instanceId === sourceId)
  if (!source || source.health <= 0) return state
  if (source.cardId === 'C051') return randomCryo(state, ownerId, 1, deaths)
  if (source.cardId === 'C054') return edit(state, ownerId, p => addLeaderShield(p, 2))
  if (source.cardId === 'token-cryo-itzpapa') {
    const result = randomCryo(state, ownerId, 1, deaths)
    return edit(result, ownerId, p => addLeaderShield(p, 1))
  }
  return state
}

export function cryoCrestsEnd(state: GameState, ownerId: string, deaths: DeathResolver): GameState {
  const owner = state.players.find(p => p.id === ownerId)
  if (!owner) return state
  let result = state
  const active = (owner.crests ?? []).filter(c => ['C045', 'C053'].includes(c.id) && c.turnsRemaining > 0)
  for (const crest of active) {
    if (result.winnerId !== null) break
    for (let j = 0; j < 2 && result.winnerId === null; j++) {
      result = randomCryo(result, ownerId, 2, deaths)
    }
    result = edit(result, ownerId, p => ({
      ...p, crests: (p.crests ?? []).map(c => c === crest
        ? { ...c, turnsRemaining: c.turnsRemaining - 1 } : c)
        .filter(c => c.turnsRemaining > 0),
    }))
  }
  return result
}

export function cryoDestroy(
  state: GameState, ownerId: string, source: Follower, deaths: DeathResolver
): GameState {
  if (source.cardId !== 'token-cryo-ice-lotus') return state
  return cryoAll(state, ownerId, 1, deaths)
}

export function cryoAttack(state: GameState, ownerId: string, sourceId: string): GameState {
  const owner = state.players.find(p => p.id === ownerId)
  const source = owner?.field.find(f => f.instanceId === sourceId && f.health > 0)
  if (source?.cardId !== 'C053') return state
  const opponent = state.players.find(p => p.id !== ownerId)
  if (!opponent) return state
  return resolveLeaderElementalHit(state, state.players.findIndex(p=>p.id===opponent.id), 1, 'cryo')
}
