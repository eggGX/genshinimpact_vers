
/**
 * 原神カードゲーム
 * 基本データ型定義
 */

// 元素
export type ElementType =
  | 'none'
  | 'pyro'
  | 'hydro'
  | 'cryo'
  | 'electro'
  | 'anemo'
  | 'geo'
  | 'dendro'

// カードのレアリティ
export type Rarity =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'legendary'

// カードの種類
export type CardType =
  | 'follower'
  | 'spell'
  | 'amulet'

// カードの基本情報
export interface Card {
  id: string
  name: string
  type: CardType
  rarity: Rarity
  element: ElementType

  cost: number
  attack?: number
  health?: number

  region?: string[]
  traits?: string[]

  description?: string
  image?: string
}

// 元素付着
export interface ElementalAura {
  element: ElementType
  duration?: number
}

// シールド
export interface Shield {
  normal: number
  crystallize: number
}

// フィールド上のフォロワー
export interface Follower {
  instanceId: string
  cardId: string

  attack: number
  health: number
  maxHealth: number

  energy: number
  maxEnergy: number

  aura: ElementalAura[]

  shield: Shield

  canAttack: boolean
  hasAttacked: boolean

  keywords: string[]
}

// プレイヤー
export interface Player {
  id: string
  name: string

  leaderHealth: number
  leaderMaxHealth: number

  pp: number
  maxPp: number

  deck: string[]
  hand: string[]
  field: Follower[]
  graveyard: string[]
}

// ゲーム状態
export interface GameState {
  turn: number
  currentPlayerId: string

  players: [Player, Player]

  phase:
    | 'start'
    | 'main'
    | 'end'

  winnerId: string | null
}
