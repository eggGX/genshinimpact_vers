import type { Card } from '../../game/types'

/** Ver.1.0 の確定済み水元素15枚（C026–C040）。
 * 未対応の能力は説明文を保持し、対戦には登録しない。
 * C030 の攻撃時ダメージ対象は原本で要確認のため実装を保留。
 */
export const hydroCards: Card[] = [
  {
    "id": "C026",
    "name": "水スライム",
    "type": "follower",
    "rarity": "bronze",
    "element": "hydro",
    "cost": 1,
    "attack": 2,
    "health": 2,
    "traits": [
      "スライム"
    ],
    "description": "【元素生物：水】",
    "implementationStatus": "playable",
    "elementalCreature": true
  },
  {
    "id": "C027",
    "name": "ヒルチャールシャーマン・水",
    "type": "follower",
    "rarity": "bronze",
    "element": "hydro",
    "cost": 3,
    "attack": 1,
    "health": 4,
    "traits": [
      "ヒルチャール"
    ],
    "description": "自分のターン終了時、自分の場のフォロワーすべてを1回復。",
    "implementationStatus": "playable"
  },
  {
    "id": "C028",
    "name": "コホラ仔竜",
    "type": "follower",
    "rarity": "bronze",
    "element": "hydro",
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
    "id": "C029",
    "name": "アビスの魔術師・水",
    "type": "follower",
    "rarity": "bronze",
    "element": "hydro",
    "cost": 3,
    "attack": 2,
    "health": 2,
    "traits": [
      "アビス"
    ],
    "description": "【元素攻撃：水】\n【ファンファーレ】このフォロワーは通常シールド3をもつ。",
    "implementationStatus": "playable",
    "normalAttackElement": "hydro",
    "effects": [
      {
        "type": "grant_shield",
        "trigger": "on_play",
        "target": "self_follower",
        "shieldType": "normal",
        "value": 3
      }
    ]
  },
  {
    "id": "C030",
    "name": "古華剣・裁雨留虹",
    "type": "spell",
    "rarity": "silver",
    "element": "hydro",
    "cost": 2,
    "region": [
      "璃月"
    ],
    "description": "自分の場のフォロワー1枚を選ぶ。それは「【攻撃時】対象に水元素1ダメージ。」をもつ。",
    "implementationStatus": "playable"
  },
  {
    "id": "C031",
    "name": "シャイニングミラクル♪",
    "type": "spell",
    "rarity": "silver",
    "element": "hydro",
    "cost": 3,
    "region": [
      "モンド"
    ],
    "description": "自分の場のフォロワーすべてを2回復。\n自分のリーダーを2回復。\n自分のデッキから1枚引く。",
    "implementationStatus": "playable"
  },
  {
    "id": "C032",
    "name": "堅盾重甲ヤドカニ",
    "type": "follower",
    "rarity": "silver",
    "element": "hydro",
    "cost": 4,
    "attack": 2,
    "health": 5,
    "region": [
      "フォンテーヌ"
    ],
    "traits": [
      "原海アベラント"
    ],
    "description": "【守護】\n自分のターン終了時、このフォロワーは通常シールド2をもつ。",
    "implementationStatus": "playable",
    "keywords": [
      "guard"
    ]
  },
  {
    "id": "C033",
    "name": "ヒルチャールレンジャー・水",
    "type": "follower",
    "rarity": "silver",
    "element": "hydro",
    "cost": 5,
    "attack": 4,
    "health": 4,
    "traits": [
      "ヒルチャール"
    ],
    "description": "【突進】\n【攻撃時】「ヒルチャール」1体を自分の場に出す。",
    "implementationStatus": "playable",
    "keywords": [
      "rush"
    ]
  },
  {
    "id": "C034",
    "name": "みんなのアイドル・バーバラ",
    "type": "follower",
    "rarity": "gold",
    "element": "hydro",
    "cost": 4,
    "attack": 2,
    "health": 5,
    "region": [
      "モンド"
    ],
    "traits": [
      "西風教会"
    ],
    "description": "【元素攻撃：水】\n自分のターン終了時、自分の場のフォロワーすべてを1回復。\n【元素スキル：公演、開始♪】\nコスト：PP2\n自分は『クレスト：公演、開始♪』をもつ。\n【クレスト】\n【カウントダウン_3】\n自分のターン終了時、自分のリーダーを3回復し、水元素を付着させる。",
        "elementalSkill": {"name":"公演、開始♪","ppCost":2,"effects":[]},
"implementationStatus": "playable",
    "normalAttackElement": "hydro"
  },
  {
    "id": "C035",
    "name": "少壮気鋭・行秋",
    "type": "follower",
    "rarity": "gold",
    "element": "hydro",
    "cost": 3,
    "attack": 2,
    "health": 3,
    "region": [
      "璃月"
    ],
    "traits": [
      "古華派"
    ],
    "description": "【ファンファーレ】自分のデッキから1枚引く。\n【元素スキル：古華剣・画雨籠山】\nコスト：PP1\nこのフォロワーは【2回攻撃】【突進】【元素攻撃：水】をもつ。",
        "elementalSkill": {"name":"古華剣・画雨籠山","ppCost":1,"effects":[]},
"implementationStatus": "playable"
  },
  {
    "id": "C036",
    "name": "アアル村の守護者・キャンディス",
    "type": "follower",
    "rarity": "gold",
    "element": "hydro",
    "cost": 4,
    "attack": 3,
    "health": 5,
    "region": [
      "スメール"
    ],
    "description": "【守護】\n【元素スキル：聖儀・蒼鷺による庇護】\nコスト：PP1\nこのフォロワーは通常シールド3をもつ。\n相手の場のフォロワー1枚を選ぶ。それに水元素2ダメージ。",
    "implementationStatus": "playable",
    "elementalSkill": {
      "name": "聖儀・蒼鷺による庇護", "ppCost": 1,
      "effects": [
        { "type": "grant_shield", "trigger": "skill", "target": "self_follower", "shieldType": "normal", "value": 3 },
        { "type": "damage", "trigger": "skill", "target": "selected_enemy_follower", "value": 2, "element": "hydro" }
      ]
    },
    "keywords": [
      "guard"
    ]
  },
  {
    "id": "C037",
    "name": "発明家・アイノ",
    "type": "follower",
    "rarity": "gold",
    "element": "hydro",
    "cost": 3,
    "attack": 2,
    "health": 4,
    "region": [
      "ナド・クライ"
    ],
    "description": "【ファンファーレ】「落ち着いた方がいいカモ？」1つを自分の場に出す。\n【元素スキル：アイデアキャッチャー】\nコスト：PP1\n相手の場のフォロワー1枚を選ぶ。それに水元素2ダメージ。\n自分の場の「落ち着いた方がいいカモ？」すべてのカウントダウン+1。",
        "elementalSkill": {"name":"アイデアキャッチャー","ppCost":1,"effects":[{"type":"damage","trigger":"skill","target":"selected_enemy_follower","value":2,"element":"hydro"}]},
"implementationStatus": "playable"
  },
  {
    "id": "C038",
    "name": "占星術師・モナ",
    "type": "follower",
    "rarity": "legendary",
    "element": "hydro",
    "cost": 4,
    "attack": 2,
    "health": 4,
    "region": [
      "モンド"
    ],
    "description": "【元素攻撃：水】\n【元素スキル：水中幻願】\nコスト：PP1\n「虚影」1体を自分の場に出す。\n【元素爆発：星命定軌】\nコスト：元素エネルギー_3\n相手の場のフォロワーすべてに水元素2ダメージ。\nその後、相手の場のフォロワーすべては「次に受けるダメージ+2」をもつ。",
        "elementalSkill": {"name":"水中幻願","ppCost":1,"effects":[]},
    "elementalBurst": {"name":"星命定軌","energyCost":3,"effects":[]},
"implementationStatus": "playable",
    "normalAttackElement": "hydro"
  },
  {
    "id": "C039",
    "name": "現人神の巫女・珊瑚宮心海",
    "type": "follower",
    "rarity": "legendary",
    "element": "hydro",
    "cost": 5,
    "attack": 2,
    "health": 6,
    "region": [
      "稲妻"
    ],
    "description": "【元素攻撃：水】\n自分のターン終了時、自分のリーダーを2回復。\n【元素スキル：海月の誓い】\nコスト：PP1\n「化海月」1体を自分の場に出す。\n【元素爆発：海人の羽衣】\nコスト：元素エネルギー_3\nこのフォロワーを+2/+0する。\nこのフォロワーは【守護】【突進】をもつ。\nこのフォロワーは「【攻撃時】自分のリーダーを2回復。」をもつ。",
        "elementalSkill": {"name":"海月の誓い","ppCost":1,"effects":[]},
    "elementalBurst": {"name":"海人の羽衣","energyCost":3,"effects":[]},
"implementationStatus": "playable",
    "normalAttackElement": "hydro"
  },
  {
    "id": "C040",
    "name": "執行官第十一位・タルタリヤ",
    "type": "follower",
    "rarity": "legendary",
    "element": "hydro",
    "cost": 5,
    "attack": 4,
    "health": 5,
    "region": [
      "スネージナヤ"
    ],
    "traits": [
      "ファデュイ"
    ],
    "description": "【元素スキル：魔王武装・狂瀾】\nコスト：PP1\nこのフォロワーは【突進】【2回攻撃】【元素攻撃：水】をもつ。\n【元素爆発：極悪技・尽滅閃】\nコスト：元素エネルギー_4\n相手の場のフォロワーすべてと相手のリーダーに水元素3ダメージ。このターンにこのフォロワーが攻撃していたなら、代わりに水元素5ダメージ。",
        "elementalSkill": {"name":"魔王武装・狂瀾","ppCost":1,"effects":[]},
    "elementalBurst": {"name":"極悪技・尽滅閃","energyCost":4,"effects":[]},
"implementationStatus": "playable"
  }
]
