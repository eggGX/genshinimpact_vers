import type { Card } from '../../game/types'

/** 初期セットVer.1.0／炎元素15枚（C011–C025）。原本: genshin_cards_v1.csv
 * C011–C025まで炎元素15枚すべて対戦対応済み。
 */
export const pyroCards: Card[] = [
  {
    "id": "C011",
    "name": "炎スライム",
    "type": "follower",
    "rarity": "bronze",
    "element": "pyro",
    "cost": 1,
    "attack": 2,
    "health": 2,
    "traits": [
      "スライム"
    ],
    "description": "【元素生物：炎】",
    "implementationStatus": "playable",
    "elementalCreature": true
  },
  {
    "id": "C012",
    "name": "ヒルチャール射手・炎",
    "type": "follower",
    "rarity": "bronze",
    "element": "pyro",
    "cost": 2,
    "attack": 2,
    "health": 2,
    "traits": [
      "ヒルチャール"
    ],
    "description": "【ファンファーレ】相手の場のフォロワー1枚を選ぶ。それに炎元素1ダメージ。",
    "implementationStatus": "playable",
    "effects": [
      {
        "type": "damage",
        "trigger": "on_play",
        "target": "selected_enemy_follower",
        "value": 1,
        "element": "pyro"
      }
    ]
  },
  {
    "id": "C013",
    "name": "ドドコ",
    "type": "follower",
    "rarity": "bronze",
    "element": "pyro",
    "cost": 2,
    "attack": 1,
    "health": 2,
    "region": [
      "モンド"
    ],
    "description": "【ラストワード】ランダムな敵フォロワー1体に炎元素2ダメージ。",
    "implementationStatus": "playable"
  },
  {
    "id": "C014",
    "name": "アビスの魔術師・炎",
    "type": "follower",
    "rarity": "bronze",
    "element": "pyro",
    "cost": 3,
    "attack": 2,
    "health": 2,
    "traits": [
      "アビス"
    ],
    "description": "【元素攻撃：炎】【ファンファーレ】このフォロワーに通常シールド3を付与。",
    "implementationStatus": "playable",
    "normalAttackElement": "pyro",
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
    "id": "C015",
    "name": "旋火輪",
    "type": "spell",
    "rarity": "silver",
    "element": "pyro",
    "cost": 4,
    "region": [
      "璃月"
    ],
    "description": "敵フォロワーすべてに炎元素1ダメージ。クレスト【旋火輪】（カウントダウン2）を得る：自分のターン終了時、敵フォロワーすべてと相手リーダーに炎元素1ダメージ。",
    "implementationStatus": "playable"
  },
  {
    "id": "C016",
    "name": "素晴らしい旅",
    "type": "amulet",
    "rarity": "silver",
    "element": "pyro",
    "cost": 3,
    "region": [
      "モンド"
    ],
    "description": "アミュレット。【カウントダウン3】【自分のターン終了時】自分のリーダーを2回復。自分のフォロワーすべてを+1/+0する。",
    "implementationStatus": "playable"
  },
  {
    "id": "C017",
    "keywords": ["stealth"],
    "normalAttackElement": "pyro",
    "name": "ファデュイ・デットエージェント・炎",
    "type": "follower",
    "rarity": "silver",
    "element": "pyro",
    "cost": 4,
    "attack": 3,
    "health": 2,
    "traits": [
      "ファデュイ"
    ],
    "description": "【潜伏】【元素攻撃：炎】【攻撃時】自分の場に他のファデュイがいれば、攻撃後に再度【潜伏】を得る。",
    "implementationStatus": "playable"
  },
  {
    "id": "C018",
    "name": "双界の炎",
    "type": "spell",
    "rarity": "silver",
    "element": "pyro",
    "cost": 4,
    "region": [
      "フォンテーヌ"
    ],
    "description": "相手の場のフォロワー1枚を選ぶ。それを破壊する。相手リーダーと自分のリーダーにそれぞれ炎元素2ダメージ。",
    "implementationStatus": "playable"
  },
  {
    "id": "C019",
    "name": "偵察騎士・アンバー",
    "type": "follower",
    "rarity": "gold",
    "element": "pyro",
    "cost": 3,
    "attack": 2,
    "health": 3,
    "region": [
      "モンド"
    ],
    "traits": [
      "西風騎士団"
    ],
    "description": "【ファンファーレ】相手の場のフォロワー1枚を選ぶ。それに炎元素2ダメージ。【元素スキル：爆弾人形】PP1：「ウサギ伯爵」1体を召喚。",
    "effects": [{ "type": "damage", "trigger": "on_play", "target": "selected_enemy_follower", "value": 2, "element": "pyro" }],
    "elementalSkill": { "name": "爆弾人形", "ppCost": 1, "effects": [] },
    "implementationStatus": "playable"
  },
  {
    "id": "C020",
    "name": "万民百味・香菱",
    "type": "follower",
    "rarity": "gold",
    "element": "pyro",
    "cost": 3,
    "attack": 2,
    "health": 3,
    "region": [
      "璃月"
    ],
    "description": "【自分のターン終了時】自分の場に「グゥオパァー」があるなら自身を+1/+1する。【元素スキル：グゥオパァー出撃】PP2：「グゥオパァー」1体を召喚。",
    "elementalSkill": { "name": "グゥオパァー出撃", "ppCost": 2, "effects": [] },
    "implementationStatus": "playable"
  },
  {
    "id": "C021",
    "name": "ペニー冒険団・ベネット",
    "type": "follower",
    "rarity": "gold",
    "element": "pyro",
    "cost": 3,
    "attack": 2,
    "health": 4,
    "region": [
      "モンド"
    ],
    "traits": [
      "冒険者協会"
    ],
    "description": "【ファンファーレ】自分の場の他のフォロワー1枚を選ぶ。それは+1/+0する。【元素スキル：溢れる情熱】PP1：相手の場のフォロワー1枚を選ぶ。それに炎元素4ダメージ。このフォロワー自身に非元素1ダメージ。",
    "elementalSkill": { "name": "溢れる情熱", "ppCost": 1, "effects": [
      { "type": "damage", "trigger": "skill", "target": "selected_enemy_follower", "value": 4, "element": "pyro" },
      { "type": "damage", "trigger": "skill", "target": "self_follower", "value": 1 }
    ] },
    "implementationStatus": "playable"
  },
  {
    "id": "C022",
    "name": "特巡隊隊長・シュヴルーズ",
    "type": "follower",
    "rarity": "gold",
    "element": "pyro",
    "cost": 4,
    "attack": 3,
    "health": 4,
    "region": [
      "フォンテーヌ"
    ],
    "traits": [
      "特巡隊"
    ],
    "description": "【自分のターン中】自分が過負荷を起こすたび、自分のフォロワーすべてを+1/+0する（発動回数制限なし）。【元素スキル：近迫阻止射撃・速】PP1：相手の場のフォロワー1枚を選ぶ。それに炎元素2ダメージ。自分のリーダーを2回復。",
    "elementalSkill": { "name": "近迫阻止射撃・速", "ppCost": 1, "effects": [
      { "type": "damage", "trigger": "skill", "target": "selected_enemy_follower", "value": 2, "element": "pyro" },
      { "type": "heal", "trigger": "skill", "target": "own_leader", "value": 2 }
    ] },
    "implementationStatus": "playable"
  },
  {
    "id": "C023",
    "name": "闇夜の英雄・ディルック",
    "type": "follower",
    "rarity": "legendary",
    "element": "pyro",
    "cost": 5,
    "attack": 4,
    "health": 5,
    "region": [
      "モンド"
    ],
    "description": "【元素スキル：逆焔の刃】PP1：相手の場のフォロワー1枚を選ぶ。それに炎元素Xダメージ。X=このターンに使用した「逆焔の刃」の回数+2（今回を含む）。1ターン最大3回。【元素爆発：黎明】エネルギー3：敵フォロワーすべてと相手リーダーに炎元素3ダメージ。",
        "elementalSkill": { "name": "逆焔の刃", "ppCost": 1, "effects": [
      { "type": "damage", "trigger": "skill", "target": "selected_enemy_follower", "value": 3, "element": "pyro" }
    ] },
    "elementalBurst": { "name": "黎明", "energyCost": 3, "effects": [] },
"implementationStatus": "playable"
  },
  {
    "id": "C024",
    "name": "幻惑のトリック・リネ",
    "type": "follower",
    "rarity": "legendary",
    "element": "pyro",
    "cost": 4,
    "attack": 2,
    "health": 3,
    "region": [
      "フォンテーヌ"
    ],
    "traits": [
      "ファデュイ"
    ],
    "description": "【疾走】【攻撃時】自分の場に炎元素カード3枚以上なら自身を+1/+0。【元素スキル：ビウィルダー・ライト】PP1：相手の場のフォロワー1枚を選ぶ。それに炎元素2ダメージ。【元素爆発：大魔術・ミラクルパレード】エネルギー2：このフォロワーは「ファニーハット・キャット」に変身する。",
        "keywords": ["storm"],
    "elementalSkill": { "name": "ビウィルダー・ライト", "ppCost": 1, "effects": [
      { "type": "damage", "trigger": "skill", "target": "selected_enemy_follower", "value": 2, "element": "pyro" }
    ] },
    "elementalBurst": { "name": "大魔術・ミラクルパレード", "energyCost": 2, "effects": [] },
"implementationStatus": "playable"
  },
  {
    "id": "C025",
    "name": "往生堂堂主・胡桃",
    "type": "follower",
    "rarity": "legendary",
    "element": "pyro",
    "cost": 4,
    "attack": 3,
    "health": 4,
    "region": [
      "璃月"
    ],
    "traits": [
      "往生堂"
    ],
    "description": "【疾走】自分のリーダーHPが10以下なら自身攻撃力+2（条件付き）。【元素スキル：蝶導来世】PP1：自分のリーダーに3ダメージ、自身+2/+0、【元素攻撃：炎】付与。【元素爆発：安神秘法】エネルギー3：相手リーダーに炎元素4ダメージ、自分のリーダーを3回復。",
        "keywords": ["storm"],
    "elementalSkill": { "name": "蝶導来世", "ppCost": 1, "effects": [
      { "type": "damage", "trigger": "skill", "target": "own_leader", "value": 3 },
      { "type": "modify_stats", "trigger": "skill", "target": "self_follower", "attackChange": 2, "healthChange": 0 }
    ] },
    "elementalBurst": { "name": "安神秘法", "energyCost": 3, "effects": [
      { "type": "damage", "trigger": "burst", "target": "enemy_leader", "value": 4, "element": "pyro" },
      { "type": "heal", "trigger": "burst", "target": "own_leader", "value": 3 }
    ] },
"implementationStatus": "playable"
  },
]
