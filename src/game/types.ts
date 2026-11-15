
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

export type EffectTrigger =
  | 'on_play'
  | 'on_destroy'
  | 'turn_start'
  | 'turn_end'

export type EffectTarget =
  | 'own_leader'
  | 'enemy_leader'
  | 'selected_enemy_follower'

export type CardEffect = {
  type: 'damage' | 'heal'
  trigger: EffectTrigger
  target: EffectTarget
  value: number
}

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
  effects?: CardEffect[]
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

  // 暫定データ。正式な元素ENは後で再設計
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
