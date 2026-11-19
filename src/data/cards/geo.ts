import type { Card } from '../../game/types'

/** Ver.1.0確定済み岩元素15枚（C086–C100）。
 * 特殊能力未対応のカードは data_only としてデッキから除外する。
 */
export const geoCards: Card[] = [
  {
    "id": "C086",
    "name": "岩スライム",
    "type": "follower",
    "rarity": "bronze",
    "element": "geo",
    "cost": 1,
    "attack": 2,
    "health": 2,
    "traits": [
      "スライム"
    ],
    "description": "【元素生物：岩】",
    "implementationStatus": "playable",
    "elementalCreature": true
  },
  {
    "id": "C087",
    "name": "璃月港",
    "type": "amulet",
    "rarity": "bronze",
    "element": "geo",
    "cost": 2,
    "region": [
      "璃月"
    ],
    "description": "【カウントダウン_3】\n自分のターン終了時、自分のデッキから「地域：璃月」のカードを1枚引く。",
    "implementationStatus": "playable"
  },
  {
    "id": "C088",
    "name": "テペトル仔竜",
    "type": "follower",
    "rarity": "bronze",
    "element": "geo",
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
    "id": "C089",
    "name": "ベビーヴィシャップ",
    "type": "follower",
    "rarity": "bronze",
    "element": "geo",
    "cost": 4,
    "attack": 3,
    "health": 4,
    "region": [
      "璃月"
    ],
    "traits": [
      "ヴィシャップ"
    ],
    "description": "【突進】\n【攻撃時】自分のリーダーに結晶シールド1。",
    "implementationStatus": "playable",
    "keywords": [
      "rush"
    ]
  },
  {
    "id": "C090",
    "name": "天権崩玉",
    "type": "spell",
    "rarity": "silver",
    "element": "geo",
    "cost": 4,
    "region": [
      "璃月"
    ],
    "description": "ランダムな相手フォロワーまたは相手のリーダー1体に岩元素1ダメージ。これをX回行う。Xは自分の場に岩創造物があれば8、なければ4である。",
    "implementationStatus": "playable"
  },
  {
    "id": "C091",
    "name": "大掃除",
    "type": "spell",
    "rarity": "silver",
    "element": "geo",
    "cost": 3,
    "region": [
      "モンド"
    ],
    "description": "自分の場のフォロワー1枚を選ぶ。\nそれは+2/+0する。\nそれは「【元素攻撃：岩】」「\n【攻撃時】相手の場のフォロワーすべてに岩元素1ダメージ。」をもつ。",
    "implementationStatus": "playable"
  },
  {
    "id": "C092",
    "name": "獣域ハウンド・岩",
    "type": "follower",
    "rarity": "silver",
    "element": "geo",
    "cost": 4,
    "attack": 3,
    "health": 3,
    "traits": [
      "アビス"
    ],
    "description": "【元素攻撃：岩】\n【攻撃時】相手のリーダーに非元素1ダメージ。",
    "implementationStatus": "playable",
    "normalAttackElement": "geo"
  },
  {
    "id": "C093",
    "name": "ヴィシャップ・岩",
    "type": "follower",
    "rarity": "silver",
    "element": "geo",
    "cost": 7,
    "attack": 6,
    "health": 7,
    "region": [
      "璃月"
    ],
    "traits": [
      "ヴィシャップ"
    ],
    "description": "【守護】\n【交戦時】自分のリーダーに結晶シールド2。",
    "implementationStatus": "playable",
    "keywords": [
      "guard"
    ]
  },
  {
    "id": "C094",
    "name": "騎士を夢見るメイド・ノエル",
    "type": "follower",
    "rarity": "gold",
    "element": "geo",
    "cost": 4,
    "attack": 2,
    "health": 5,
    "region": [
      "モンド"
    ],
    "traits": [
      "西風騎士団"
    ],
    "description": "【守護】\n【攻撃時】自分のリーダー2回復。\n\n【元素スキル：護心鎧】PP1：自身と自分のリーダーに通常シールド3。",
    "implementationStatus": "playable",
    "keywords": [
      "guard"
    ],
    "elementalSkill": {
      "name": "護心鎧",
      "ppCost": 1,
      "effects": []
    }
  },
  {
    "id": "C095",
    "name": "月を覆う天権・凝光",
    "type": "follower",
    "rarity": "gold",
    "element": "geo",
    "cost": 4,
    "attack": 3,
    "health": 4,
    "region": [
      "璃月"
    ],
    "traits": [
      "璃月七星"
    ],
    "description": "【元素攻撃：岩】\n【ファンファーレ】自分のリーダー結晶シールド2。\n\n【元素スキル：璇璣屏】PP1：「璇璣屏」1つを場に出す。",
    "implementationStatus": "playable",
    "normalAttackElement": "geo",
    "elementalSkill": {"name":"璇璣屏","ppCost":1,"effects":[]}
  },
  {
    "id": "C096",
    "name": "海祇軍の大将・ゴロー",
    "type": "follower",
    "rarity": "gold",
    "element": "geo",
    "cost": 3,
    "attack": 2,
    "health": 4,
    "region": [
      "稲妻"
    ],
    "description": "【ファンファーレ】自分の場の岩元素フォロワーすべてを+0/+1する。\n\n【元素スキル：犬坂の陣構え】PP1：自分の場の岩元素フォロワーすべてを+1/+1する。",
    "implementationStatus": "playable",
    "elementalSkill": {
      "name": "犬坂の陣構え",
      "ppCost": 1,
      "effects": []
    }
  },
  {
    "id": "C097",
    "name": "不屈の勇士・カチーナ",
    "type": "follower",
    "rarity": "gold",
    "element": "geo",
    "cost": 3,
    "attack": 2,
    "health": 4,
    "region": [
      "ナタ"
    ],
    "traits": [
      "こだまの子"
    ],
    "description": "【ファンファーレ】自分のリーダー結晶シールド2。\n\n【元素スキル：いけ、ぐるぐるコマちゃん！】PP1：「ぐるぐるコマちゃん」1つを場に出す。",
    "implementationStatus": "playable",
    "elementalSkill": {"name":"いけ、ぐるぐるコマちゃん！","ppCost":1,"effects":[]}
  },
  {
    "id": "C098",
    "name": "千織屋の店主・千織",
    "type": "follower",
    "rarity": "legendary",
    "element": "geo",
    "cost": 5,
    "attack": 3,
    "health": 5,
    "region": [
      "フォンテーヌ",
      "稲妻"
    ],
    "description": "【ファンファーレ】自分の場に岩創造物があるなら「たもと」1体召喚。\n\n【元素スキル：羽袖一触】PP1：「たもと」1体召喚。\n\n【元素爆発：二刀の型・比翼】エネルギー3：相手の場のフォロワーすべてに岩元素3ダメージ。\nランダムな相手フォロワーまたは相手のリーダー1体に岩元素2ダメージ。これをX回行う。Xは自分の場の「たもと」の数である。",
    "implementationStatus": "playable",
    "elementalSkill": {"name":"羽袖一触","ppCost":1,"effects":[]},
    "elementalBurst": {"name":"二刀の型・比翼","energyCost":3,"effects":[]}
  },
  {
    "id": "C099",
    "name": "棘薔薇の会会長・ナヴィア",
    "type": "follower",
    "rarity": "legendary",
    "element": "geo",
    "cost": 5,
    "attack": 4,
    "health": 5,
    "region": [
      "フォンテーヌ"
    ],
    "traits": [
      "棘薔薇の会"
    ],
    "description": "自分のターン中、自分のリーダーが結晶シールドを獲得するたび自身+1/+0（最大3回/ターン）。\n\n【元素スキル：セレモニアル・クリスタルショット】自分のリーダーの結晶シールドを自動消費（最大3、PP消費なし）。\n相手の場のフォロワー1枚を選ぶ。\nそれに岩元素Xダメージ。\nX=1+消費数×2。\n\n【元素爆発：晴天を衝く霰弾の名射手】エネルギー3：相手の場のフォロワーすべてに岩元素1ダメージ。\n自分のリーダー結晶シールド1。\nクレスト【晴天を衝く霰弾の名射手】（【カウントダウン_2】\n、自ターン終了時：相手の場のフォロワーすべてに岩元素1ダメージ＆自分のリーダー結晶シールド1）付与。",
    "implementationStatus": "playable",
    "elementalSkill": {"name":"セレモニアル・クリスタルショット","ppCost":0,"effects":[]},
    "elementalBurst": {"name":"晴天を衝く霰弾の名射手","energyCost":3,"effects":[]}
  },
  {
    "id": "C100",
    "name": "白亜の申し子・アルベド",
    "type": "follower",
    "rarity": "legendary",
    "element": "geo",
    "cost": 5,
    "attack": 3,
    "health": 5,
    "region": [
      "モンド"
    ],
    "traits": [
      "西風騎士団"
    ],
    "description": "自分のターン終了時、自分のリーダー結晶シールド1。\n\n【元素スキル：創生術・擬似陽華】PP1：「陽華」1つを場に出す。\n\n【元素爆発：誕生式・大地の潮】エネルギー3：相手の場のフォロワーすべてに岩元素2ダメージ。\n自分の場に岩創造物があれば追加で岩元素2ダメージ。",
    "implementationStatus": "playable",
    "elementalSkill": {"name":"創生術・擬似陽華","ppCost":1,"effects":[]},
    "elementalBurst": {"name":"誕生式・大地の潮","energyCost":3,"effects":[]}
  }
]
