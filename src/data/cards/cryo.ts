import type { Card } from '../../game/types'

/** Ver.1.0確定済み氷元素15枚（C041–C055）。
 * 15枚全カードの能力を対戦処理へ接続済み。
 */
export const cryoCards: Card[] = [
  {
    "id": "C041",
    "name": "氷スライム",
    "type": "follower",
    "rarity": "bronze",
    "element": "cryo",
    "cost": 1,
    "attack": 2,
    "health": 2,
    "traits": [
      "スライム"
    ],
    "description": "【元素生物：氷】",
    "implementationStatus": "playable",
    "elementalCreature": true
  },
  {
    "id": "C042",
    "name": "ヒルチャール射手・氷",
    "type": "follower",
    "rarity": "bronze",
    "element": "cryo",
    "cost": 2,
    "attack": 2,
    "health": 2,
    "traits": [
      "ヒルチャール"
    ],
    "description": "【ファンファーレ】相手の場のフォロワー1枚を選ぶ。それに氷元素1ダメージ。",
    "implementationStatus": "playable",
    "effects": [
      {
        "type": "damage",
        "trigger": "on_play",
        "target": "selected_enemy_follower",
        "value": 1,
        "element": "cryo"
      }
    ]
  },
  {
    "id": "C043",
    "name": "イクトミ仔竜",
    "type": "follower",
    "rarity": "bronze",
    "element": "cryo",
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
    "id": "C044",
    "name": "霜の精",
    "type": "follower",
    "rarity": "bronze",
    "element": "cryo",
    "cost": 3,
    "attack": 2,
    "health": 2,
    "region": [
      "スネージナヤ"
    ],
    "traits": [
      "妖精"
    ],
    "description": "【ファンファーレ】自分の場の他のフォロワー1枚を選ぶ。それは+2/+0する。",
    "implementationStatus": "playable"
  },
  {
    "id": "C045",
    "name": "凛冽なる輪舞",
    "type": "spell",
    "rarity": "silver",
    "element": "cryo",
    "cost": 3,
    "region": [
      "モンド"
    ],
    "description": "クレスト【凛冽なる輪舞】（カウントダウン3）：自分のターン終了時、ランダムな敵フォロワー1体に氷元素2ダメージ。これを2回行う。",
    "implementationStatus": "playable"
  },
  {
    "id": "C046",
    "name": "星流揺籠の夢",
    "type": "spell",
    "rarity": "silver",
    "element": "cryo",
    "cost": 4,
    "region": [
      "スメール"
    ],
    "description": "自分のリーダーと自分のフォロワーすべてに通常シールド2。敵フォロワーすべてに氷元素1ダメージ。",
    "implementationStatus": "playable"
  },
  {
    "id": "C047",
    "name": "ファデュイ・氷蛍術師",
    "type": "follower",
    "rarity": "silver",
    "element": "cryo",
    "cost": 4,
    "attack": 2,
    "health": 4,
    "traits": [
      "ファデュイ"
    ],
    "description": "【ファンファーレ】「氷蛍」2体召喚。【自分のターン終了時】自分の場に氷蛍がいれば自身に通常シールド2。",
    "implementationStatus": "playable"
  },
  {
    "id": "C048",
    "name": "ヒルチャール・霜鎧の王",
    "type": "follower",
    "rarity": "silver",
    "element": "cryo",
    "cost": 7,
    "attack": 5,
    "health": 7,
    "traits": [
      "ヒルチャール"
    ],
    "description": "【守護】【自分のターン終了時】自身に通常シールド3。",
    "implementationStatus": "playable",
    "keywords": [
      "guard"
    ]
  },
  {
    "id": "C049",
    "name": "キャッツテールの看板娘・ディオナ",
    "type": "follower",
    "rarity": "gold",
    "element": "cryo",
    "cost": 3,
    "attack": 2,
    "health": 4,
    "region": [
      "モンド"
    ],
    "description": "【ファンファーレ】自リーダーに通常シールド2。【元素スキル：フリーズキャッツクロー】PP2：相手の場のフォロワー2枚を選ぶ。それらに氷元素2ダメージ。自リーダーに通常シールド2。",
    "elementalSkill": {"name":"フリーズキャッツクロー","ppCost":2,"effects":[]},
    "implementationStatus": "playable"
  },
  {
    "id": "C050",
    "name": "西風騎兵隊長・ガイア",
    "type": "follower",
    "rarity": "gold",
    "element": "cryo",
    "cost": 3,
    "attack": 3,
    "health": 3,
    "region": [
      "モンド"
    ],
    "traits": [
      "西風騎士団"
    ],
    "description": "【突進】【元素スキル：霜の襲撃】PP0：相手の場のフォロワー1枚を選ぶ。それに氷元素2ダメージ。",
    "implementationStatus": "playable",
    "keywords": [
      "rush"
    ],
    "elementalSkill": {
      "name": "霜の襲撃",
      "ppCost": 0,
      "effects": [
        {
          "type": "damage",
          "trigger": "skill",
          "target": "selected_enemy_follower",
          "value": 2,
          "element": "cryo"
        }
      ]
    }
  },
  {
    "id": "C051",
    "name": "夢遊する星詠み・レイラ",
    "type": "follower",
    "rarity": "gold",
    "element": "cryo",
    "cost": 3,
    "attack": 1,
    "health": 5,
    "region": [
      "スメール"
    ],
    "traits": [
      "教令院"
    ],
    "description": "【守護】【自分のターン終了時】ランダムな敵フォロワー1体に氷元素1ダメージ。【元素スキル：垂裳凛然の夜】PP1：自リーダーに通常シールド3。",
    "keywords": ["guard"],
    "elementalSkill": {"name":"垂裳凛然の夜","ppCost":1,"effects":[]},
    "implementationStatus": "playable"
  },
  {
    "id": "C052",
    "name": "スチームバードの記者・シャルロット",
    "type": "follower",
    "rarity": "gold",
    "element": "cryo",
    "cost": 4,
    "attack": 2,
    "health": 4,
    "region": [
      "フォンテーヌ"
    ],
    "description": "【元素攻撃：氷】【ファンファーレ】カード1枚引く。【元素スキル：フレーミング・氷点法】PP1：相手の場のフォロワー1枚を選ぶ。それに氷元素2ダメージ。それは-1/+0する。",
    "elementalSkill": {"name":"フレーミング・氷点法","ppCost":1,"effects":[{"type":"damage","trigger":"skill","target":"selected_enemy_follower","value":2,"element":"cryo"}]},
    "implementationStatus": "playable",
    "normalAttackElement": "cryo"
  },
  {
    "id": "C053",
    "name": "月海亭の秘書・甘雨",
    "type": "follower",
    "rarity": "legendary",
    "element": "cryo",
    "cost": 5,
    "attack": 3,
    "health": 5,
    "region": [
      "璃月"
    ],
    "traits": [
      "仙人"
    ],
    "description": "【攻撃時】相手リーダーに氷元素1ダメージ。【元素スキル：山沢麟跡】PP1：「氷蓮」1体召喚。【元素爆発：降衆天華】エネルギー3：敵フォロワーすべてに氷元素2ダメージ。クレスト【降衆天華】（カウントダウン3：自ターン終了時、ランダムな敵フォロワー1体に氷元素2ダメージ。これを2回行う。）付与。",
    "elementalSkill": {"name":"山沢麟跡","ppCost":1,"effects":[]},
    "elementalBurst": {"name":"降衆天華","energyCost":3,"effects":[]},
    "implementationStatus": "playable"
  },
  {
    "id": "C054",
    "name": "黒曜石の老婆・シトラリ",
    "type": "follower",
    "rarity": "legendary",
    "element": "cryo",
    "cost": 5,
    "attack": 2,
    "health": 5,
    "region": [
      "ナタ"
    ],
    "traits": [
      "謎煙の主"
    ],
    "description": "【潜伏】【元素攻撃：氷】【自分のターン終了時】自リーダーに通常シールド2。【元素スキル：霜昼の黒星】PP1：「イツパパ」1体召喚。【元素爆発：諸曜の令】エネルギー3：敵フォロワーすべてに氷元素3ダメージ。自リーダーに通常シールド3。",
    "elementalSkill": {"name":"霜昼の黒星","ppCost":1,"effects":[]},
    "elementalBurst": {"name":"諸曜の令","energyCost":3,"effects":[]},
    "implementationStatus": "playable",
    "normalAttackElement": "cryo",
    "keywords": [
      "stealth"
    ]
  },
  {
    "id": "C055",
    "name": "神里家令嬢・神里綾華",
    "type": "follower",
    "rarity": "legendary",
    "element": "cryo",
    "cost": 5,
    "attack": 4,
    "health": 5,
    "region": [
      "稲妻"
    ],
    "traits": [
      "社奉行"
    ],
    "description": "【突進】【元素スキル：神里流・氷華】PP1：敵フォロワーすべてに氷元素1ダメージ。自身に【元素攻撃：氷】付与。【元素爆発：神里流・霜滅】エネルギー3：ランダムな敵フォロワー1体に氷元素2ダメージ。これを5回行う。",
    "keywords": ["rush"],
    "elementalSkill": {"name":"神里流・氷華","ppCost":1,"effects":[]},
    "elementalBurst": {"name":"神里流・霜滅","energyCost":3,"effects":[]},
    "implementationStatus": "playable"
  }
]
