
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

export type CardType = 'follower' | 'spell' | 'amulet'

export type EffectTrigger =
  | 'on_play'
  | 'on_destroy'
  | 'turn_start'
  | 'turn_end'

export type EffectTarget =
  | 'own_leader'
  | 'enemy_leader'
  | 'selected_enemy_follower'
  | 'self_follower'

export type CardEffect =
  | {
      type: 'heal'
      trigger: EffectTrigger
      target: EffectTarget
      value: number
    }
  | {
      type: 'damage'
      trigger: EffectTrigger
      target: 'own_leader' | 'enemy_leader' | 'selected_enemy_follower' | 'self_follower'
      value: number
      element?: ElementType
    }
  | {
      type: 'grant_shield'
      trigger: EffectTrigger
      target: 'self_follower' | 'selected_enemy_follower'
      shieldType: 'normal' | 'crystallize'
      value: number
    }
  | {
      type: 'modify_stats'
      trigger: EffectTrigger
      target: 'self_follower' | 'selected_enemy_follower'
      attackChange: number
      healthChange: number
    }

export interface Card {
  /** 通常攻撃の属性。省略時は物理（無元素） */
  normalAttackElement?: ElementType
  /** 元素生物は自身の元素が常時付着する（風・岩も含む） */
  elementalCreature?: boolean
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

  // 暫定。元素エネルギーは正式仕様に合わせて変更予定
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
