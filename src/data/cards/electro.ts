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
    "description": "【ラストワード】ランダムな相手フォロワー1体に雷元素2ダメージ。",
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
    "description": "【元素生物：雷】\n【ラストワード】相手のリーダーに雷元素2ダメージ。",
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
    "description": "相手の場のフォロワー1枚を選ぶ。それに雷元素3ダメージ。\n「オズ」1体を自分の場に出す。",
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
    "description": "ランダムな相手フォロワー1体に雷元素1ダメージ。これをX回行う。Xは自分のリーダーの現在HPが10以下なら5、そうでなければ3である。",
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
    "description": "【ファンファーレ】「雷蛍」2体を自分の場に出す。\n自分のターン終了時、自分の場に「雷蛍」がいれば、このフォロワーは通常シールド2をもつ。",
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
    "description": "【元素攻撃：雷】\n【攻撃時】相手のリーダーに1ダメージ。",
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
    "description": "自分のターン終了時、自分の場のランダムな「オズ」1体は【潜伏】を持つ。\n【元素スキル：夜巡りの翼】\nコスト：PP2\n「オズ」1体を自分の場に出す。",
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
    "description": "自分のターン終了時、自分のリーダー1回復。\n【元素スキル：越祓雷草の輪】\nコスト：PP1\nこのフォロワーに1ダメージ。\n自分のリーダー2回復。\nランダムな相手フォロワー1体に雷元素1ダメージ。",
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
    "description": "【ファンファーレ】自分の場の他の雷元素フォロワー1枚を選ぶ。それは+1/+0する。\n【元素スキル：烏天狗雷霆召呪】\nコスト：PP1\n自分の場の雷元素フォロワー1枚を選ぶ。それは+2/+0する。\nランダムな相手フォロワー1体に雷元素1ダメージ。",
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
    "description": "自分のターン中、自分が感電を起こしたとき、ランダムな相手フォロワー1体に雷元素1ダメージ（1ターン最大2回）。\n【元素スキル：冥色のタイトロープ】\nコスト：PP1\n相手の場のフォロワー1枚を選ぶ。それに雷元素2ダメージ。\n選んだフォロワーとは別のランダムな相手フォロワー1体に雷元素1ダメージ。",
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
    "description": "【突進】\n【元素スキル：秘儀・律淵渡魂】\nコスト：PP1\n相手の場のフォロワー1枚を選ぶ。それに雷元素2ダメージ。\n【元素爆発：聖儀・狼駆憑走】\nコスト：元素エネルギー_3\nこのフォロワーを+2/+2する。\nこのフォロワーは【2回攻撃】【元素攻撃：雷】をもつ。",
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
    "description": "【元素攻撃：雷】\n【元素スキル：野干役呪・殺生櫻】\nコスト：PP1\n「殺生櫻」1つを出す（1ターン最大3回）。\n【元素爆発：大密法・天狐顕現】\nコスト：元素エネルギー_3\n相手の場のフォロワーすべてに雷元素3ダメージ。\n自分の「殺生櫻」すべてを破壊。\nランダムな相手フォロワーまたは相手のリーダー1体に雷元素2ダメージ。これをX回行う。Xはこの効果で破壊した「殺生櫻」の数である。",
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
    "description": "【突進】\n【攻撃時】このフォロワーを+1/+0する。\n【元素スキル：夜虹の飛翔】\nコスト：PP1\nこのフォロワーは【元素攻撃：雷】【落下攻撃】をもつ。\n【元素爆発：閃烈降臨！】\nコスト：元素エネルギー_3\n相手の場のフォロワーすべてに雷元素3ダメージ。\nこのフォロワーを+2/+0する。",
    "elementalSkill": {"name":"夜虹の飛翔","ppCost":1,"effects":[]},
    "elementalBurst": {"name":"閃烈降臨！","energyCost":3,"effects":[]},
    "implementationStatus": "playable",
    "keywords": [
      "rush"
    ]
  }
]
