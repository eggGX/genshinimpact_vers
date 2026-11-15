import type { ElementType, Follower } from './types'

export type AmplifyingReaction = 'vaporize' | 'melt'

export interface ElementalDamageResult {
  follower: Follower
  damage: number
  reaction: AmplifyingReaction | null
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
): AmplifyingReaction | null {
  if (
    (attached === 'pyro' && incoming === 'hydro') ||
    (attached === 'hydro' && incoming === 'pyro')
  ) return 'vaporize'

  if (
    (attached === 'pyro' && incoming === 'cryo') ||
    (attached === 'cryo' && incoming === 'pyro')
  ) return 'melt'

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

    const damage = base + (reaction === 'melt' ? 3 : 2)
    return {
      follower: {
        ...follower,
        health: follower.health - damage,
        aura: follower.aura.filter((_, i) => i !== index),
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
