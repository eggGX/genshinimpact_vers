import { captureFrame } from './presentation'
import type { GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'
import { addLeaderShield, healLeader, damageLeader } from './leaderShield'
import { grantShield, resolveElementalDamage, resolveReactionConsequence } from './elemental'
import { summonFollowers } from './neutralRules'

let nextLiyueHarborId = 1
let nextGeoConstructId = 1

/** Only actual crystallize gains during Navia's own turn count, up to 3. */
export function gainGeoCrystallize(state: GameState, ownerId: string, amount: number): GameState {
  if (state.winnerId !== null) return state
  return update(state, ownerId, p => {
    const before = p.leaderShield?.crystallize ?? 0
    const shielded = addLeaderShield(p, amount, 'crystallize')
    if (state.currentPlayerId !== ownerId || (shielded.leaderShield?.crystallize ?? 0) <= before) return shielded
    return { ...shielded, field: shielded.field.map(f => f.cardId === 'C099' && f.health > 0 &&
      (f.geoShieldTriggersThisTurn ?? 0) < 3 ? {
        ...f, attack: f.attack + 1,
        geoShieldTriggersThisTurn: (f.geoShieldTriggersThisTurn ?? 0) + 1,
      } : f) }
  })
}


/** Geo constructs are 3-turn countdown amulets per Ver.1.0.1. */
function createGeoConstruct(state: GameState, ownerId: string, cardId: string): GameState {
  return update(state, ownerId, p => {
    if (p.field.length + (p.amulets?.length ?? 0) >= 5) return p
    return { ...p, amulets: [...(p.amulets ?? []), {
      instanceId: `geo-construct-${nextGeoConstructId++}`,
      cardId, turnsRemaining: 3,
    }] }
  })
}


function update(state: GameState, ownerId: string, modify: (p: Player) => Player): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  const players = [...state.players] as [Player, Player]
  players[index] = modify(players[index])
  return { ...state, players }
}

/** C087 Liyue Harbor: a three-turn countdown tutor amulet. */
export function geoAmuletPlay(state: GameState, ownerId: string, cardId: string): GameState {
  if (cardId !== 'C087' || state.winnerId !== null) return state
  return update(state, ownerId, p => ({ ...p,
    amulets: [...(p.amulets ?? []), {
      instanceId: `liyue-harbor-${nextLiyueHarborId++}`,
      cardId: 'C087', turnsRemaining: 3,
    }],
  }))
}

/** Geo amulets resolve in the order they occupy the field, then tick down. */
export function geoAmuletsTurnEnd(
  state: GameState, ownerId: string,
  deaths: (s: GameState) => GameState
): GameState {
  if (state.winnerId !== null) return state
  const ids = (state.players.find(p => p.id === ownerId)?.amulets ?? [])
    .filter(a => ['C087', 'token-jade-screen', 'token-spinning-turbo',
      'token-solar-isotoma'].includes(a.cardId)).map(a => a.instanceId)
  let result = state
  for (const id of ids) {
    if (result.winnerId !== null) break
    const owner = result.players.find(p => p.id === ownerId)
    const amulet = owner?.amulets?.find(a => a.instanceId === id)
    if (!amulet) continue
    if (amulet.cardId === 'C087') {
      result = update(result, ownerId, p => {
        const matches = p.deck.map((cardId, index) => ({ cardId, index }))
          .filter(({ cardId }) => getCard(cardId)?.region?.includes('璃月'))
        const chosen = matches[Math.floor(Math.random() * matches.length)]
        return { ...p,
          deck: chosen ? p.deck.filter((_, i) => i !== chosen.index) : p.deck,
          hand: chosen && p.hand.length < 9 ? [...p.hand, chosen.cardId] : p.hand,
        }
      })
    } else if (amulet.cardId === 'token-jade-screen') {
      result = gainGeoCrystallize(result, ownerId, 2)
    } else {
      const index = result.players.findIndex(p => p.id === ownerId)
      const enemy = result.players[1-index]
      const targets = enemy.field.filter(f => f.health > 0)
      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)]
        const damage = amulet.cardId === 'token-spinning-turbo' ? 2 : 1
        const hit = resolveElementalDamage(target, damage, 'geo')
        const changed = update(result, enemy.id, p => ({
          ...p, field: p.field.map(f => f.instanceId === target.instanceId ? hit.follower : f),
        }))
        result = captureFrame(deaths(resolveReactionConsequence(changed, 1-index, target.instanceId,
          hit.reaction, hit.reactedElement, index)), '岩創造物：ランダム岩元素ダメージ')
      }
      if (result.winnerId === null && amulet.cardId === 'token-solar-isotoma') {
        result = gainGeoCrystallize(result, ownerId, 1)
      }
    }
    if (result.winnerId !== null) break
    result = update(result, ownerId, p => ({
      ...p, amulets: (p.amulets ?? []).map(a => a.instanceId === id
        ? { ...a, turnsRemaining: a.turnsRemaining - 1 } : a)
        .filter(a => a.turnsRemaining > 0),
    }))
  }
  return result
}

/** C096 Gorou: play buff includes Gorou and all existing Geo followers. */
export function geoPlay(state: GameState, ownerId: string, cardId: string): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C095' || cardId === 'C097') {
    return gainGeoCrystallize(state, ownerId, 2)
  }
  if (cardId === 'C098') {
    const p=state.players.find(p=>p.id===ownerId)
    const constructs=['token-jade-screen','token-spinning-turbo','token-solar-isotoma']
    return p && ((p.amulets??[]).some(a=>constructs.includes(a.cardId)) || p.field.some(f=>f.health>0 && constructs.includes(f.cardId)))
      ? summonFollowers(state,ownerId,'token-tamoto',1) : state
  }
  if (cardId !== 'C096') return state
  return update(state, ownerId, p => ({
    ...p, field: p.field.map(f => getCard(f.cardId)?.element === 'geo' && f.health > 0
      ? { ...f, health: f.health + 1, maxHealth: f.maxHealth + 1 } : f),
  }))
}

/** C094 Noelle shields herself and her leader; C096 buffs every friendly Geo follower. */
export function geoSkill(state: GameState, ownerId: string, sourceId: string, cardId: string): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C095') return createGeoConstruct(state, ownerId, 'token-jade-screen')
  if (cardId === 'C097') return createGeoConstruct(state, ownerId, 'token-spinning-turbo')
  if (cardId === 'C100') return createGeoConstruct(state, ownerId, 'token-solar-isotoma')
  if (cardId === 'C098') return summonFollowers(state,ownerId,'token-tamoto',1)
  if (cardId === 'C094') return update(state, ownerId, p => ({
    ...addLeaderShield(p, 3),
    field: p.field.map(f => f.instanceId === sourceId ? grantShield(f, 'normal', 3) : f),
  }))
  if (cardId === 'C096') return update(state, ownerId, p => ({
    ...p, field: p.field.map(f => getCard(f.cardId)?.element === 'geo' && f.health > 0
      ? { ...f, attack: f.attack + 1, health: f.health + 1, maxHealth: f.maxHealth + 1 } : f),
  }))
  return state
}

/** Attack declaration: baby vishap gains crystallize shield, geo hound deals 1, Noelle heals 2. */
export function geoAttack(state: GameState, ownerId: string, attackerId: string): GameState {
  if (state.winnerId !== null) return state
  const owner = state.players.find(p => p.id === ownerId)
  const attacker = owner?.field.find(f => f.instanceId === attackerId && f.health > 0)
  if (!owner || !attacker) return state
  if (attacker.cardId === 'C089') return gainGeoCrystallize(state, ownerId, 1)
  if (attacker.cardId === 'C094') return update(state, ownerId, p => healLeader(p, 2))
  if (attacker.cardId === 'C092') {
    const opponent = state.players.find(p => p.id !== ownerId)
    if (!opponent) return state
    const damaged = damageLeader(opponent, 1)
    return { ...update(state, opponent.id, () => damaged),
      winnerId: damaged.leaderHealth === 0 ? ownerId : state.winnerId }
  }
  return state
}

/** C093 vishap: engagement by either side grants the vishap owner crystallize shield 2. */
export function geoEngage(
  state: GameState, attackingOwnerId: string, attackerId: string, defenderId: string
): GameState {
  if (state.winnerId !== null) return state
  const own = state.players.find(p => p.id === attackingOwnerId)
  const foe = state.players.find(p => p.id !== attackingOwnerId)
  if (!own || !foe) return state
  const attacker = own.field.find(f => f.instanceId === attackerId)
  const defender = foe.field.find(f => f.instanceId === defenderId)
  if (attacker?.cardId === 'C093') return gainGeoCrystallize(state, own.id, 2)
  if (defender?.cardId === 'C093') return gainGeoCrystallize(state, foe.id, 2)
  return state
}


/**
 * C090: four independent random Geo hits, doubled while a friendly
 * Geo construct is on the board. Resolve deaths after every hit so a
 * destroyed target cannot be selected again.
 */
export function geoSpell(
  state: GameState, ownerId: string, cardId: string,
  resolveDeaths: (state: GameState) => GameState,
  targetId?: string
): GameState {
  if (cardId === 'C091') {
    const ally = state.players.find(p => p.id === ownerId)?.field.find(f => f.instanceId === targetId && f.health > 0)
    if (!ally) return state
    return update(state, ownerId, p => ({ ...p, field: p.field.map(f => f.instanceId === targetId ? {
      ...f, attack: f.attack + 2,
      keywords: [...new Set([...f.keywords.filter(k => !k.startsWith('normal_attack_')), 'normal_attack_geo', 'geo_sweep'])],
    } : f) }))
  }
  if (cardId !== 'C090' || state.winnerId !== null) return state
  const ownerIndex = state.players.findIndex(p => p.id === ownerId)
  if (ownerIndex < 0) return state
  const foeIndex = 1 - ownerIndex
  const owner = state.players[ownerIndex]
  const construct = (id: string) => ['token-jade-screen', 'token-spinning-turbo', 'token-solar-isotoma'].includes(id)
  const hasConstruct = owner.field.some(f => f.health > 0 && construct(f.cardId)) ||
    (owner.amulets ?? []).some(a => construct(a.cardId))
  let result = state
  for (let hit = 0; hit < (hasConstruct ? 8 : 4); hit++) {
    if (result.winnerId !== null) break
    const enemy = result.players[foeIndex]
    const targets = enemy.field.filter(f => f.health > 0 &&
      !f.keywords.includes('aura') && !f.keywords.includes('stealth'))
    // Index 0 denotes the opponent's leader.
    const chosen = Math.floor(Math.random() * (targets.length + 1))
    if (chosen === 0) {
      const damaged = damageLeader(enemy, 1, 'geo')
      result = { ...update(result, enemy.id, () => damaged),
        winnerId: damaged.leaderHealth === 0 ? ownerId : result.winnerId }
    } else {
      const target = targets[chosen - 1]
      const outcome = resolveElementalDamage(target, 1, 'geo')
      result = update(result, enemy.id, p => ({
        ...p, field: p.field.map(f => f.instanceId === target.instanceId
          ? outcome.follower : f),
      }))
      result = resolveReactionConsequence(
        result, foeIndex, target.instanceId,
        outcome.reaction, outcome.reactedElement, ownerIndex
      )
      result = resolveDeaths(result)
    }
  }
  return result
}

/** Deal one Geo elemental hit to each opponent follower (with reactions and deaths). */
export function geoHitAll(state: GameState, ownerId: string, amount: number,
  deaths: (s: GameState) => GameState): GameState {
  const source = state.players.findIndex(p => p.id === ownerId)
  if (source < 0) return state
  const ids = state.players[1 - source].field.map(f => f.instanceId)
  let result = state
  for (const id of ids) {
    if (result.winnerId !== null) break
    const foe = result.players[1 - source]
    const target = foe.field.find(f => f.instanceId === id && f.health > 0)
    if (!target) continue
    const hit = resolveElementalDamage(target, amount, 'geo')
    result = update(result, foe.id, p => ({
      ...p, field: p.field.map(f => f.instanceId === id ? hit.follower : f),
    }))
    result = resolveReactionConsequence(result, 1 - source, id,
      hit.reaction, hit.reactedElement, source)
    result = deaths(result)
  }
  return result
}

export function geoBurst(state: GameState, ownerId: string, cardId: string,
  deaths: (s: GameState) => GameState): GameState {
  if (cardId !== 'C100' || state.winnerId !== null) return state
  let result = geoHitAll(state, ownerId, 2, deaths)
  const p = result.players.find(p => p.id === ownerId)
  if (p && ((p.amulets ?? []).some(a =>
    ['token-jade-screen','token-spinning-turbo','token-solar-isotoma'].includes(a.cardId)) ||
    p.field.some(f => f.health > 0 &&
      ['token-jade-screen','token-spinning-turbo','token-solar-isotoma'].includes(f.cardId)))) {
    result = geoHitAll(result, ownerId, 2, deaths)
  }
  return result
}

export function geoTurnEnd(state: GameState, ownerId: string, sourceId: string,
  deaths: (s: GameState) => GameState): GameState {
  if (state.winnerId !== null) return state
  const source = state.players.find(p => p.id === ownerId)?.field.find(f =>
    f.instanceId === sourceId && f.health > 0)
  if (source?.cardId === 'C100') return gainGeoCrystallize(state, ownerId, 1)
  if (source?.cardId !== 'token-tamoto') return state
  const i=state.players.findIndex(p=>p.id===ownerId)
  if(i<0)return state
  const foe=state.players[1-i]
  const available=foe.field.filter(f=>f.health>0 && !f.keywords.includes('aura') && !f.keywords.includes('stealth'))
  if(!available.length)return state
  const target=available[Math.floor(Math.random()*available.length)]
  const hit=resolveElementalDamage(target,2,'geo')
  const updated=update(state,foe.id,p=>({...p,field:p.field.map(f=>f.instanceId===target.instanceId?hit.follower:f)}))
  return deaths(resolveReactionConsequence(updated,1-i,target.instanceId,hit.reaction,hit.reactedElement,i))
}

/** Attack-declaration trigger granted by the Geo spell C091. */
export function geoSweepAttack(state: GameState, ownerId: string, attackerId: string,
  deaths: (s: GameState) => GameState): GameState {
  const attacker = state.players.find(p => p.id === ownerId)?.field.find(f => f.instanceId === attackerId && f.health > 0)
  return attacker?.keywords.includes('geo_sweep') ? geoHitAll(state, ownerId, 1, deaths) : state
}

/** C099: consume up to 3 crystallize shields, then deal Geo 1 + 2x to the chosen foe. */
export function geoNaviaSkill(state: GameState, ownerId: string, targetId?: string): GameState {
  const ownerIndex = state.players.findIndex(p => p.id === ownerId)
  if (ownerIndex < 0 || !targetId) return state
  const p = state.players[ownerIndex]
  const enemy = state.players[1 - ownerIndex]
  const victim = enemy.field.find(f => f.instanceId === targetId && f.health > 0)
  if (!victim) return state
  const consumed = Math.min(3, p.leaderShield?.crystallize ?? 0)
  const players = [...state.players] as [Player, Player]
  const shield = p.leaderShield ?? { normal: 0, crystallize: 0 }
  players[ownerIndex] = { ...p, leaderShield: { ...shield, crystallize: shield.crystallize - consumed } }
  const hit = resolveElementalDamage(victim, 1 + consumed * 2, 'geo')
  players[1 - ownerIndex] = { ...enemy, field: enemy.field.map(f => f.instanceId === targetId ? hit.follower : f) }
  return resolveReactionConsequence({ ...state, players }, 1 - ownerIndex, targetId,
    hit.reaction, hit.reactedElement, ownerIndex)
}

/** C099: Geo AoE one, crystallize one, then create a two-turn crest. */
export function geoNaviaBurst(state: GameState, ownerId: string,
  deaths: (s: GameState) => GameState): GameState {
  let result = geoHitAll(state, ownerId, 1, deaths)
  if (result.winnerId !== null) return result
  result = gainGeoCrystallize(result, ownerId, 1)
  return update(result, ownerId, p => ({ ...p,
    crests: [...(p.crests ?? []), { id: 'C099', turnsRemaining: 2, usedElements: [] }],
  }))
}

export function geoNaviaCrestsTurnEnd(state: GameState, ownerId: string,
  deaths: (s: GameState) => GameState): GameState {
  const count = (state.players.find(p => p.id === ownerId)?.crests ?? []).filter(c => c.id === 'C099').length
  let result = state
  for (let i = 0; i < count && result.winnerId === null; i++) {
    result = geoHitAll(result, ownerId, 1, deaths)
    if (result.winnerId !== null) break
    result = gainGeoCrystallize(result, ownerId, 1)
  }
  if (result.winnerId !== null) return result
  return update(result, ownerId, p => ({ ...p, crests: (p.crests ?? []).map(c =>
    c.id === 'C099' ? { ...c, turnsRemaining: c.turnsRemaining - 1 } : c
  ).filter(c => c.turnsRemaining > 0) }))
}

/** Chiori: Geo 3 AoE and one random Geo 2 strike per Tamoto. */
export function geoChioriBurst(state: GameState, ownerId: string,
  deaths: (s: GameState) => GameState): GameState {
  const i=state.players.findIndex(p=>p.id===ownerId)
  if(i<0 || state.winnerId!==null)return state
  let result=geoHitAll(state,ownerId,3,deaths)
  const count=result.players[i].field.filter(f=>f.health>0 && f.cardId==='token-tamoto').length
  for(let n=0;n<count && result.winnerId===null;n++){
    const foe=result.players[1-i]
    const targets=foe.field.filter(f=>f.health>0 && !f.keywords.includes('aura') && !f.keywords.includes('stealth'))
    const choice=Math.floor(Math.random()*(targets.length+1))
    if(choice===0){
      const damaged=damageLeader(foe,2,'geo')
      result={...update(result,foe.id,()=>damaged),winnerId:damaged.leaderHealth===0?ownerId:result.winnerId}
    }else{
      const victim=targets[choice-1],hit=resolveElementalDamage(victim,2,'geo')
      const updated=update(result,foe.id,p=>({...p,field:p.field.map(f=>f.instanceId===victim.instanceId?hit.follower:f)}))
      result=deaths(resolveReactionConsequence(updated,1-i,victim.instanceId,hit.reaction,hit.reactedElement,i))
    }
  }
  return result
}
