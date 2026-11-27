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
    description: '自分か相手の場のフォロワー1枚を選ぶ。それは「ヒルチャール」に変身する。',
  },
  {
    id: 'C117',
    implementationStatus: 'playable',
    name: '反魂の歌',
    type: 'spell',
    rarity: 'silver',
    element: 'pyro',
    cost: 2,
    description: '自分の場のフォロワー1枚を選ぶ。それは「【ラストワード】これと同名のフォロワー1体を自分の場に出す。」をもつ。',
  },
]
