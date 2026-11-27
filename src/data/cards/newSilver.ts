import type { Card } from '../../game/types'

/** Additional silver cards, added individually without changing the original set. */
export const newSilverCards: Card[] = [
  {
    id: 'C116',
    implementationStatus: 'playable',
    name: '荒野の呪い',
    type: 'spell',
    rarity: 'silver',
    element: 'none',
    cost: 4,
    description: '自分か相手の場のフォロワー1枚を選ぶ。それを「ヒルチャール」に変身させる。',
  },
]
