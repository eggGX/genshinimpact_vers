import type { ElementType, Follower } from './types'

/**
 * ダメージに元素属性が付いている場合の付着処理。
 * 風・岩・無元素は付着しない。
 * 異なる元素が重なった場合の反応判定は次のSTEPで実装する。
 */
export function applyElementalAura(
  follower: Follower,
  element?: ElementType
): Follower {
  if (!element || element === 'none' ||
      element === 'anemo' || element === 'geo') {
    return follower
  }

  // 同じ元素の重複登録はしない（後で付着維持・反応ルールを拡張）
  if (follower.aura.some(aura => aura.element === element)) {
    return follower
  }

  return {
    ...follower,
    aura: [...follower.aura, { element }],
  }
}
