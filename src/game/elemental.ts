import type { ElementType, Follower, GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'
import { captureFrame } from './presentation'
import { addLeaderShield, damageLeaderWithReaction } from './leaderShield'

/** 元素生物の固有付着。風・岩も常時保持する。 */
function inherentElement(follower: Follower): ElementType | undefined {
  const card = getCard(follower.cardId)
  return card?.elementalCreature ? card.element : undefined
}

export function restoreInherentAura(follower: Follower): Follower {
  const element = inherentElement(follower)
  if (!element || element === 'none') return follower
  // Creature-specific constant attachment takes precedence over any foreign aura.
  if (follower.aura.length === 1 && follower.aura[0].element === element) return follower
  return { ...follower, aura: [{ element }] }
}

export function grantShield(
  follower: Follower, type: 'normal' | 'crystallize', amount: number
): Follower {
  const add = Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0
  return {
    ...follower,
    shield: {
      ...follower.shield,
      [type]: Math.min(10, Math.max(0, follower.shield[type]) + add),
    },
  }
}

export function absorbDamage(follower: Follower, amount: number): Follower {
  // Dendro Cores take zero damage even if it would normally bypass shields.
  // Their turn-end -0/-1 and Pyro/Electro detonations are not damage.
  if (follower.cardId === 'dendro-core') return follower
  let remaining = Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0
  if (remaining > 0 && follower.keywords.includes('next_damage_plus_2')) remaining += 2
  if (follower.keywords.includes('damage_cap_1') && remaining >= 2) remaining = 1
  const normalUsed = Math.min(Math.max(0, follower.shield.normal), remaining)
  remaining -= normalUsed
  const crystallizeUsed = Math.min(Math.max(0, follower.shield.crystallize), remaining)
  remaining -= crystallizeUsed
  return {
    ...follower,
    health: follower.health - remaining,
    shield: {
      normal: follower.shield.normal - normalUsed,
      crystallize: follower.shield.crystallize - crystallizeUsed,
    },
    keywords: amount > 0
      ? follower.keywords.filter(k => k !== 'next_damage_plus_2')
      : follower.keywords,
  }
}

let nextCoreInstanceId = 1

export function createDendroCore(): Follower {
  return {
    instanceId: `dendro-core-${nextCoreInstanceId++}`,
    cardId: 'dendro-core',
    attack: 0,
    health: 1,
    maxHealth: 1,
    skillUsed: false,
    burstUsed: false,
    aura: [],
    shield: { normal: 0, crystallize: 0 },
    canAttack: false,
    hasAttacked: false,
    keywords: ['cannot_attack'],
  }
}

export type ElementalReaction =
  | 'vaporize' | 'melt' | 'electro_charged' | 'overloaded' | 'frozen'
  | 'superconduct' | 'burning' | 'quicken' | 'swirl' | 'crystallize'
  | 'bloom' | 'burgeon' | 'hyperbloom'

export interface ElementalDamageResult {
  follower: Follower
  damage: number
  reaction: ElementalReaction | null
  reactedElement?: ElementType
}

/**
 * Non-reacting elemental hits replace the previous aura, rather than stack.
 * Elemental creatures are the exception: their inherent element stays attached.
 * Reactions are determined by resolveElementalDamage before this step.
 */
export function applyElementalAura(
  follower: Follower,
  element?: ElementType
): Follower {
  const inherent = inherentElement(follower)
  if (inherent && inherent !== 'none') {
    return { ...follower, aura: [{ element: inherent }] }
  }

  if (!element || element === 'none' ||
      element === 'anemo' || element === 'geo') {
    return follower
  }

  return { ...follower, aura: [{ element }] }
}

function reactionFor(
  attached: ElementType,
  incoming: ElementType
): ElementalReaction | null {
  const pair = [attached, incoming]
  if (pair.includes('pyro') && pair.includes('hydro')) return 'vaporize'
  if (pair.includes('pyro') && pair.includes('cryo')) return 'melt'
  if (pair.includes('hydro') && pair.includes('electro')) return 'electro_charged'
  if (pair.includes('pyro') && pair.includes('electro')) return 'overloaded'
  if (pair.includes('hydro') && pair.includes('cryo')) return 'frozen'
  if (pair.includes('cryo') && pair.includes('electro')) return 'superconduct'
  if (pair.includes('pyro') && pair.includes('dendro')) return 'burning'
  if (pair.includes('dendro') && pair.includes('electro')) return 'quicken'
  if (pair.includes('dendro') && pair.includes('hydro')) return 'bloom'
  if (incoming === 'anemo' && ['pyro', 'hydro', 'cryo', 'electro'].includes(attached)) return 'swirl'
  if (incoming === 'geo' && ['pyro', 'hydro', 'cryo', 'electro'].includes(attached)) return 'crystallize'
  return null
}

/**
 * フォロワーへの通常攻撃・カード効果のダメージを共通処理する。
 * 蒸発 +2 / 溶解 +3。どちらも攻撃方向に依存しない。
 * 反応した既存の付着を取り除き、今回の攻撃元素も付着しない。
 * 反応しない異元素の組み合わせでは、今回の元素で従来の付着を上書きする。
 */
export function resolveElementalDamage(
  follower: Follower,
  baseDamage: number,
  incomingElement?: ElementType
): ElementalDamageResult {
  // Core detonation takes precedence over shield absorption and aura processing.
  // Both pyro and electro destroy the core regardless of its shield.
  if (follower.cardId === 'dendro-core' &&
      (incomingElement === 'pyro' || incomingElement === 'electro')) {
    return {
      follower: { ...follower, health: 0 },
      damage: 0,
      reaction: incomingElement === 'pyro' ? 'burgeon' : 'hyperbloom',
    }
  }

  // All ordinary elemental damage to the Core is prevented, including
  // Hydro/Cryo/Anemo/Geo. Pyro and Electro detonate it above.
  if (follower.cardId === 'dendro-core') {
    return { follower, damage: 0, reaction: null }
  }
  const base = Number.isFinite(baseDamage)
    ? Math.max(0, Math.trunc(baseDamage)) : 0
  const physicalBonus = (!incomingElement || incomingElement === 'none') &&
    follower.keywords.includes('superconduct') && base > 0 ? 2 : 0
  const retainedKeywords = base > 0
    ? follower.keywords.filter(k => k !== 'next_damage_plus_2')
    : follower.keywords
  const physicalKeywords = physicalBonus
    ? retainedKeywords.filter(k => k !== 'superconduct') : retainedKeywords

  // 激化の残り回数を優先消費し、同じ攻撃で再度原激化しない。
  if (base > 0 && (incomingElement === 'electro' || incomingElement === 'dendro')) {
    const charge = physicalKeywords.find(k => k.startsWith('quicken:'))
    if (charge) {
      const rest = Math.max(0, (Number(charge.slice(8)) || 0) - 1)
      return {
        follower: {
          ...follower,
          ...absorbDamage(follower, base + physicalBonus),
          keywords: [
            ...physicalKeywords.filter(k => !k.startsWith('quicken:')),
            ...(rest ? [`quicken:${rest}`] : []),
          ],
        },
        damage: base + physicalBonus,
        reaction: null,
      }
    }
  }

  // 燃焼中への炎・草の追加攻撃は継続ターンを加算する。
  if (base > 0 && (incomingElement === 'pyro' || incomingElement === 'dendro')) {
    const burning = physicalKeywords.find(k => k.startsWith('burning:'))
    if (burning) {
      const turns = Number(burning.slice(8)) || 0
      return {
        follower: { ...absorbDamage(follower, base),
          keywords: [...physicalKeywords.filter(k => !k.startsWith('burning:')), `burning:${turns + 1}`] },
        damage: base,
        reaction: 'burning',
      }
    }
  }

  const index = incomingElement
    ? follower.aura.findIndex(aura =>
        reactionFor(aura.element, incomingElement) !== null)
    : -1

  if (index >= 0 && incomingElement) {
    const reactedElement = follower.aura[index].element
    const reaction = reactionFor(reactedElement, incomingElement)
    const damage = base + physicalBonus +
      (reaction === 'melt' ? 3 : reaction === 'vaporize' ? 2 : 0)
    const remainingAuras = follower.aura.filter((_, i) => i !== index)
    let keywords = [...physicalKeywords]
    if (reaction === 'frozen' && !keywords.includes('frozen')) keywords.push('frozen')
    if (reaction === 'superconduct' && !keywords.includes('superconduct')) keywords.push('superconduct')
    if (reaction === 'burning') {
      const old = keywords.filter(k => k.startsWith('burning:'))
      const turns = old.reduce((n, k) => n + (Number(k.slice(8)) || 0), 0)
      keywords = [...keywords.filter(k => !k.startsWith('burning:')), `burning:${turns + 1}`]
    }
    if (reaction === 'quicken') {
      keywords = [...keywords.filter(k => !k.startsWith('quicken:')), 'quicken:2']
    }
    return {
      follower: restoreInherentAura({ ...absorbDamage(follower, damage),
        aura: remainingAuras, keywords }),
      damage, reaction, reactedElement,
    }
  }
  const keywords = [...physicalKeywords]
  if (base > 0 && incomingElement && ['electro', 'dendro'].includes(incomingElement)) {
    const index = keywords.findIndex(k => k.startsWith('quicken:'))
    if (index >= 0) {
      const remaining = Number(keywords[index].slice(8)) - 1
      keywords.splice(index, 1)
      if (remaining > 0) keywords.push(`quicken:${remaining}`)
    }
  }
  const damaged = { ...absorbDamage(follower, base + physicalBonus), keywords }
  return {
    follower: applyElementalAura(damaged, incomingElement),
    damage: base + physicalBonus,
    reaction: null,
  }
}

/**
 * 反応による副次効果。
 * 感電：対象以外の敵フォロワー（配置順の先頭）へ1、なければ敵リーダーへ1。
 * 過負荷：反応対象の元カードのコストが5以下なら手札に戻す。
 * 凍結：keywordsに'frozen'を付ける（通常攻撃不可）。
 * 対象選択UI・解除タイミングは今後拡張する。
 */
function resolveReactionConsequenceCore(
  state: GameState,
  affectedOwnerIndex: number,
  affectedInstanceId: string,
  reaction: ElementalReaction | null,
  reactedElement?: ElementType,
  sourceOwnerIndex?: number
): GameState {
  if (reaction === 'burning') {
    const index=sourceOwnerIndex ?? (1-affectedOwnerIndex)
    const owner=state.players[index]
    if (!owner || owner.id!==state.currentPlayerId) return state
    const players=[...state.players] as [Player,Player]
    players[index]={...owner,field:owner.field.map(f=>f.cardId==='C115'&&f.health>0&&
      (f.dendroBurningTriggersThisTurn??0)<2?{...f,attack:f.attack+1,
        dendroBurningTriggersThisTurn:(f.dendroBurningTriggersThisTurn??0)+1}:f)}
    return {...state,players}
  }
  if (!reaction || ['vaporize', 'melt', 'frozen', 'superconduct', 'quicken'].includes(reaction)) {
    // これらの状態変化は resolveElementalDamage 側で完了する
    return state
  }

  const players = [...state.players] as [Player, Player]
  const affected = players[affectedOwnerIndex]
  if (!affected) return state

  if (reaction === 'bloom') {
    // Canonical Ver.1.0.1: the core appears on the opponent's field
    // relative to the player who triggered Bloom.
    // sourceOwnerIndex is the trigger side, even if the reaction target changes.
    const triggerIndex = sourceOwnerIndex ?? (1 - affectedOwnerIndex)
    const ownerIndex = 1 - triggerIndex
    const owner = players[ownerIndex]
    const oldCore = owner.field.find(f => f.cardId === 'dendro-core')
    if (oldCore) {
      players[ownerIndex] = {
        ...owner,
        field: owner.field.map(f => f.instanceId === oldCore.instanceId
          ? { ...f, health: f.health + 1, maxHealth: f.maxHealth + 1 } : f),
      }
    } else if (owner.field.length + (owner.amulets?.length ?? 0) < 5) {
      players[ownerIndex] = {
        ...owner,
        field: [...owner.field, createDendroCore()],
      }
    }
    return { ...state, players }
  }

  if (reaction === 'burgeon' || reaction === 'hyperbloom') {
    const core = affected.field.find(f => f.instanceId === affectedInstanceId)
    if (!core || core.cardId !== 'dendro-core') return state
    if (reaction === 'burgeon') {
      players[affectedOwnerIndex] = {
        ...affected,
        field: affected.field.map(f => f.instanceId === core.instanceId
          ? { ...f, health: 0 } : f),
        leaderBurningTurns: 3,
      }
      return { ...state, players }
    }
    // Hyperbloom: one random allied follower takes 3 damage.
    // Prefer other followers; if only the core exists, it remains the sole target.
    const candidates = affected.field.filter(f =>
      f.instanceId !== core.instanceId && f.health > 0)
    const chosen = candidates[Math.floor(Math.random() * candidates.length)]
    players[affectedOwnerIndex] = {
      ...affected,
      field: affected.field.map(f => {
        if (f.instanceId === core.instanceId) return { ...f, health: 0 }
        return chosen && f.instanceId === chosen.instanceId
          ? absorbDamage(f, 3) : f
      }),
    }
    return { ...state, players }
  }

  if (reaction === 'crystallize') {
    // 結晶シールドは反応を発生させた側に付与する（現段階では1ポイント）
    const ownerIndex = 1 - affectedOwnerIndex
    const owner = players[ownerIndex]
    const source = owner.field[0]
    if (!source) return state
    players[ownerIndex] = {
      ...owner,
      field: owner.field.map(f => f.instanceId === source.instanceId
        ? grantShield(f, 'crystallize', 1)
        : f),
    }
    return { ...state, players }
  }

  if (reaction === 'swirl' && reactedElement) {
    // 同じ敵陣の別フォロワー全員へ1ダメージと拡散元素を付着。
    // 拡散した攻撃は二次反応を起こせるが、再拡散は行わない。
    players[affectedOwnerIndex] = {
      ...affected,
      field: affected.field.map(f => {
        if (f.instanceId === affectedInstanceId || f.health <= 0) return f
        return resolveElementalDamage(f, 1, reactedElement).follower
      }),
    }
    let next: GameState = { ...state, players }
    const attackerIndex = sourceOwnerIndex ?? (1 - affectedOwnerIndex)
    const owner = next.players[attackerIndex]
    // Sucrose: draw once for the first Swirl created on its owner's turn.
    if (owner?.id === next.currentPlayerId) {
      const sources = owner.field.filter(f => f.cardId === 'C079' && f.health > 0 &&
        (f.swirlDrawsThisTurn ?? 0) < 1)
      for (const source of sources) {
        const players = [...next.players] as [Player, Player]
        const current = players[attackerIndex]
        const [drawn, ...deck] = current.deck
        players[attackerIndex] = {
          ...current,
          deck: drawn ? deck : current.deck,
          hand: drawn && current.hand.length < 9 ? [...current.hand, drawn] : current.hand,
          field: current.field.map(f => f.instanceId === source.instanceId
            ? { ...f, swirlDrawsThisTurn: (f.swirlDrawsThisTurn ?? 0) + 1 } : f),
        }
        next = { ...next, players,
          winnerId: drawn ? next.winnerId : next.players[1 - attackerIndex].id }
        if (next.winnerId !== null) break
      }
    }
    return next
  }

  if (reaction === 'overloaded') {
    // Chevreuse: every overload caused on her owner's turn permanently buffs
    // all friendly followers (including Chevreuse), with no trigger limit.
    const actorIndex = sourceOwnerIndex ?? (1 - affectedOwnerIndex)
    const actor = players[actorIndex]
    const chevreuseCount = actor && actor.id === state.currentPlayerId
      ? actor.field.filter(f => f.cardId === 'C022' && f.health > 0).length : 0
    if (chevreuseCount > 0) {
      players[actorIndex] = {
        ...actor,
        field: actor.field.map(f => f.health > 0
          ? { ...f, attack: f.attack + chevreuseCount } : f),
      }
    }
    const target = affected.field.find(f => f.instanceId === affectedInstanceId)
    const card = target && getCard(target.cardId)
    if (!target || !card || card.cost > 5 || target.health <= 0) {
      return { ...state, players }
    }
    players[affectedOwnerIndex] = {
      ...affected,
      field: affected.field.filter(f => f.instanceId !== affectedInstanceId),
      hand: affected.hand.length < 9
        ? [...affected.hand, target.cardId] : affected.hand,
    }
    return { ...state, players }
  }

  if (reaction === 'electro_charged') {
    const other = affected.field.find(
      f => f.instanceId !== affectedInstanceId && f.health > 0
    )
    if (other) {
      players[affectedOwnerIndex] = {
        ...affected,
        field: affected.field.map(f =>
          f.instanceId === other.instanceId ? absorbDamage(f, 1) : f),
      }
    } else {
      // Existing electro-charged damage is non-elemental; shields still absorb.
      const before = affected.leaderShield ?? { normal: 0, crystallize: 0 }
      let remaining = 1
      const normal = Math.min(before.normal, remaining)
      remaining -= normal
      const crystal = Math.min(before.crystallize, remaining)
      remaining -= crystal
      players[affectedOwnerIndex] = {
        ...affected,
        leaderShield: { normal: before.normal - normal, crystallize: before.crystallize - crystal },
        leaderHealth: Math.max(0, affected.leaderHealth - remaining),
      }
    }
    let next: GameState = { ...state, players }
    if (next.players[affectedOwnerIndex].leaderHealth <= 0) {
      return { ...next, winnerId: next.players[1 - affectedOwnerIndex].id }
    }
    const actorIndex = sourceOwnerIndex ?? (1 - affectedOwnerIndex)
    if (next.players[actorIndex].id !== next.currentPlayerId) return next
    // Each Ororon separately triggers up to twice on its owner's turn.
    const ids = next.players[actorIndex].field
      .filter(f => f.cardId === 'C067' && f.health > 0 &&
        (f.electroChargedTriggersThisTurn ?? 0) < 2).map(f => f.instanceId)
    for (const id of ids) {
      const actor = next.players[actorIndex]
      const ororon = actor.field.find(f => f.instanceId === id && f.health > 0)
      if (!ororon) continue
      const enemies = next.players[1 - actorIndex].field.filter(f => f.health > 0)
      const marked = [...next.players] as [Player, Player]
      marked[actorIndex] = { ...actor,
        field: actor.field.map(f => f.instanceId === id
          ? { ...f, electroChargedTriggersThisTurn: (f.electroChargedTriggersThisTurn ?? 0) + 1 }
          : f) }
      next = { ...next, players: marked }
      if (!enemies.length) continue
      const victim = enemies[Math.floor(Math.random() * enemies.length)]
      const outcome = resolveElementalDamage(victim, 1, 'electro')
      const updated = [...next.players] as [Player, Player]
      updated[1 - actorIndex] = { ...updated[1 - actorIndex],
        field: updated[1 - actorIndex].field.map(f =>
          f.instanceId === victim.instanceId ? outcome.follower : f) }
      // Secondary reactions are resolved once; capped trigger counts prevent loops.
      next = resolveReactionConsequence({ ...next, players: updated },
        1 - actorIndex, victim.instanceId, outcome.reaction, outcome.reactedElement, actorIndex)
      if (next.winnerId !== null) break
    }
    return next
  }
  return state
}

const reactionLabels: Record<ElementalReaction,string> = {
  vaporize:'蒸発', melt:'溶解', electro_charged:'感電', overloaded:'過負荷',
  frozen:'凍結', superconduct:'超電導', burning:'燃焼', quicken:'激化',
  swirl:'拡散', crystallize:'結晶', bloom:'開花', burgeon:'烈開花',
  hyperbloom:'超開花',
}

/** Reaction names are recorded for cinematic display; rules stay synchronous. */
export function resolveReactionConsequence(
  state: GameState,
  affectedOwnerIndex: number,
  affectedInstanceId: string,
  reaction: ElementalReaction | null,
  reactedElement?: ElementType,
  sourceOwnerIndex?: number,
): GameState {
  const resolved = resolveReactionConsequenceCore(state, affectedOwnerIndex,
    affectedInstanceId, reaction, reactedElement, sourceOwnerIndex)
  return reaction ? captureFrame(resolved, `元素反応：${reactionLabels[reaction]}`) : resolved
}

/** Shared leader elemental hit path for attacks and card effects.
 * Resolve collateral effects on the board without exposing internal state.
 * Leaders cannot be affected by Quicken, Burgeon or Hyperbloom directly.
 */
export function resolveLeaderElementalHit(
  state: GameState,
  affectedIndex: number,
  amount: number,
  element?: ElementType,
  sourceOwnerIndex: number = 1 - affectedIndex,
): GameState {
  const target = state.players[affectedIndex]
  if (!target) return state
  const hit = damageLeaderWithReaction(target, amount, element)
  const players = [...state.players] as [Player, Player]
  players[affectedIndex] = hit.player
  let next: GameState = { ...state, players,
    winnerId: hit.player.leaderHealth <= 0 ? players[1 - affectedIndex].id : state.winnerId }
  if (next.winnerId !== null || !hit.reaction) return next
  if (hit.reaction === 'bloom') {
    // Same placement as follower Bloom: the triggering player's opponent.
    const ownerIndex = 1 - sourceOwnerIndex
    const owner = next.players[ownerIndex]
    const core = owner.field.find(f => f.cardId === 'dendro-core')
    const updated = [...next.players] as [Player, Player]
    if (core) {
      updated[ownerIndex] = { ...owner, field: owner.field.map(f =>
        f.instanceId === core.instanceId
          ? { ...f, health: f.health + 1, maxHealth: f.maxHealth + 1 } : f) }
    } else if (owner.field.length + (owner.amulets?.length ?? 0) < 5) {
      updated[ownerIndex] = { ...owner, field: [...owner.field, createDendroCore()] }
    }
    next = { ...next, players: updated }
  } else if (hit.reaction === 'electro_charged') {
    // The target is the leader: hit another follower first, or that leader if none exists.
    const other = next.players[affectedIndex].field.find(f => f.health > 0)
    if (other) {
      const updated = [...next.players] as [Player, Player]
      updated[affectedIndex] = { ...updated[affectedIndex], field: updated[affectedIndex].field.map(f =>
        f.instanceId === other.instanceId ? absorbDamage(f, 1) : f) }
      next = { ...next, players: updated }
    } else {
      const updated = [...next.players] as [Player, Player]
      const current = updated[affectedIndex]
      const shield = current.leaderShield ?? { normal: 0, crystallize: 0 }
      let remaining = 1
      const normal = Math.min(shield.normal, remaining)
      remaining -= normal
      const crystallize = Math.min(shield.crystallize, remaining)
      remaining -= crystallize
      const leaderHealth = Math.max(0, current.leaderHealth - remaining)
      updated[affectedIndex] = { ...current, leaderHealth,
        leaderShield: { normal: shield.normal - normal, crystallize: shield.crystallize - crystallize } }
      next = { ...next, players: updated,
        winnerId: leaderHealth <= 0 ? updated[1 - affectedIndex].id : next.winnerId }
    }
  } else if (hit.reaction === 'swirl' && hit.reactedElement) {
    // Swirl from a leader spreads the absorbed element across target-side followers.
    for (const victim of next.players[affectedIndex].field.filter(f => f.health > 0)) {
      const current = next.players[affectedIndex].field.find(f => f.instanceId === victim.instanceId)
      if (!current || current.health <= 0) continue
      const outcome = resolveElementalDamage(current, 1, hit.reactedElement)
      const updated = [...next.players] as [Player, Player]
      updated[affectedIndex] = { ...updated[affectedIndex], field: updated[affectedIndex].field.map(f =>
        f.instanceId === victim.instanceId ? outcome.follower : f) }
      next = resolveReactionConsequence({ ...next, players: updated }, affectedIndex,
        victim.instanceId, outcome.reaction, outcome.reactedElement, sourceOwnerIndex)
      if (next.winnerId !== null) break
    }
  } else if (hit.reaction === 'crystallize') {
    // Leader-target crystallize grants 1 crystallize shield to the attacking leader.
    const updated = [...next.players] as [Player, Player]
    updated[sourceOwnerIndex] = addLeaderShield(updated[sourceOwnerIndex], 1, 'crystallize')
    next = { ...next, players: updated }
  }

  return captureFrame(next, `リーダーの元素反応：${reactionLabels[hit.reaction]}`)
}
