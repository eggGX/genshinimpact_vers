import { captureFrame } from './presentation'
import type { ElementType, Follower, GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'
import { damageLeader } from './leaderShield'
import { absorbDamage, resolveElementalDamage, resolveReactionConsequence, resolveLeaderElementalHit } from './elemental'
import { summonFollowers } from './neutralRules'

type DeathResolver = (state: GameState) => GameState
type Element = 'pyro' | 'hydro' | 'cryo' | 'electro'
const selectable: Element[] = ['pyro', 'hydro', 'cryo', 'electro']
let nextAnemoAmulet = 1
function edit(state: GameState, id: string, fn: (p: Player) => Player): GameState {
  const i = state.players.findIndex(p => p.id === id)
  if (i < 0) return state
  const players = [...state.players] as [Player, Player]
  players[i] = fn(players[i])
  return { ...state, players }
}
function validEnemy(state: GameState, ownerId: string): Follower[] {
  return state.players.find(p => p.id !== ownerId)?.field.filter(f => f.health > 0) ?? []
}
function hit(state: GameState, ownerId: string, targetId: string, damage: number, element: ElementType): { state: GameState, swirl?: Element } {
  const i = state.players.findIndex(p => p.id === ownerId)
  if (i < 0 || state.winnerId !== null) return { state }
  const j = 1 - i
  const foe = state.players[j]
  const target = foe.field.find(f => f.instanceId === targetId && f.health > 0)
  if (!target) return { state }
  const outcome = resolveElementalDamage(target, damage, element)
  const players = [...state.players] as [Player, Player]
  players[j] = { ...foe, field: foe.field.map(f => f.instanceId === targetId ? outcome.follower : f) }
  return {
    state: resolveReactionConsequence({ ...state, players }, j, targetId,
      outcome.reaction, outcome.reactedElement, i),
    swirl: outcome.reaction === 'swirl' && selectable.includes(outcome.reactedElement as Element)
      ? outcome.reactedElement as Element : undefined,
  }
}
function allHit(state: GameState, ownerId: string, damage: number, element: ElementType, deaths: DeathResolver): GameState {
  let result = state
  for (const id of validEnemy(state, ownerId).map(f => f.instanceId)) {
    if (result.winnerId !== null) break
    result = deaths(hit(result, ownerId, id, damage, element).state)
  }
  return result
}
function randomHit(state: GameState, ownerId: string, damage: number, element: ElementType, deaths: DeathResolver): GameState {
  const opponents = validEnemy(state, ownerId)
  if (!opponents.length) return state
  const chosen = opponents[Math.floor(Math.random() * opponents.length)]
  return captureFrame(deaths(hit(state, ownerId, chosen.instanceId, damage, element).state), 'ランダム風元素ダメージ')
}
function randomOpponentHit(state: GameState, ownerId: string, value: number, deaths: DeathResolver): GameState {
  const foe = state.players.find(p => p.id !== ownerId)
  if (!foe || state.winnerId !== null) return state
  const options = foe.field.filter(f => f.health > 0)
  const random = Math.floor(Math.random() * (options.length + 1))
  if (random < options.length) return captureFrame(deaths(hit(state, ownerId, options[random].instanceId, value, 'anemo').state), 'ランダム風元素ダメージ')
  return resolveLeaderElementalHit(state, state.players.findIndex(p=>p.id===foe.id), value, 'anemo')
}

export function advancedAnemoSpell(state: GameState, ownerId: string, cardId: string): GameState {
  if (cardId !== 'C075' || state.winnerId !== null) return state
  return summonFollowers(state, ownerId, 'token-surprising-cat-box', 1)
}
export function advancedAnemoAmuletPlay(state: GameState, ownerId: string, cardId: string): GameState {
  if (cardId !== 'C076' || state.winnerId !== null) return state
  return edit(state, ownerId, p => ({
    ...p, amulets: [...(p.amulets ?? []), { instanceId: `anemo-amulet-${nextAnemoAmulet++}`,
      cardId: 'C076', turnsRemaining: 3 }],
  }))
}
export function advancedAnemoPlay(state: GameState, ownerId: string, cardId: string, sourceId: string, targetId?: string): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C078') {
    const foe = state.players.find(p => p.id !== ownerId)
    return foe ? edit(state, foe.id, p => ({ ...p, bondOfLife: (p.bondOfLife ?? 0) + 3 })) : state
  }
  if (cardId === 'C081') {
    return edit(state, ownerId, p => ({
      ...p, field: p.field.map(f => f.instanceId === targetId && f.instanceId !== sourceId &&
        getCard(f.cardId)?.element === 'anemo'
        ? { ...f, attack: f.attack + 1 } : f),
    }))
  }
  if (cardId === 'C083') {
    return edit(state, ownerId, p => {
      const west = p.deck.map((id, i) => ({ id, i })).filter(x => {
        const c = getCard(x.id)
        return c?.type === 'follower' && c.traits?.includes('西風騎士団')
      })
      const pick = west[Math.floor(Math.random() * west.length)]
      return pick ? { ...p,
        deck: p.deck.filter((_, i) => i !== pick.i),
        hand: p.hand.length < 9 ? [...p.hand, pick.id] : p.hand,
      } : p
    })
  }
  return state
}
export function advancedAnemoSkill(
  state: GameState, ownerId: string, cardId: string, sourceId: string, targetId: string | undefined, deaths: DeathResolver
): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C079') return allHit(state, ownerId, 1, 'anemo', deaths)
  if (cardId === 'C081') return edit(state, ownerId, p => ({
    ...p, field: p.field.map(f => f.health > 0 && getCard(f.cardId)?.element === 'anemo'
      ? { ...f, attack: f.attack + 1 } : f),
  }))
  if (cardId === 'C083') {
    const handIndex = targetId?.startsWith('hand:') ? Number(targetId.slice(5)) : -1
    const chosen = state.players.find(p => p.id === ownerId)?.hand[handIndex]
    const element = chosen ? getCard(chosen)?.element : undefined
    if (!element || !selectable.includes(element as Element)) return state
    return edit(state, ownerId, p => ({
      ...p, hand: p.hand.filter((_, i) => i !== handIndex),
      graveyard: [...p.graveyard, chosen!],
      field: p.field.map(f => f.instanceId === sourceId
        ? { ...f, keywords: [...f.keywords.filter(k => !k.startsWith('normal_attack_') &&
            !k.startsWith('varka_element_')), `normal_attack_${element}`, `varka_element_${element}`] }
        : f),
    }))
  }
  if (cardId === 'C085') return edit(state, ownerId, p => ({
    ...p, field: p.field.map(f => f.instanceId === sourceId
      ? { ...f, attack: f.attack + 2, canAttack: true,
        keywords: [...new Set([...f.keywords, 'storm', 'wanderer_temporary_storm'])] } : f),
  }))
  return state
}
export function advancedAnemoBurst(
  state: GameState, ownerId: string, cardId: string, sourceId: string, deaths: DeathResolver
): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C083') return allHit(state, ownerId, 2, 'anemo', deaths)
  if (cardId === 'C084') return edit(state, ownerId, p => ({
    ...p, field: p.field.map(f => f.instanceId === sourceId
      ? { ...f, attack: f.attack + 2, health: f.health + 2, maxHealth: f.maxHealth + 2,
        canAttack: true, keywords: [...new Set([...f.keywords, 'storm', 'plunge_attack',
          'normal_attack_anemo', 'xiao_burst_self_damage'])] } : f),
  }))
  if (cardId === 'C085') {
    let result = state
    for (let i = 0; i < 5 && result.winnerId === null; i++) {
      result = randomOpponentHit(result, ownerId, 2, deaths)
    }
    return result
  }
  return state
}
export function advancedAnemoTurnEnd(state: GameState, ownerId: string, sourceId: string, deaths: DeathResolver): GameState {
  const source = state.players.find(p => p.id === ownerId)?.field.find(f => f.instanceId === sourceId && f.health > 0)
  if (!source || state.winnerId !== null) return state
  if (source.cardId === 'token-surprising-cat-box') return randomHit(state, ownerId, 2, 'anemo', deaths)
  if (source.cardId === 'C084' && source.keywords.includes('xiao_burst_self_damage')) {
    let next = edit(state, ownerId, p => ({
      ...p, field: p.field.map(f => f.instanceId === sourceId ? absorbDamage(f, 1) : f),
    }))
    next = deaths(next)
    const owner = next.players.find(p => p.id === ownerId)
    if (!owner) return next
    const damaged = damageLeader(owner, 1)
    next = edit(next, ownerId, () => damaged)
    return damaged.leaderHealth <= 0 ? { ...next, winnerId: next.players.find(p => p.id !== ownerId)?.id ?? null } : next
  }
  return state
}
export function advancedAnemoBothTurnEnd(state: GameState, deaths: DeathResolver): GameState {
  let result = state
  for (const player of state.players) {
    for (const source of player.field) {
      if (result.winnerId !== null) break
      if (source.cardId !== 'C078') continue
      if (!result.players.find(p => p.id === player.id)?.field.some(f => f.instanceId === source.instanceId && f.health > 0)) continue
      const target = result.players.find(p => p.id !== player.id)
      if (!target?.bondOfLife) continue
      const damaged = damageLeader(target, 1)
      result = edit(result, target.id, () => damaged)
      if (damaged.leaderHealth === 0) result = { ...result, winnerId: player.id }
    }
  }
  return deaths(result)
}
export function advancedAnemoAmuletsTurnEnd(state: GameState, ownerId: string, deaths: DeathResolver): GameState {
  let result = state
  const ids = (state.players.find(p => p.id === ownerId)?.amulets ?? [])
    .filter(a => a.cardId === 'C076').map(a => a.instanceId)
  for (const id of ids) {
    if (result.winnerId !== null) break
    const owner = result.players.find(p => p.id === ownerId)
    const amulet = owner?.amulets?.find(a => a.instanceId === id)
    if (!amulet) continue
    let firstSwirl: Element | undefined
    let remembered = amulet.recordedElement
    for (const foe of validEnemy(result, ownerId).map(f => f.instanceId)) {
      const outcome = hit(result, ownerId, foe, 1, 'anemo')
      result = deaths(outcome.state)
      if (!firstSwirl && outcome.swirl) firstSwirl = outcome.swirl
    }
    if (!remembered && firstSwirl) remembered = firstSwirl
    if (remembered) result = allHit(result, ownerId, 1, remembered, deaths)
    result = edit(result, ownerId, p => ({
      ...p, amulets: (p.amulets ?? []).map(a => a.instanceId === id
        ? { ...a, recordedElement: remembered, turnsRemaining: a.turnsRemaining - 1 } : a)
        .filter(a => a.turnsRemaining > 0),
    }))
  }
  return result
}
/** On attack, Varka raises all West Wind Knights including himself by +1/+1. */
export function advancedAnemoAttack(state: GameState, ownerId: string, attackerId: string): GameState {
  const source = state.players.find(p => p.id === ownerId)?.field.find(f => f.instanceId === attackerId)
  if (source?.cardId !== 'C083') return state
  return edit(state, ownerId, p => ({
    ...p, field: p.field.map(f => f.health > 0 && getCard(f.cardId)?.traits?.includes('西風騎士団')
      ? { ...f, attack: f.attack + 1, health: f.health + 1, maxHealth: f.maxHealth + 1 } : f),
  }))
}
/** After a completed Varka attack, replace pyro/hydro/cryo/electro attacks with Anemo until end of turn. */
export function advancedAnemoAttackAfter(state: GameState, ownerId: string, attackerId: string): GameState {
  const source = state.players.find(p => p.id === ownerId)?.field.find(f => f.instanceId === attackerId)
  if (source?.cardId !== 'C083' || state.winnerId !== null) return state
  if (!source.keywords.some(k => selectable.some(el => k === `normal_attack_${el}`))) return state
  return edit(state, ownerId, p => ({
    ...p, field: p.field.map(f => f.instanceId === attackerId
      ? { ...f, keywords: [...f.keywords.filter(k => !k.startsWith('normal_attack_')),
        'normal_attack_anemo', 'varka_temp_anemo'] } : f),
  }))
}
export function resetAnemoTurnStatuses(state: GameState, ownerId: string): GameState {
  return edit(state, ownerId, p => ({
    ...p, field: p.field.map(f => {
      const keywords = f.keywords.filter(k => !['wanderer_temporary_storm', 'varka_temp_anemo'].includes(k))
      if (f.keywords.includes('wanderer_temporary_storm')) {
        const stormless = keywords.filter(k => k !== 'storm')
        if (f.cardId === 'C085') return { ...f, keywords: stormless }
      }
      if (f.keywords.includes('varka_temp_anemo')) {
        const chosen = keywords.find(k => k.startsWith('varka_element_'))?.slice(14)
        return { ...f, keywords: [...keywords.filter(k => k !== 'normal_attack_anemo'),
          ...(chosen ? [`normal_attack_${chosen}`] : [])] }
      }
      return { ...f, keywords }
    }),
  }))
}

/** Cat-box engages an elemental opponent: pre-combat elemental damage to that opponent. */
export function catBoxEngage(
  state: GameState, ownerId: string, attackerId: string, defenderId: string,
  deaths: DeathResolver
): GameState {
  const owner = state.players.find(p => p.id === ownerId)
  const opponent = state.players.find(p => p.id !== ownerId)
  if (!owner || !opponent || state.winnerId !== null) return state
  const attacker = owner.field.find(f => f.instanceId === attackerId)
  const defender = opponent.field.find(f => f.instanceId === defenderId)
  if (!attacker || !defender) return state
  const boxOnDefence = defender.cardId === 'token-surprising-cat-box'
  const boxOnAttack = attacker.cardId === 'token-surprising-cat-box'
  if (!boxOnDefence && !boxOnAttack) return state
  const target = boxOnDefence ? attacker : defender
  const element = getCard(target.cardId)?.element
  if (!element || !selectable.includes(element as Element)) return state
  const boxOwnerId = boxOnDefence ? opponent.id : owner.id
  const outcome = resolveElementalDamage(target, 2, element)
  const affectedIndex = state.players.findIndex(p => p.id === (boxOnDefence ? owner.id : opponent.id))
  const players = [...state.players] as [Player, Player]
  players[affectedIndex] = { ...players[affectedIndex],
    field: players[affectedIndex].field.map(f => f.instanceId === target.instanceId
      ? outcome.follower : f) }
  let result = resolveReactionConsequence({ ...state, players },
    affectedIndex, target.instanceId, outcome.reaction, outcome.reactedElement,
    state.players.findIndex(p => p.id === boxOwnerId))
  result = deaths(result)
  return result
}
