
/**
 * 原神カードゲーム
 * 基本データ型定義
 */

export type ElementType =
  | 'none'
  | 'pyro'
  | 'hydro'
  | 'cryo'
  | 'electro'
  | 'anemo'
  | 'geo'
  | 'dendro'

export type Rarity =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'legendary'

export type CardType =
  | 'follower'
  | 'spell'
  | 'amulet'

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

export interface ElementalAura {
  element: ElementType
  duration?: number
}

export interface Shield {
  normal: number
  crystallize: number
}

export interface Follower {
  instanceId: string
  cardId: string

  attack: number
  health: number
  maxHealth: number

  // 暫定定義：正式な元素ENは後で再設計
  energy: number
  maxEnergy: number

  aura: ElementalAura[]
  shield: Shield

  canAttack: boolean
  hasAttacked: boolean
  keywords: string[]
}

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

export type GamePhase =
  | 'mulligan'
  | 'start'
  | 'main'
  | 'end'

export interface GameState {
  turn: number
  currentPlayerId: string
  players: [Player, Player]
  phase: GamePhase
  winnerId: string | null
}
