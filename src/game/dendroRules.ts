import type { Follower, GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'
import { damageLeader, healLeader, addLeaderShield } from './leaderShield'
import { summonFollowers } from './neutralRules'
import { resolveElementalDamage, resolveReactionConsequence, grantShield } from './elemental'

let nextDendroAmuletId = 1

function edit(state: GameState, ownerId: string, change: (p: Player) => Player): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  const players = [...state.players] as [Player, Player]
  players[index] = change(players[index])
  return { ...state, players }
}

/** C102: tutor a Dendro card first; then perform a real draw, losing to deck-out. */
export function dendroSpell(state: GameState, ownerId: string, cardId: string): GameState {
  if (cardId !== 'C102' || state.winnerId !== null) return state
  const ownerIndex = state.players.findIndex(p => p.id === ownerId)
  if (ownerIndex < 0) return state
  let result = edit(state, ownerId, p => {
    const matches = p.deck.map((id, index) => ({ id, index }))
      .filter(item => getCard(item.id)?.element === 'dendro')
    if (matches.length === 0) return p
    const selected = matches[Math.floor(Math.random() * matches.length)]
    return { ...p,
      deck: p.deck.filter((_, index) => index !== selected.index),
      hand: p.hand.length < 9 ? [...p.hand, selected.id] : p.hand,
    }
  })
  const player = result.players[ownerIndex]
  if (player.deck.length === 0) return { ...result, winnerId: result.players[1 - ownerIndex].id }
  result = edit(result, ownerId, p => ({
    ...p,
    deck: p.deck.slice(1),
    hand: p.hand.length < 9 ? [...p.hand, p.deck[0]] : p.hand,
  }))
  return result
}

/** C104: Dendro floaty last word, with normal leader shield absorption. */
export function dendroDestroy(state: GameState, ownerId: string, dead: Follower): GameState {
  if (dead.cardId !== 'C104' || state.winnerId !== null) return state
  const other = state.players.find(p => p.id !== ownerId)
  if (!other) return state
  const damaged = damageLeader(other, 2)
  return { ...edit(state, other.id, () => damaged),
    winnerId: damaged.leaderHealth === 0 ? ownerId : state.winnerId }
}

/** C107: three-turn Vanarana amulet. */
export function dendroAmuletPlay(state: GameState, ownerId: string, cardId: string): GameState {
  if (cardId !== 'C107' || state.winnerId !== null) return state
  return edit(state, ownerId, p => ({
    ...p, amulets: [...(p.amulets ?? []), {
      instanceId: `vanarana-${nextDendroAmuletId++}`, cardId, turnsRemaining: 3,
    }],
  }))
}

/** End-turn Vanarana: heal, draw, then decrement. Each separate draw can lose. */
export function dendroAmuletsTurnEnd(state: GameState, ownerId: string): GameState {
  const ids = (state.players.find(p => p.id === ownerId)?.amulets ?? [])
    .filter(a => a.cardId === 'C107').map(a => a.instanceId)
  let result = state
  for (const id of ids) {
    if (result.winnerId !== null) break
    result = edit(result, ownerId, p => healLeader(p, 1))
    const index = result.players.findIndex(p => p.id === ownerId)
    if (result.players[index].deck.length === 0) {
      result = { ...result, winnerId: result.players[1 - index].id }
      break
    }
    result = edit(result, ownerId, p => ({
      ...p, deck: p.deck.slice(1),
      hand: p.hand.length < 9 ? [...p.hand, p.deck[0]] : p.hand,
      amulets: (p.amulets ?? []).map(a =>
        a.instanceId === id ? { ...a, turnsRemaining: a.turnsRemaining - 1 } : a)
        .filter(a => a.turnsRemaining > 0),
    }))
  }
  return result
}

/** Apply Dendro damage in stable placement order, including reactions and deaths. */
export function dendroHitAll(state: GameState, ownerId: string, amount: number,
  deaths: (s: GameState) => GameState): GameState {
  const i = state.players.findIndex(p => p.id === ownerId)
  if (i < 0) return state
  const ids = state.players[1 - i].field.map(f => f.instanceId)
  let result = state
  for (const id of ids) {
    if (result.winnerId !== null) break
    const foe = result.players[1 - i]
    const target = foe.field.find(f => f.instanceId === id && f.health > 0)
    if (!target) continue
    const hit = resolveElementalDamage(target, amount, 'dendro')
    const updated = edit(result, foe.id, p => ({ ...p,
      field: p.field.map(f => f.instanceId === id ? hit.follower : f),
    }))
    result = deaths(resolveReactionConsequence(updated, 1 - i, id,
      hit.reaction, hit.reactedElement, i))
  }
  return result
}

/** C105: summon up to two Yuegui, heal all friendly followers and the leader by 2. */
export function dendroSilverSpell(state: GameState, ownerId: string, cardId: string,
  deaths: (s: GameState) => GameState): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C105') {
    return edit(summonFollowers(state, ownerId, 'token-yuegui-jumping', 2), ownerId, p => ({
      ...healLeader(p, 2),
      field: p.field.map(f => f.health > 0
        ? { ...f, health: Math.min(f.maxHealth, f.health + 2) } : f),
    }))
  }
  if (cardId === 'C106') {
    let result = dendroHitAll(state, ownerId, 1, deaths)
    result = edit(result, ownerId, p => {
      if (p.field.length + (p.amulets?.length ?? 0) >= 5) return p
      return { ...p, amulets: [...(p.amulets ?? []), {
        instanceId: `collei-amber-${nextDendroAmuletId++}`,
        cardId: 'token-collei-amber', turnsRemaining: 2,
      }] }
    })
    return result
  }
  return state
}

/** The jumping Yuegui heals and deals Dendro 2 at the end of its owner's turn. */
export function dendroTokenTurnEnd(state: GameState, ownerId: string, sourceId: string,
  deaths: (s: GameState) => GameState): GameState {
  if (state.winnerId !== null) return state
  const owner = state.players.find(p => p.id === ownerId)
  const source = owner?.field.find(f => f.instanceId === sourceId && f.health > 0)
  if (source?.cardId !== 'token-yuegui-jumping') return state
  const i = state.players.findIndex(p => p.id === ownerId)
  const foe = state.players[1 - i]
  const candidates = foe.field.filter(f => f.health > 0)
  let result = state
  if (candidates.length) {
    const victim = candidates[Math.floor(Math.random() * candidates.length)]
    const hit = resolveElementalDamage(victim, 2, 'dendro')
    result = edit(result, foe.id, p => ({
      ...p, field: p.field.map(f => f.instanceId === victim.instanceId ? hit.follower : f),
    }))
    result = deaths(resolveReactionConsequence(result, 1 - i, victim.instanceId,
      hit.reaction, hit.reactedElement, i))
  }
  if (result.winnerId !== null) return result
  return edit(result, ownerId, p => healLeader(p, 1))
}

/** C106's Collei Amber: two owner-turn-end Dendro AoEs. */
export function dendroColleiAmberTurnEnd(state: GameState, ownerId: string,
  deaths: (s: GameState) => GameState): GameState {
  const ids = (state.players.find(p => p.id === ownerId)?.amulets ?? [])
    .filter(a => a.cardId === 'token-collei-amber').map(a => a.instanceId)
  let result = state
  for (const id of ids) {
    if (result.winnerId !== null) break
    if (!(result.players.find(p => p.id === ownerId)?.amulets ?? []).some(a => a.instanceId === id)) continue
    result = dendroHitAll(result, ownerId, 1, deaths)
    result = edit(result, ownerId, p => ({
      ...p, amulets: (p.amulets ?? []).map(a =>
        a.instanceId === id ? { ...a, turnsRemaining: a.turnsRemaining - 1 } : a)
        .filter(a => a.turnsRemaining > 0),
    }))
  }
  return result
}

/** C108: summon a Dendro spirit on play; gaining attack checks the live spirit board. */
export function dendroPlay(state: GameState, ownerId: string, cardId: string): GameState {
  return cardId === 'C108' && state.winnerId === null
    ? summonFollowers(state, ownerId, 'token-dendro-spirit', 1) : state
}

export function dendroAttack(state: GameState, ownerId: string, attackerId: string): GameState {
  const owner = state.players.find(p => p.id === ownerId)
  const source = owner?.field.find(f => f.instanceId === attackerId && f.health > 0)
  if (source?.cardId !== 'C108' ||
      !owner?.field.some(f => f.cardId === 'token-dendro-spirit' && f.health > 0)) return state
  return edit(state, ownerId, p => ({
    ...p, field: p.field.map(f => f.instanceId === attackerId ? {
      ...f, attack: f.attack + 2,
    } : f),
  }))
}

/** Single targeted elemental hit, respecting aura/reactions. Deaths are dispatched by caller. */
export function dendroHitTarget(state: GameState, ownerId: string, targetId: string, amount: number): GameState {
  const i = state.players.findIndex(p => p.id === ownerId)
  if (i < 0 || state.winnerId !== null) return state
  const foe = state.players[1-i]
  const victim = foe.field.find(f => f.instanceId === targetId && f.health > 0)
  if (!victim) return state
  const hit = resolveElementalDamage(victim, amount, 'dendro')
  const updated = edit(state, foe.id, p => ({
    ...p, field: p.field.map(f => f.instanceId === targetId ? hit.follower : f),
  }))
  return resolveReactionConsequence(updated, 1-i, targetId, hit.reaction, hit.reactedElement, i)
}

/** One random enemy follower; unlike random follower-or-leader effects, no leader fallback. */
function dendroRandomFollower(state: GameState, ownerId: string, amount: number): GameState {
  const foe = state.players.find(p => p.id !== ownerId)
  const choices = foe?.field.filter(f => f.health > 0) ?? []
  if (!choices.length) return state
  return dendroHitTarget(state, ownerId, choices[Math.floor(Math.random()*choices.length)].instanceId, amount)
}

function dendroTutor(state: GameState, ownerId: string, spellOnly: boolean): GameState {
  return edit(state, ownerId, p => {
    const options = p.deck.map((id,index)=>({id,index})).filter(c =>
      getCard(c.id)?.element==='dendro' && (!spellOnly || getCard(c.id)?.type==='spell'))
    if (!options.length) return p
    const found=options[Math.floor(Math.random()*options.length)]
    return {...p, deck:p.deck.filter((_,idx)=>idx!==found.index),
      hand:p.hand.length<9?[...p.hand,found.id]:p.hand}
  })
}

/** Gold cards: fanfares. */
export function dendroGoldPlay(state: GameState, ownerId: string, cardId: string): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C110') return edit(state, ownerId, p => addLeaderShield(p, 2))
  if (cardId === 'C111') return dendroTutor(state,ownerId,true)
  if (cardId === 'C112') {
    const foe=state.players.find(p=>p.id!==ownerId)
    const core=foe?.field.find(f=>f.cardId==='dendro-core'&&f.health>0)
    if (!foe || !core) return state
    return edit(state,foe.id,p=>({...p,field:p.field.map(f=>f.instanceId===core.instanceId?
      {...f,health:f.health+1,maxHealth:f.maxHealth+1}:f)}))
  }
  return state
}

export function dendroGoldSkill(state: GameState, ownerId: string, sourceId: string,
  cardId: string, targetId?: string): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C109') return summonFollowers(state,ownerId,'token-yuegui-throwing',1)
  if (cardId === 'C110') {
    let result=edit(state,ownerId,p=>({...p,field:p.field.map(f=>f.instanceId===sourceId?
      grantShield(f,'normal',3):f)}))
    return dendroRandomFollower(result,ownerId,1)
  }
  if (cardId === 'C111' && targetId) {
    let result=dendroHitTarget(state,ownerId,targetId,2)
    const enemy=result.players.find(p=>p.id!==ownerId)
    const choices=enemy?.field.filter(f=>f.health>0&&f.instanceId!==targetId)??[]
    if (choices.length) result=dendroHitTarget(result,ownerId,choices[Math.floor(Math.random()*choices.length)].instanceId,1)
    return result
  }
  if (cardId === 'C112' && targetId) {
    const enemy=state.players.find(p=>p.id!==ownerId)
    const core=enemy?.field.find(f=>f.health>0&&f.cardId==='dendro-core')
    let result=dendroHitTarget(state,ownerId,targetId,2)
    if (core && enemy) {
      const foe=result.players.find(p=>p.id===enemy.id)!
      const damaged=damageLeader(foe,Math.min(3,core.health))
      result={...edit(result,foe.id,()=>damaged),
        winnerId:damaged.leaderHealth===0?ownerId:result.winnerId}
    }
    return result
  }
  return state
}

export function dendroGoldTurnEnd(state: GameState, ownerId: string, sourceId: string,
  deaths: (s: GameState)=>GameState): GameState {
  const source=state.players.find(p=>p.id===ownerId)?.field.find(f=>f.instanceId===sourceId&&f.health>0)
  if (source?.cardId==='C109')return edit(state,ownerId,p=>healLeader(p,1))
  if (source?.cardId==='token-yuegui-throwing') {
    const result=deaths(dendroRandomFollower(state,ownerId,1))
    return result.winnerId===null?edit(result,ownerId,p=>healLeader(p,1)):result
  }
  return state
}

/** One random elemental strike with the opponent leader as an eligible target. */
function dendroRandomEnemy(state: GameState, ownerId: string, amount: number,
  deaths: (s: GameState)=>GameState): GameState {
  if (state.winnerId!==null) return state
  const index=state.players.findIndex(p=>p.id===ownerId)
  if(index<0)return state
  const foe=state.players[1-index]
  const choices=foe.field.filter(f=>f.health>0)
  const selected=Math.floor(Math.random()*(choices.length+1))
  if(selected===0){
    const hit=damageLeader(foe,amount)
    return {...edit(state,foe.id,()=>hit),
      winnerId:hit.leaderHealth===0?ownerId:state.winnerId}
  }
  return deaths(dendroHitTarget(state,ownerId,choices[selected-1].instanceId,amount))
}

export function dendroLegendarySkill(state: GameState, ownerId: string,
  sourceId: string, cardId: string, targetId?: string): GameState {
  if(state.winnerId!==null)return state
  if(cardId==='C113'&&targetId){
    let result=dendroHitTarget(state,ownerId,targetId,2)
    const enemy=result.players.find(p=>p.id!==ownerId)!
    result=edit(result,enemy.id,p=>({...p,field:p.field.map(f=>
      f.instanceId===targetId&&f.health>0?{...f,attack:Math.max(0,f.attack-1)}:f)}))
    return result
  }
  if(cardId==='C114'){
    return edit(state,ownerId,p=>p.field.length+(p.amulets?.length??0)>=5?p:{
      ...p,amulets:[...(p.amulets??[]),{
        instanceId:`lumidouce-${nextDendroAmuletId++}`,
        cardId:'token-lumidouce-vial',turnsRemaining:3,
      }],
    })
  }
  if(cardId==='C115'&&targetId)return dendroHitTarget(state,ownerId,targetId,3)
  return state
}

export function dendroLegendaryBurst(state: GameState, ownerId: string, cardId: string,
  deaths: (s: GameState)=>GameState): GameState {
  if(state.winnerId!==null)return state
  if(cardId==='C113'){
    let result=state
    for(let i=0;i<4&&result.winnerId===null;i++)
      result=dendroRandomEnemy(result,ownerId,2,deaths)
    return result
  }
  if(cardId==='C114'){
    const enemy=state.players.find(p=>p.id!==ownerId)
    const burning=enemy?.field.some(f=>f.health>0&&
      f.keywords.some(k=>k.startsWith('burning:')))??false
    let result=dendroHitAll(state,ownerId,2,deaths)
    if(burning&&result.winnerId===null) result=dendroHitAll(result,ownerId,2,deaths)
    return result
  }
  if(cardId==='C115'){
    const result=dendroHitAll(state,ownerId,2,deaths)
    if(result.winnerId!==null)return result
    const enemy=result.players.find(p=>p.id!==ownerId)!
    const hit=damageLeader(enemy,3)
    return {...edit(result,enemy.id,()=>hit),
      winnerId:hit.leaderHealth===0?ownerId:result.winnerId}
  }
  return state
}

/** Tighnari: one random Dendro 1 strike at attack declaration. */
export function dendroLegendaryAttack(state: GameState, ownerId: string, attackerId: string,
  deaths: (s: GameState)=>GameState): GameState {
  const own=state.players.find(p=>p.id===ownerId)
  if(own?.field.find(f=>f.instanceId===attackerId&&f.health>0)?.cardId!=='C113')return state
  return deaths(dendroRandomFollower(state,ownerId,1))
}

/** Lumidouce vial: 1 Dendro damage or 3 when any enemy is burning; countdown 3. */
export function dendroLumidouceTurnEnd(state: GameState, ownerId: string,
  deaths: (s: GameState)=>GameState): GameState {
  const ids=(state.players.find(p=>p.id===ownerId)?.amulets??[])
    .filter(a=>a.cardId==='token-lumidouce-vial').map(a=>a.instanceId)
  let result=state
  for(const id of ids){
    if(result.winnerId!==null)break
    const owner=result.players.find(p=>p.id===ownerId)!
    if(!owner.amulets?.some(a=>a.instanceId===id))continue
    const enemy=result.players.find(p=>p.id!==ownerId)!
    const burning=enemy.field.some(f=>f.health>0&&f.keywords.some(k=>k.startsWith('burning:')))
    result=deaths(dendroRandomFollower(result,ownerId,burning?3:1))
    result=edit(result,ownerId,p=>({...p,amulets:(p.amulets??[]).map(a=>
      a.instanceId===id?{...a,turnsRemaining:a.turnsRemaining-1}:a)
      .filter(a=>a.turnsRemaining>0)}))
  }
  return result
}
