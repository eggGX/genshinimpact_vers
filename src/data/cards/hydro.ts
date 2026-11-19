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
    "description": "【自分のターン終了時】自分のフォロワーすべてを1回復する。",
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
    "description": "【元素攻撃：水】【ファンファーレ】このフォロワーに通常シールド3。",
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
    "description": "自分の場のフォロワー1枚を選ぶ。それは「【攻撃時】今攻撃している対象に水元素1ダメージを与える。」をもつ。",
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
    "description": "自分のフォロワーすべてとリーダーを2回復。自分のデッキから1枚引く。",
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
    "description": "【守護】【自分のターン終了時】自身に通常シールド2。",
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
    "description": "【突進】【攻撃時】「ヒルチャール」1体を召喚する。",
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
    "description": "【元素攻撃：水】【自分のターン終了時】自分のフォロワーすべてを1回復。【元素スキル：公演、開始♪】PP2：自分のリーダーにクレスト【歌声の環】（カウントダウン3、自分ターン終了時：自リーダー3回復して水元素付着）付与。",
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
    "description": "【ファンファーレ】自分のデッキから1枚引く。【元素スキル：古華剣・画雨籠山】PP1：自身に【2回攻撃】【突進】【元素攻撃：水】付与。",
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
    "description": "【守護】【元素スキル：聖儀・蒼鷺による庇護】PP1：自身に通常シールド3。相手の場のフォロワー1枚を選ぶ。それに水元素2ダメージ。",
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
    "description": "【ファンファーレ】「落ち着いた方がいいカモ？」1つを場に出す。【元素スキル：名称未設定】PP1：相手の場のフォロワー1枚を選ぶ。それに水元素2ダメージ。自分の場の「落ち着いた方がいいカモ？」すべてのカウントダウン+1。",
        "elementalSkill": {"name":"名称未設定","ppCost":1,"effects":[{"type":"damage","trigger":"skill","target":"selected_enemy_follower","value":2,"element":"hydro"}]},
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
    "description": "【元素攻撃：水】【元素スキル：水中幻願】PP1：「虚影」1体を召喚。【元素爆発：星命定軌】エネルギー3：敵フォロワーすべてに水元素2ダメージ。その後、相手フォロワーすべてに「次に受けるダメージ+2」を付与。",
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
    "description": "【元素攻撃：水】【自分のターン終了時】自リーダー2回復。【元素スキル：海月の誓い】PP1：「化海月」1体を召喚。【元素爆発：海人の羽衣】エネルギー3：自身+2/+0、【守護】【突進】【攻撃時：自リーダー2回復】付与。",
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
    "description": "【元素スキル：魔王武装・狂瀾】PP1：自身に【突進】【2回攻撃】【元素攻撃：水】付与。【元素爆発：極悪技・尽滅閃】エネルギー4：敵フォロワーすべてと相手リーダーに水元素3ダメージ。このターン自身が攻撃済みなら代わりに5。",
        "elementalSkill": {"name":"魔王武装・狂瀾","ppCost":1,"effects":[]},
    "elementalBurst": {"name":"極悪技・尽滅閃","energyCost":4,"effects":[]},
"implementationStatus": "playable"
  }
]
