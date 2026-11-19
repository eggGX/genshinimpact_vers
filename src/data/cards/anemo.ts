import type { Card } from '../../game/types'

/** Ver.1.0確定済み風元素15枚（C071–C085）。
 * STEP37で風元素全15枚を対戦対応。
 */
export const anemoCards: Card[] = [
  {
    "id": "C071",
    "name": "風スライム",
    "type": "follower",
    "rarity": "bronze",
    "element": "anemo",
    "cost": 1,
    "attack": 2,
    "health": 2,
    "traits": [
      "スライム"
    ],
    "description": "【元素生物：風】",
    "implementationStatus": "playable",
    "elementalCreature": true
  },
  {
    "id": "C072",
    "name": "モンド城",
    "type": "amulet",
    "rarity": "bronze",
    "element": "anemo",
    "cost": 2,
    "region": [
      "モンド"
    ],
    "description": "【カウントダウン_3】\n自分のターン終了時、自分のデッキから「地域：モンド」のカードを1枚引く。",
    "implementationStatus": "playable"
  },
  {
    "id": "C073",
    "name": "クク仔竜",
    "type": "follower",
    "rarity": "bronze",
    "element": "anemo",
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
    "keywords": ["rush"]
  },
  {
    "id": "C074",
    "name": "風フライム",
    "type": "follower",
    "rarity": "bronze",
    "element": "anemo",
    "cost": 3,
    "attack": 2,
    "health": 3,
    "traits": [
      "フライム"
    ],
    "description": "【元素生物：風】\n【ラストワード】相手のリーダーに風元素2ダメージ。",
    "implementationStatus": "playable",
    "elementalCreature": true
  },
  {
    "id": "C075",
    "name": "魔術・アストニシングシフト",
    "type": "spell",
    "rarity": "silver",
    "element": "anemo",
    "cost": 4,
    "region": [
      "フォンテーヌ"
    ],
    "description": "「ビックラキャット・ボックス」1体を自分の場に出す。",
    "implementationStatus": "playable"
  },
  {
    "id": "C076",
    "name": "禁・風霊作成・七五同構弐型",
    "type": "amulet",
    "rarity": "silver",
    "element": "anemo",
    "cost": 4,
    "region": [
      "モンド"
    ],
    "description": "【カウントダウン_3】\n自分のターン終了時、相手の場のフォロワーすべてに風元素1ダメージ。\nこのアミュレットが初めて起こした拡散の元素（炎・水・氷・雷）を記録する。以後、自分のターン終了時、相手の場のフォロワーすべてに記録した元素1ダメージ。",
    "implementationStatus": "playable"
  },
  {
    "id": "C077",
    "name": "ヒルチャールレンジャー・風",
    "type": "follower",
    "rarity": "silver",
    "element": "anemo",
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
    "id": "C078",
    "name": "ファデュイ・烈風の従者",
    "type": "follower",
    "rarity": "silver",
    "element": "anemo",
    "cost": 6,
    "attack": 5,
    "health": 5,
    "traits": [
      "ファデュイ"
    ],
    "description": "【元素攻撃：風】\n【ファンファーレ】相手のリーダーは【命の契約3】をもつ。\n自分と相手のターン終了時、相手のリーダーに命の契約が残っているなら、相手のリーダーに1ダメージ。",
    "normalAttackElement": "anemo",
    "implementationStatus": "playable"
  },
  {
    "id": "C079",
    "name": "生物錬金術師・スクロース",
    "type": "follower",
    "rarity": "gold",
    "element": "anemo",
    "cost": 3,
    "attack": 2,
    "health": 3,
    "region": [
      "モンド"
    ],
    "traits": [
      "西風騎士団"
    ],
    "description": "【元素攻撃：風】\n自分のターン中、自分が拡散を起こすたび、自分のデッキから1枚引く（1ターンで最大1回まで）。\n【元素スキル：風霊作成・六三〇八】\nコスト：PP1\n相手の場のフォロワーすべてに風元素1ダメージ。",
    "elementalSkill": {"name":"風霊作成・六三〇八","ppCost":1,"effects":[]},
    "implementationStatus": "playable",
    "normalAttackElement": "anemo"
  },
  {
    "id": "C080",
    "name": "終末番の忍者・早柚",
    "type": "follower",
    "rarity": "gold",
    "element": "anemo",
    "cost": 3,
    "attack": 2,
    "health": 4,
    "region": [
      "稲妻"
    ],
    "description": "【潜伏】\n【元素スキル：嗚呼流・風隠急進】\nコスト：PP1\n相手の場のフォロワー1枚を選ぶ。それに風元素2ダメージ。\nこのフォロワーを+1/+0する。",
    "implementationStatus": "playable",
    "keywords": [
      "stealth"
    ],
    "elementalSkill": {
      "name": "嗚呼流・風隠急進",
      "ppCost": 1,
      "effects": [
        {
          "type": "damage",
          "trigger": "skill",
          "target": "selected_enemy_follower",
          "value": 2,
          "element": "anemo"
        }
      ]
    }
  },
  {
    "id": "C081",
    "name": "百年の先輩・ファルザン",
    "type": "follower",
    "rarity": "gold",
    "element": "anemo",
    "cost": 4,
    "attack": 2,
    "health": 4,
    "region": [
      "スメール"
    ],
    "traits": [
      "教令院"
    ],
    "description": "【ファンファーレ】自分の場の他の風元素フォロワー1枚を選ぶ。それを+1/+0する。\n【元素スキル：非想風天】\nコスト：PP1\n相手の場のフォロワー1枚を選ぶ。それに風元素2ダメージ。\n自分の場の風元素フォロワーすべてを+1/+0する。",
    "elementalSkill": {"name":"非想風天","ppCost":1,"effects":[{"type":"damage","trigger":"skill","target":"selected_enemy_follower","value":2,"element":"anemo"}]},
    "implementationStatus": "playable"
  },
  {
    "id": "C082",
    "name": "綺影のエレガンス・リネット",
    "type": "follower",
    "rarity": "gold",
    "element": "anemo",
    "cost": 3,
    "attack": 2,
    "health": 3,
    "region": [
      "フォンテーヌ"
    ],
    "traits": [
      "ファデュイ"
    ],
    "description": "【突進】\n【ファンファーレ】自分のデッキから風元素のスペルカードを1枚引く。\n【元素スキル：エニグマティック・フェイント】\nコスト：PP1\n相手の場のフォロワー1枚を選ぶ。それに風元素2ダメージ。\nこのフォロワーを1回復。",
    "implementationStatus": "playable",
    "keywords": ["rush"],
    "elementalSkill": {
      "name": "エニグマティック・フェイント",
      "ppCost": 1,
      "effects": [
        {
          "type": "damage",
          "trigger": "skill",
          "target": "selected_enemy_follower",
          "value": 2,
          "element": "anemo"
        }
      ]
    }
  },
  {
    "id": "C083",
    "name": "北風騎士・ファルカ",
    "type": "follower",
    "rarity": "legendary",
    "element": "anemo",
    "cost": 8,
    "attack": 4,
    "health": 7,
    "region": [
      "モンド"
    ],
    "traits": [
      "西風騎士団"
    ],
    "description": "【疾走】【2回攻撃】\n【ファンファーレ】自分のデッキから「タイプ：西風騎士団」のフォロワーカードを1枚引く。\n【攻撃時】自分の場の西風騎士団フォロワーすべてを+1/+1する。\n【攻撃後】このフォロワーが【元素攻撃：炎】【元素攻撃：水】【元素攻撃：氷】【元素攻撃：雷】のいずれかをもつなら、このターン終了時まで【元素攻撃：風】に変更する。\n【元素スキル：堕ちる烈風】\nコスト：手札の炎/水/氷/雷カード1枚を捨てる。\nこのフォロワーは捨てたカードと同じ元素の【元素攻撃】をもつ。\n【元素爆発：我こそ朔風】\nコスト：元素エネルギー_3\n相手の場のフォロワーすべてに風元素2ダメージ。",
    "keywords": ["storm","double_attack"],
    "elementalSkill": {"name":"堕ちる烈風","ppCost":0,"effects":[]},
    "elementalBurst": {"name":"我こそ朔風","energyCost":3,"effects":[]},
    "implementationStatus": "playable"
  },
  {
    "id": "C084",
    "name": "護法夜叉・魈",
    "type": "follower",
    "rarity": "legendary",
    "element": "anemo",
    "cost": 5,
    "attack": 4,
    "health": 5,
    "region": [
      "璃月"
    ],
    "traits": [
      "仙人"
    ],
    "description": "【突進】\n【元素スキル：風輪両立】\nコスト：PP1\n相手の場のフォロワー1枚を選ぶ。それに風元素2ダメージ。このスキルは1ターンで最大2回まで使用可能。\n【元素爆発：靖妖儺舞】\nコスト：元素エネルギー_4\nこのフォロワーを+2/+2する。\nこのフォロワーは【疾走】【落下攻撃】【元素攻撃：風】をもつ。\nこのフォロワーは「自分のターン終了時、このフォロワーに1ダメージ。自分のリーダーに1ダメージ。」をもつ。",
    "keywords": ["rush"],
    "elementalSkill": {"name":"風輪両立","ppCost":1,"effects":[{"type":"damage","trigger":"skill","target":"selected_enemy_follower","value":2,"element":"anemo"}]},
    "elementalBurst": {"name":"靖妖儺舞","energyCost":4,"effects":[]},
    "implementationStatus": "playable"
  },
  {
    "id": "C085",
    "name": "久世浮傾・放浪者",
    "type": "follower",
    "rarity": "legendary",
    "element": "anemo",
    "cost": 5,
    "attack": 3,
    "health": 5,
    "region": [
      "スメール"
    ],
    "traits": [
      "教令院"
    ],
    "description": "【元素攻撃：風】【オーラ】\n【元素スキル：羽画・風姿華歌】\nコスト：PP1\nこのフォロワーを+2/+0する。\nこのターン、このフォロワーは【疾走】をもつ。\n【元素爆発：狂言・式楽伍番】\nコスト：元素エネルギー_3\nランダムな相手フォロワーまたは相手のリーダー1体に風元素2ダメージ。これを5回行う。",
    "keywords": ["aura"],
    "normalAttackElement": "anemo",
    "elementalSkill": {"name":"羽画・風姿華歌","ppCost":1,"effects":[]},
    "elementalBurst": {"name":"狂言・式楽伍番","energyCost":3,"effects":[]},
    "implementationStatus": "playable"
  }
]
