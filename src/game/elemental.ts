import type { ElementType, Follower, GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'

/** 元素生物の固有付着。風・岩も常時保持する。 */
function inherentElement(follower: Follower): ElementType | undefined {
  const card = getCard(follower.cardId)
  return card?.elementalCreature ? card.element : undefined
}

export function restoreInherentAura(follower: Follower): Follower {
  const element = inherentElement(follower)
  if (!element || element === 'none' ||
      follower.aura.some(aura => aura.element === element)) return follower
  return { ...follower, aura: [...follower.aura, { element }] }
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
  let remaining = Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0
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
 * 既存の付着を変更せず、新しい元素を記録するための基礎処理。
 * 反応の判定は resolveElementalDamage が行う。
 */
export function applyElementalAura(
  follower: Follower,
  element?: ElementType
): Follower {
  if (!element || element === 'none' ||
      element === 'anemo' || element === 'geo') {
    return restoreInherentAura(follower)
  }

  if (follower.aura.some(aura => aura.element === element)) {
    return restoreInherentAura(follower)
  }

  return restoreInherentAura({
    ...follower,
    aura: [...follower.aura, { element }],
  })
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
 * 未実装の反応ペアは暫定的に付着を保持する。
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

  const base = Number.isFinite(baseDamage)
    ? Math.max(0, Math.trunc(baseDamage)) : 0
  const physicalBonus = (!incomingElement || incomingElement === 'none') &&
    follower.keywords.includes('superconduct') && base > 0 ? 2 : 0
  const physicalKeywords = physicalBonus
    ? follower.keywords.filter(k => k !== 'superconduct') : follower.keywords

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
export function resolveReactionConsequence(
  state: GameState,
  affectedOwnerIndex: number,
  affectedInstanceId: string,
  reaction: ElementalReaction | null,
  reactedElement?: ElementType,
  sourceOwnerIndex?: number
): GameState {
  if (!reaction || ['vaporize', 'melt', 'frozen', 'superconduct', 'burning', 'quicken'].includes(reaction)) {
    // これらの状態変化は resolveElementalDamage 側で完了する
    return state
  }

  const players = [...state.players] as [Player, Player]
  const affected = players[affectedOwnerIndex]
  if (!affected) return state

  if (reaction === 'bloom') {
    // Bloom belongs to the player who triggered the reaction.
    // If a core already exists, rebloom strengthens that core by +1 health.
    const ownerIndex = sourceOwnerIndex ?? (1 - affectedOwnerIndex)
    const owner = players[ownerIndex]
    const oldCore = owner.field.find(f => f.cardId === 'dendro-core')
    if (oldCore) {
      players[ownerIndex] = {
        ...owner,
        field: owner.field.map(f => f.instanceId === oldCore.instanceId
          ? { ...f, health: f.health + 1, maxHealth: f.maxHealth + 1 } : f),
      }
    } else if (owner.field.length < 5) {
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
    return { ...state, players }
  }

  if (reaction === 'overloaded') {
    // Chevreuse: every overload caused on her owner's turn permanently buffs
    // all friendly followers (including Chevreuse), with no trigger limit.
    const actorIndex = sourceOwnerIndex ?? (1 - affectedOwnerIndex)
    const actor = players[actorIndex]
    if (actor && actor.id === state.currentPlayerId &&
        actor.field.some(f => f.cardId === 'C022' && f.health > 0)) {
      players[actorIndex] = {
        ...actor,
        field: actor.field.map(f => f.health > 0
          ? { ...f, attack: f.attack + 1 } : f),
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
      return { ...state, players }
    }
    const hp = Math.max(0, affected.leaderHealth - 1)
    players[affectedOwnerIndex] = { ...affected, leaderHealth: hp }
    return { ...state, players,
      winnerId: hp === 0 ? state.players[1 - affectedOwnerIndex].id : state.winnerId }
  }
  return state
}
