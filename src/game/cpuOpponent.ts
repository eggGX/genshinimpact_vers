import {
  activateAbility, attackFollower, attackLeader, canFollowerAttack,
  canPlayCard, canUseAbility, endTurn, getCard, needsAbilityTarget,
  needsFriendlyAbilityTarget, needsFriendlyPlayTarget, needsPlayTarget, playCard,
} from './engine'
import type { GameState, Follower, Card, ElementType } from './types'
import { isGuarded } from './neutralRules'

/** Browser-only practice opponent. Never used by the online server. */
export type CpuAction =
  | { type: 'play'; handIndex: number; targetId?: string; cardId: string }
  | { type: 'ability'; followerId: string; kind: 'skill' | 'burst'; targetId?: string; cardId: string }
  | { type: 'attackFollower'; attackerId: string; targetId: string }
  | { type: 'attackLeader'; attackerId: string }
  | { type: 'endTurn' }

const CPU_ID = 'player2'
const MAX_ACTIONS = 28

function strength(f: Follower): number {
  return Math.max(0, f.attack) * 1.25 + Math.max(0, f.health) +
    (f.keywords.includes('guard') ? 2.5 : 0) +
    (f.keywords.includes('bane') ? 2 : 0)
}

function physicalDamage(f: Follower): number {
  return Math.max(0, f.attack)
}

function reacts(element: ElementType, f: Follower): boolean {
  if (element === 'none' || element === 'anemo' || element === 'geo') return false
  return f.aura.some(a => a.element !== element && a.element !== 'none')
}

function targetPriority(f: Follower): number {
  return strength(f) + (f.health <= 2 ? 1.5 : 0) +
    (f.keywords.includes('guard') ? 4 : 0)
}

function selectableEnemies(state: GameState): Follower[] {
  const enemy = state.players.find(p => p.id !== CPU_ID)
  return (enemy?.field ?? []).filter(f => f.health > 0 &&
    !f.keywords.includes('stealth') && !f.keywords.includes('aura'))
}

function friendlyTargets(state: GameState, card: Card, kind?: 'skill' | 'burst'): Follower[] {
  const owner = state.players.find(p => p.id === CPU_ID)
  const allies = (owner?.field ?? []).filter(f => f.health > 0)
  if (card.id === 'C066' || card.id === 'C081') {
    const element = card.id === 'C066' ? 'electro' : 'anemo'
    return allies.filter(f => getCard(f.cardId)?.element === element)
  }
  if (kind === 'skill' && card.id === 'C066') {
    return allies.filter(f => getCard(f.cardId)?.element === 'electro')
  }
  return allies
}

type Candidate = { action: CpuAction; score: number }
const sortCandidates = (a: Candidate, b: Candidate) => b.score - a.score

/** Generate legal-looking candidates; the engine validates the chosen action again. */
export function cpuCandidates(state: GameState): CpuAction[] {
  if (state.phase !== 'main' || state.winnerId !== null ||
      state.currentPlayerId !== CPU_ID) return []
  const owner = state.players.find(p => p.id === CPU_ID)!
  const enemy = state.players.find(p => p.id !== CPU_ID)!
  const enemies = selectableEnemies(state)
  const choices: Candidate[] = []

  // Taking lethal has absolute priority over developing the board.
  const guard = isGuarded(enemy)
  for (const follower of owner.field) {
    if (!canFollowerAttack(follower)) continue
    if ((!guard || follower.keywords.includes('plunge_attack') || follower.keywords.includes('ignore_guard')) &&
        (!follower.keywords.includes('rush_only') || follower.keywords.includes('storm'))) {
      choices.push({action:{ type:'attackLeader', attackerId:follower.instanceId },
        score: physicalDamage(follower) >= enemy.leaderHealth ? 10000 : 12 + follower.attack * 1.9})
    }
    for (const target of enemies) {
      if (target.keywords.includes('intimidate')) continue
      if (guard && !target.keywords.includes('guard') &&
          !follower.keywords.includes('ignore_guard') &&
          !follower.keywords.includes('plunge_attack')) continue
      const lethal = follower.attack >= target.health ||
        follower.keywords.includes('bane')
      const survival = follower.health > target.attack
      const sourceCard = getCard(follower.cardId)
      const element = sourceCard?.normalAttackElement ?? 'none'
      const score = 11 + (lethal ? targetPriority(target) + 8 : -7) +
        (survival ? 5 : -strength(follower) * .55) +
        (reacts(element, target) ? 4 : 0) +
        (target.keywords.includes('guard') ? 7 : 0)
      choices.push({ action:{type:'attackFollower',
        attackerId:follower.instanceId,targetId:target.instanceId}, score })
    }
  }

  // Play high-value affordable cards; use an explicit valid target where required.
  for (let handIndex = 0; handIndex < owner.hand.length; handIndex++) {
    if (!canPlayCard(state, handIndex)) continue
    const card = getCard(owner.hand[handIndex])
    if (!card) continue
    const base = 22 + card.cost * 2 +
      (card.type === 'follower' ? (card.attack ?? 0) * 1.1 + (card.health ?? 0) * .8 : 2) +
      (card.type === 'spell' && enemies.length ? 2 : 0)
    const append = (targetId?: string, bonus = 0) => {
      choices.push({action:{type:'play',handIndex,targetId,cardId:card.id},
        score:base + bonus})
    }
    if (card.id === 'C116') {
      const targets = [
        ...owner.field.filter(f=>f.health>0).map(f=>({f,ally:true})),
        ...enemies.map(f=>({f,ally:false})),
      ]
      targets.forEach(({f,ally})=>append(f.instanceId,
        ally ? -strength(f)*1.5 : targetPriority(f)*1.5))
    } else if (card.id === 'C117') {
      owner.field.filter(f=>f.health>0).forEach(f=>append(f.instanceId,strength(f)*.5))
    } else if (card.id === 'C121') {
      owner.field.filter(f=>f.health>0 && !f.keywords.includes('ignore_guard'))
        .forEach(f=>append(f.instanceId,
          isGuarded(enemy) ? 8 + strength(f)*.3 : -5))
    } else if (needsPlayTarget(card)) {
      if (enemies.length) {
        enemies.forEach(target => append(target.instanceId, targetPriority(target) * .4))
      } else if (card.type !== 'spell') append()
    } else if (needsFriendlyPlayTarget(card)) {
      const allies = friendlyTargets(state, card)
      if (allies.length) {
        allies.forEach(target => append(target.instanceId, strength(target) * .3))
      } else if (['C021','C044','C066','C081'].includes(card.id)) append()
    } else append()
  }

  // Abilities may be used on their summoning turn. Do not spam free skills:
  // the engine caps uses and we cap actions per turn as a second safeguard.
  for (const follower of owner.field) {
    const card = getCard(follower.cardId)
    if (!card) continue
    for (const kind of ['burst', 'skill'] as const) {
      if (!canUseAbility(state, follower.instanceId, kind)) continue
      const ability = kind === 'skill' ? card.elementalSkill : card.elementalBurst
      const base = kind === 'burst' ? 45 : 30 -
        (ability?.ppCost ?? 0) * 1.5
      const append = (targetId?: string, bonus = 0) => {
        choices.push({action:{type:'ability',followerId:follower.instanceId,
          kind,targetId,cardId:card.id},score:base+bonus})
      }
      if (card.id === 'C083' && kind === 'skill') {
        owner.hand.forEach((id, index) => {
          if (['pyro','hydro','cryo','electro'].includes(getCard(id)?.element ?? ''))
            append(`hand:${index}`, -(getCard(id)?.cost ?? 0) * 1.5)
        })
      } else if (needsAbilityTarget(card,kind)) {
        if (card.id === 'C049' && kind === 'skill' && enemies.length >= 2) {
          const targets = [...enemies].sort((a,b)=>targetPriority(b)-targetPriority(a))
          append(`${targets[0].instanceId}|${targets[1].instanceId}`, targetPriority(targets[0])*.3)
        } else enemies.forEach(target => append(target.instanceId,targetPriority(target)*.35))
      } else if (needsFriendlyAbilityTarget(card, kind)) {
        friendlyTargets(state,card,kind).forEach(target=>append(target.instanceId,strength(target)*.3))
      } else append()
    }
  }
  // The CPU can always end its own turn. Prefer spending resources first.
  choices.push({action:{type:'endTurn'},score:-100})
  return choices.sort(sortCandidates).map(choice=>choice.action)
}

export function performCpuAction(state: GameState, action: CpuAction): GameState {
  if (state.phase !== 'main' || state.currentPlayerId !== CPU_ID ||
      state.winnerId !== null) return state
  switch(action.type) {
    case 'play': return playCard(state,CPU_ID,action.handIndex,action.targetId)
    case 'ability': return activateAbility(state,action.followerId,action.kind,action.targetId)
    case 'attackFollower': return attackFollower(state,action.attackerId,action.targetId)
    case 'attackLeader': return attackLeader(state,action.attackerId)
    case 'endTurn': return endTurn(state)
  }
}

/** Pick and execute exactly one successful action for existing presentation playback. */
export function nextCpuAction(state: GameState, actionsTaken: number):
  { action: CpuAction; result: GameState } | null {
  if (state.currentPlayerId !== CPU_ID || state.phase !== 'main' ||
      state.winnerId !== null) return null
  if (actionsTaken >= MAX_ACTIONS) return {action:{type:'endTurn'},result:endTurn(state)}
  for (const action of cpuCandidates(state)) {
    const result = performCpuAction(state,action)
    if (result !== state) return {action,result}
  }
  return {action:{type:'endTurn'},result:endTurn(state)}
}
