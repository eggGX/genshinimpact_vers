import type { ElementType, Follower, GameState, Player } from './types'
import { testCards } from '../data/testCards'

export type ElementalReaction = 'vaporize' | 'melt' | 'electro_charged' | 'overloaded' | 'frozen'

export interface ElementalDamageResult {
  follower: Follower
  damage: number
  reaction: ElementalReaction | null
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
    return follower
  }

  if (follower.aura.some(aura => aura.element === element)) {
    return follower
  }

  return {
    ...follower,
    aura: [...follower.aura, { element }],
  }
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
  const base = Number.isFinite(baseDamage)
    ? Math.max(0, Math.trunc(baseDamage))
    : 0

  const index = incomingElement
    ? follower.aura.findIndex(aura =>
        reactionFor(aura.element, incomingElement) !== null
      )
    : -1

  if (index >= 0 && incomingElement) {
    const reaction = reactionFor(
      follower.aura[index].element,
      incomingElement
    )

    const damage = base +
      (reaction === 'melt' ? 3 : reaction === 'vaporize' ? 2 : 0)
    const remainingAuras = follower.aura.filter((_, i) => i !== index)
    const keywords = reaction === 'frozen'
      ? [...new Set([...follower.keywords, 'frozen'])]
      : follower.keywords
    return {
      follower: {
        ...follower,
        health: follower.health - damage,
        aura: remainingAuras,
        keywords,
      },
      damage,
      reaction,
    }
  }

  const damaged = {
    ...follower,
    health: follower.health - base,
  }

  return {
    follower: applyElementalAura(damaged, incomingElement),
    damage: base,
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
  reaction: ElementalReaction | null
): GameState {
  if (!reaction || reaction === 'vaporize' || reaction === 'melt' ||
      reaction === 'frozen') return state

  const players = [...state.players] as [Player, Player]
  const affected = players[affectedOwnerIndex]

  if (reaction === 'overloaded') {
    const target = affected.field.find(f => f.instanceId === affectedInstanceId)
    const card = target && testCards.find(c => c.id === target.cardId)
    if (!target || !card || card.cost > 5 || target.health <= 0) return state
    players[affectedOwnerIndex] = {
      ...affected,
      field: affected.field.filter(f => f.instanceId !== affectedInstanceId),
      hand: affected.hand.length < 9
        ? [...affected.hand, target.cardId]
        : affected.hand,
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
          f.instanceId === other.instanceId
            ? { ...f, health: f.health - 1 }
            : f
        ),
      }
      return { ...state, players }
    }

    const hp = Math.max(0, affected.leaderHealth - 1)
    players[affectedOwnerIndex] = { ...affected, leaderHealth: hp }
    return {
      ...state,
      players,
      winnerId: hp === 0 ? state.players[1 - affectedOwnerIndex].id : state.winnerId,
    }
  }
  return state
}
