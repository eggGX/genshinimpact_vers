
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
    description: 'ラストワード：自分のリーダーを2回復。',
    effects: [
      {
        type: 'heal',
        trigger: 'on_destroy',
        target: 'own_leader',
        value: 2,
      },
    ],
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
    description:
      'ファンファーレ：相手リーダーに2ダメージ。',
    effects: [
      {
        type: 'damage',
        trigger: 'on_play',
        target: 'enemy_leader',
        value: 2,
      },
    ],
  },
  {
    id: 'test-archer',
    name: '氷の射手',
    type: 'follower',
    rarity: 'silver',
    element: 'cryo',
    cost: 2,
    attack: 1,
    health: 2,
    description:
      'ファンファーレ：選択した敵フォロワーに2ダメージ。',
    effects: [
      {
        type: 'damage',
        trigger: 'on_play',
        target: 'selected_enemy_follower',
        value: 2,
      },
    ],
  },
  {
    id: 'test-shaman',
    name: 'ヒルチャールの祈祷師',
    type: 'follower',
    rarity: 'silver',
    element: 'none',
    cost: 2,
    attack: 1,
    health: 3,
    description:
      '自分のターン終了時、自分のリーダーを1回復。',
    effects: [
      {
        type: 'heal',
        trigger: 'turn_end',
        target: 'own_leader',
        value: 1,
      },
    ],
  },
  {
    id: 'test-trainee',
    name: '訓練兵',
    type: 'follower',
    rarity: 'bronze',
    element: 'none',
    cost: 2,
    attack: 2,
    health: 2,
    description:
      'ファンファーレ：自身を+1/+2する。',
    effects: [
      {
        type: 'modify_stats',
        trigger: 'on_play',
        target: 'self_follower',
        attackChange: 1,
        healthChange: 2,
      },
    ],
  },
  {
    id: 'test-electro-mage',
    name: '雷の術師',
    type: 'follower',
    rarity: 'silver',
    element: 'electro',
    cost: 3,
    attack: 2,
    health: 3,
    description:
      'ファンファーレ：選択した敵フォロワーの攻撃力を1下げる。',
    effects: [
      {
        type: 'modify_stats',
        trigger: 'on_play',
        target: 'selected_enemy_follower',
        attackChange: -1,
        healthChange: 0,
      },
    ],
  },
]
