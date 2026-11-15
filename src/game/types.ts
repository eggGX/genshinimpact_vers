
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
  | 'skill'
  | 'burst'

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

export interface CharacterAbility {
  name: string
  effects: CardEffect[]
  /** Only bursts consume shared energy; skills gain one energy. */
  energyCost?: number
}

export interface Card {
  /** 通常攻撃の属性。省略時は物理（無元素） */
  normalAttackElement?: ElementType
  /** 元素生物は自身の元素が常時付着する（風・岩も含む） */
  elementalCreature?: boolean
  /** Tokens are not shuffled into the 40-card test deck. */
  token?: boolean
  /** data_only cards are visible in the catalogue but not yet executable. */
  implementationStatus?: 'data_only' | 'playable'
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
  elementalSkill?: CharacterAbility
  elementalBurst?: CharacterAbility
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

  skillUsed: boolean
  burstUsed: boolean

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
  /** Burning turns applied to the leader by burgeon. */
  leaderBurningTurns?: number

  pp: number
  maxPp: number
  /** Shared elemental energy, 0 to 5. */
  energy: number

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
