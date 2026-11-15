
import type { Card } from '../game/types'

export const testCards: Card[] = [
  {
    id: 'test-slime',
    name: '炎スライム',
    type: 'follower',
    rarity: 'bronze',
    element: 'pyro',
    cost: 1,
    attack: 1,
    health: 2,
    description: 'テスト用フォロワー',
  },
  {
    id: 'test-hilichurl',
    name: 'ヒルチャール',
    type: 'follower',
    rarity: 'bronze',
    element: 'none',
    cost: 2,
    attack: 2,
    health: 2,
    description: 'テスト用フォロワー',
  },
  {
    id: 'test-mage',
    name: 'アビスの魔術師',
    type: 'follower',
    rarity: 'silver',
    element: 'hydro',
    cost: 3,
    attack: 2,
    health: 4,
    description: 'テスト用フォロワー',
  },
]
