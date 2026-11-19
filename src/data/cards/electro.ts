import type { Card } from '../../game/types'

/** Ver.1.0確定済み雷元素15枚（C056–C070）。
 * STEP35で雷元素全15枚の特殊能力を対戦エンジンに接続。
 */
export const electroCards: Card[] = [
  {
    "id": "C056",
    "name": "雷スライム",
    "type": "follower",
    "rarity": "bronze",
    "element": "electro",
    "cost": 1,
    "attack": 2,
    "health": 2,
    "traits": [
      "スライム"
    ],
    "description": "【元素生物：雷】",
    "implementationStatus": "playable",
    "elementalCreature": true
  },
  {
    "id": "C057",
    "name": "グルグル雷キノコン",
    "type": "follower",
    "rarity": "bronze",
    "element": "electro",
    "cost": 2,
    "attack": 1,
    "health": 3,
    "region": [
      "スメール"
    ],
    "traits": [
      "キノコン"
    ],
    "description": "【ラストワード】ランダム敵フォロワーに雷元素2ダメージ。",
    "implementationStatus": "playable"
  },
  {
    "id": "C058",
    "name": "ライノ仔竜",
    "type": "follower",
    "rarity": "bronze",
    "element": "electro",
    "cost": 2,
    "attack": 2,
    "health": 2,
    "region": [
      "ナタ"
    ],
    "traits": [
      "竜"
    ],
    "description": "【突進】",
    "implementationStatus": "playable",
    "keywords": [
      "rush"
    ]
  },
  {
    "id": "C059",
    "name": "雷フライム",
    "type": "follower",
    "rarity": "bronze",
    "element": "electro",
    "cost": 3,
    "attack": 2,
    "health": 3,
    "traits": [
      "フライム"
    ],
    "description": "【元素生物：雷】【ラストワード】相手リーダーに雷元素2ダメージ。",
    "implementationStatus": "playable",
    "elementalCreature": true
  },
  {
    "id": "C060",
    "name": "夜の幻現",
    "type": "spell",
    "rarity": "silver",
    "element": "electro",
    "cost": 4,
    "region": [
      "モンド"
    ],
    "description": "相手の場のフォロワー1枚を選ぶ。それは雷元素3ダメージを受ける。「オズ」1体を召喚する。",
    "implementationStatus": "playable",
    "effects": [
      {
        "type": "damage",
        "trigger": "on_play",
        "target": "selected_enemy_follower",
        "value": 3,
        "element": "electro"
      }
    ]
  },
  {
    "id": "C061",
    "name": "御詠鳴神刈山祭",
    "type": "spell",
    "rarity": "silver",
    "element": "electro",
    "cost": 3,
    "region": [
      "稲妻"
    ],
    "description": "ランダムな敵フォロワーに雷元素1ダメージ×3回。自分のリーダーの現在HPが10以下なら代わりに5回。",
    "implementationStatus": "playable"
  },
  {
    "id": "C062",
    "name": "ファデュイ・雷蛍術師",
    "type": "follower",
    "rarity": "silver",
    "element": "electro",
    "cost": 4,
    "attack": 2,
    "health": 4,
    "traits": [
      "ファデュイ"
    ],
    "description": "【ファンファーレ】「雷蛍」2体召喚。【自分のターン終了時】自分の場に雷蛍がいれば自身に通常シールド2。",
    "implementationStatus": "playable"
  },
  {
    "id": "C063",
    "name": "獣域ハウンド・雷",
    "type": "follower",
    "rarity": "silver",
    "element": "electro",
    "cost": 4,
    "attack": 3,
    "health": 3,
    "traits": [
      "アビス"
    ],
    "description": "【元素攻撃：雷】【攻撃時】相手リーダーに非元素1ダメージ。",
    "implementationStatus": "playable",
    "normalAttackElement": "electro"
  },
  {
    "id": "C064",
    "name": "断罪の皇女・フィッシュル",
    "type": "follower",
    "rarity": "gold",
    "element": "electro",
    "cost": 3,
    "attack": 2,
    "health": 3,
    "region": [
      "モンド"
    ],
    "traits": [
      "冒険者協会"
    ],
    "description": "【自分のターン終了時】自分の場のランダムな「オズ」1体に【潜伏】を付与。【元素スキル：夜巡りの翼】PP2：「オズ」1体を召喚。",
    "elementalSkill": {"name":"夜巡りの翼","ppCost":2,"effects":[]},
    "implementationStatus": "playable"
  },
  {
    "id": "C065",
    "name": "荒瀧派の二番手・久岐忍",
    "type": "follower",
    "rarity": "gold",
    "element": "electro",
    "cost": 3,
    "attack": 2,
    "health": 4,
    "region": [
      "稲妻"
    ],
    "traits": [
      "荒瀧派"
    ],
    "description": "【自分のターン終了時】自リーダー1回復。【元素スキル：越祓雷草の輪】PP1：自身に1ダメージ。自リーダー2回復。ランダム敵フォロワー1体に雷元素1ダメージ。",
    "elementalSkill": {"name":"越祓雷草の輪","ppCost":1,"effects":[]},
    "implementationStatus": "playable"
  },
  {
    "id": "C066",
    "name": "天領奉行の大将・九条裟羅",
    "type": "follower",
    "rarity": "gold",
    "element": "electro",
    "cost": 4,
    "attack": 3,
    "health": 4,
    "region": [
      "稲妻"
    ],
    "traits": [
      "天領奉行"
    ],
    "description": "【ファンファーレ】自分の場の他の雷元素フォロワー1枚を選ぶ。それは+1/+0する。【元素スキル：烏天狗雷霆召呪】PP1：自分の場の雷元素フォロワー1枚を選ぶ。それは+2/+0する。ランダム敵フォロワー1体に雷元素1ダメージ。",
    "elementalSkill": {"name":"烏天狗雷霆召呪","ppCost":1,"effects":[]},
    "implementationStatus": "playable"
  },
  {
    "id": "C067",
    "name": "謎煙の主の青年・オロルン",
    "type": "follower",
    "rarity": "gold",
    "element": "electro",
    "cost": 3,
    "attack": 2,
    "health": 4,
    "region": [
      "ナタ"
    ],
    "traits": [
      "謎煙の主"
    ],
    "description": "【自分のターン中】自分が感電を起こしたとき、ランダム敵フォロワー1体に雷元素1ダメージ（1ターン最大2回）。【元素スキル：冥色のタイトロープ】PP1：相手の場のフォロワー1枚を選ぶ。それは雷元素2ダメージを受ける。別のランダムな敵フォロワー1体に雷元素1ダメージ。",
    "elementalSkill": {"name":"冥色のタイトロープ","ppCost":1,"effects":[{"type":"damage","trigger":"skill","target":"selected_enemy_follower","value":2,"element":"electro"}]},
    "implementationStatus": "playable"
  },
  {
    "id": "C068",
    "name": "大マハマトラ・セノ",
    "type": "follower",
    "rarity": "legendary",
    "element": "electro",
    "cost": 5,
    "attack": 4,
    "health": 5,
    "region": [
      "スメール"
    ],
    "traits": [
      "教令院"
    ],
    "description": "【突進】【元素スキル：秘儀・律淵渡魂】PP1：相手の場のフォロワー1枚を選ぶ。それは雷元素2ダメージを受ける。【元素爆発：聖儀・狼駆憑走】エネルギー3：自身+2/+2、【2回攻撃】【元素攻撃：雷】を付与。",
    "elementalSkill": {"name":"秘儀・律淵渡魂","ppCost":1,"effects":[{"type":"damage","trigger":"skill","target":"selected_enemy_follower","value":2,"element":"electro"}]},
    "elementalBurst": {"name":"聖儀・狼駆憑走","energyCost":3,"effects":[]},
    "implementationStatus": "playable",
    "keywords": [
      "rush"
    ]
  },
  {
    "id": "C069",
    "name": "鳴神大社の宮司・八重神子",
    "type": "follower",
    "rarity": "legendary",
    "element": "electro",
    "cost": 5,
    "attack": 3,
    "health": 5,
    "region": [
      "稲妻"
    ],
    "description": "【元素攻撃：雷】【元素スキル：野干役呪・殺生櫻】PP1：「殺生櫻」1つを出す（1ターン最大3回）。【元素爆発：大密法・天狐顕現】エネルギー3：敵フォロワーすべてに雷元素3ダメージ。自分の「殺生櫻」すべてを破壊。破壊数だけランダムな敵フォロワーまたはリーダーに雷元素2ダメージ。",
    "elementalSkill": {"name":"野干役呪・殺生櫻","ppCost":1,"effects":[]},
    "elementalBurst": {"name":"大密法・天狐顕現","energyCost":3,"effects":[]},
    "implementationStatus": "playable",
    "normalAttackElement": "electro"
  },
  {
    "id": "C070",
    "name": "のんびり屋の力自慢・ヴァレサ",
    "type": "follower",
    "rarity": "legendary",
    "element": "electro",
    "cost": 5,
    "attack": 5,
    "health": 5,
    "region": [
      "ナタ"
    ],
    "traits": [
      "豊穣の邦"
    ],
    "description": "【突進】【攻撃時】自身+1/+0。【元素スキル：夜虹の飛翔】PP1：自身に【元素攻撃：雷】【落下攻撃】付与。【元素爆発：閃烈降臨！】エネルギー3：敵フォロワーすべてに雷元素3ダメージ。自身+2/+0。",
    "elementalSkill": {"name":"夜虹の飛翔","ppCost":1,"effects":[]},
    "elementalBurst": {"name":"閃烈降臨！","energyCost":3,"effects":[]},
    "implementationStatus": "playable",
    "keywords": [
      "rush"
    ]
  }
]
