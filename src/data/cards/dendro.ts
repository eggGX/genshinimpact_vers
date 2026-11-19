import type { Card } from '../../game/types'

/** 正式原本 genshin_cards_v1.json: C101–C115。未対応能力は data_only。 */
export const dendroCards: Card[] = [
  {
    "id": "C101",
    "name": "草スライム",
    "type": "follower",
    "rarity": "bronze",
    "element": "dendro",
    "cost": 1,
    "attack": 2,
    "health": 2,
    "traits": [
      "スライム"
    ],
    "description": "【元素生物：草】",
    "implementationStatus": "playable",
    "elementalCreature": true
  },
  {
    "id": "C102",
    "name": "スメールの知恵",
    "type": "spell",
    "rarity": "bronze",
    "element": "dendro",
    "cost": 2,
    "region": [
      "スメール"
    ],
    "description": "自分のデッキから草元素のカードを1枚引く。さらに自分のデッキから1枚引く。",
    "implementationStatus": "playable"
  },
  {
    "id": "C103",
    "name": "ユムカ仔竜",
    "type": "follower",
    "rarity": "bronze",
    "element": "dendro",
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
    "id": "C104",
    "name": "草フライム",
    "type": "follower",
    "rarity": "bronze",
    "element": "dendro",
    "cost": 3,
    "attack": 2,
    "health": 3,
    "traits": [
      "フライム"
    ],
    "description": "【元素生物：草】【ラストワード】相手リーダーに草元素2ダメージ。",
    "implementationStatus": "playable",
    "elementalCreature": true
  },
  {
    "id": "C105",
    "name": "玉顆珊々月中落",
    "type": "spell",
    "rarity": "silver",
    "element": "dendro",
    "cost": 4,
    "region": [
      "璃月"
    ],
    "description": "「月桂・跳躍型」2体召喚。自分のフォロワーすべてとリーダーを2回復。",
    "implementationStatus": "playable"
  },
  {
    "id": "C106",
    "name": "ニャンコトレジャー",
    "type": "spell",
    "rarity": "silver",
    "element": "dendro",
    "cost": 3,
    "region": [
      "スメール"
    ],
    "description": "敵フォロワーすべてに草元素1ダメージ。アミュレット「コレアンバー」を場に出す（カウントダウン2、自ターン終了時：敵フォロワーすべてに草元素1ダメージ）。",
    "implementationStatus": "playable"
  },
  {
    "id": "C107",
    "name": "ヴァナラーナ",
    "type": "amulet",
    "rarity": "silver",
    "element": "dendro",
    "cost": 2,
    "region": [
      "スメール"
    ],
    "description": "【カウントダウン3】【自分のターン終了時】自リーダー1回復。自分のデッキから1枚引く。",
    "implementationStatus": "playable"
  },
  {
    "id": "C108",
    "name": "エルマイト旅団・フローラルリングダンサー",
    "type": "follower",
    "rarity": "silver",
    "element": "dendro",
    "cost": 5,
    "attack": 3,
    "health": 4,
    "region": [
      "スメール"
    ],
    "traits": [
      "エルマイト旅団"
    ],
    "description": "【ファンファーレ】「草の霊蛇」1体召喚。【攻撃時】自分の場に草の霊蛇がいれば自身+2/+0。",
    "implementationStatus": "playable"
  },
  {
    "id": "C109",
    "name": "仙人の愛弟子・ヨォーヨ",
    "type": "follower",
    "rarity": "gold",
    "element": "dendro",
    "cost": 3,
    "attack": 2,
    "health": 4,
    "region": [
      "璃月"
    ],
    "description": "【自分のターン終了時】自リーダー1回復。【元素スキル：雲閣団々降清白】PP1：「月桂・投擲型」1体召喚。",
    "implementationStatus": "playable",
    "elementalSkill": {
      "name": "雲閣団々降清白",
      "ppCost": 1,
      "effects": []
    }
  },
  {
    "id": "C110",
    "name": "狛荷屋の配達員・綺良々",
    "type": "follower",
    "rarity": "gold",
    "element": "dendro",
    "cost": 3,
    "attack": 2,
    "health": 4,
    "region": [
      "稲妻"
    ],
    "description": "【守護】【ファンファーレ】自リーダーに通常シールド2。【元素スキル：にゃんにゃん町飛脚】PP1：自身に通常シールド3。ランダムな敵フォロワー1体に草元素1ダメージ。",
    "implementationStatus": "playable",
    "keywords": [
      "guard"
    ],
    "elementalSkill": {
      "name": "にゃんにゃん町飛脚",
      "ppCost": 1,
      "effects": []
    }
  },
  {
    "id": "C111",
    "name": "見習いレンジャー・コレイ",
    "type": "follower",
    "rarity": "gold",
    "element": "dendro",
    "cost": 3,
    "attack": 2,
    "health": 3,
    "region": [
      "スメール"
    ],
    "traits": [
      "レンジャー"
    ],
    "description": "【ファンファーレ】自分のデッキから草元素のスペルカードを1枚引く。【元素スキル：花触葉讃】PP1：相手の場のフォロワー1枚を選ぶ。それに草元素2ダメージ。相手の場の別のフォロワー1枚を選ぶ。それに草元素1ダメージ。",
    "implementationStatus": "playable",
    "elementalSkill": {
      "name": "花触葉讃",
      "ppCost": 1,
      "effects": []
    }
  },
  {
    "id": "C112",
    "name": "妙論派の光・カーヴェ",
    "type": "follower",
    "rarity": "gold",
    "element": "dendro",
    "cost": 4,
    "attack": 3,
    "health": 5,
    "region": [
      "スメール"
    ],
    "traits": [
      "教令院"
    ],
    "description": "【ファンファーレ】相手の場に草原核があるなら、その草原核+0/+1。【元素スキル：精緻なる絵図】PP1：相手の場のフォロワー1枚を選ぶ。それに草元素2ダメージ。相手の場に草原核があるなら、相手リーダーに草原核の体力と同じダメージ（最大3）。",
    "implementationStatus": "playable",
    "elementalSkill": {
      "name": "精緻なる絵図",
      "ppCost": 1,
      "effects": []
    }
  },
  {
    "id": "C113",
    "name": "アビディアの巡林官・ティナリ",
    "type": "follower",
    "rarity": "legendary",
    "element": "dendro",
    "cost": 5,
    "attack": 3,
    "health": 5,
    "region": [
      "スメール"
    ],
    "traits": [
      "レンジャー"
    ],
    "description": "【攻撃時】ランダムな敵フォロワー1体に草元素1ダメージ。【元素スキル：識果榴弾】PP1：相手の場のフォロワー1枚を選ぶ。それに草元素2ダメージ。それは-1/+0する。【元素爆発：造生・蔓纏いの矢】エネルギー3：ランダムな敵フォロワーまたは相手リーダー1体に草元素2ダメージ。これを4回行う。",
    "implementationStatus": "playable",
    "elementalSkill": {
      "name": "識果榴弾",
      "ppCost": 1,
      "effects": []
    },
    "elementalBurst": {
      "name": "造生・蔓纏いの矢",
      "energyCost": 3,
      "effects": []
    }
  },
  {
    "id": "C114",
    "name": "香水デザイナー・エミリエ",
    "type": "follower",
    "rarity": "legendary",
    "element": "dendro",
    "cost": 5,
    "attack": 3,
    "health": 5,
    "region": [
      "フォンテーヌ"
    ],
    "description": "【元素スキル：撰香】PP1：「ルミドゥースの瓶」1つを場に出す。【元素爆発：香の軌跡】エネルギー3：敵フォロワーすべてに草元素2ダメージ。相手の場に燃焼状態フォロワーがいるなら追加で草元素2ダメージ。",
    "implementationStatus": "playable",
    "elementalSkill": {
      "name": "撰香",
      "ppCost": 1,
      "effects": []
    },
    "elementalBurst": {
      "name": "香の軌跡",
      "energyCost": 3,
      "effects": []
    }
  },
  {
    "id": "C115",
    "name": "懸木の民の竜狩り人・キィニチ",
    "type": "follower",
    "rarity": "legendary",
    "element": "dendro",
    "cost": 5,
    "attack": 4,
    "health": 5,
    "region": [
      "ナタ"
    ],
    "traits": [
      "懸木の民"
    ],
    "description": "【突進】【自分のターン中】自分が燃焼反応を起こすたび自身+1/+0（最大2回/ターン）。【元素スキル：懸狩り・遊猟】PP1：相手の場のフォロワー1枚を選ぶ。それに草元素3ダメージ。【元素爆発：偉大なる聖龍を崇拝せよ】エネルギー3：敵フォロワーすべてに草元素2ダメージ、相手リーダーに草元素3ダメージ。",
    "implementationStatus": "playable",
    "keywords": [
      "rush"
    ],
    "elementalSkill": {
      "name": "懸狩り・遊猟",
      "ppCost": 1,
      "effects": []
    },
    "elementalBurst": {
      "name": "偉大なる聖龍を崇拝せよ",
      "energyCost": 3,
      "effects": []
    }
  }
]
