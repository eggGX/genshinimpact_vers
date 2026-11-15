import type { Card } from '../game/types'

/** Source: genshin_rulebook_v1.md / 6. トークン・特殊カード. */
export const productionTokens: Card[] = [
  {
    id: 'token-baron-bunny',
    name: 'ウサギ伯爵',
    type: 'follower',
    rarity: 'bronze',
    element: 'pyro',
    cost: 1,
    attack: 0,
    health: 3,
    token: true,
    keywords: ['guard', 'damage_cap_1'],
    description: '【守護】【ラストワード】相手のフォロワーすべてとリーダーに炎元素1ダメージ。受ける2以上のダメージを1にする。',
  },
  {
    id: 'token-guoba',
    name: 'グゥオパァー',
    type: 'follower',
    rarity: 'bronze',
    element: 'pyro',
    cost: 2,
    attack: 1,
    health: 3,
    token: true,
    description: '【自分のターン終了時】ランダムな敵フォロワーまたはリーダーに炎元素2ダメージ。これを2回。',
  },
]
