
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
  /** PP paid when activating a skill, in addition to the shared +1 energy gain. */
  ppCost?: number
}

export interface Card {
  /** 通常攻撃の属性。省略時は物理（無元素） */
  normalAttackElement?: ElementType
  /** 元素生物は自身の元素が常時付着する（風・岩も含む） */
  elementalCreature?: boolean
  /** Tokens are not shuffled into the 40-card test deck. */
  token?: boolean
  keywords?: string[]
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
  /** Total skill activations in the current turn (Diluc can use three). */
  skillUsesThisTurn?: number

  aura: ElementalAura[]
  shield: Shield

  canAttack: boolean
  hasAttacked: boolean
  /** Number of declared attacks this turn; double-attack followers may declare two. */
  attacksThisTurn?: number
  /** Number of own-turn electro-charged triggers credited to this Ororon. */
  electroChargedTriggersThisTurn?: number
  swirlDrawsThisTurn?: number
  geoShieldTriggersThisTurn?: number
  dendroBurningTriggersThisTurn?: number
  keywords: string[]
}

export interface CrestState {
  id: string
  turnsRemaining: number
  usedElements: ElementType[]
}

export interface AmuletState {
  instanceId: string
  cardId: string
  turnsRemaining: number
  recordedElement?: ElementType
}

export interface Player {
  id: string
  name: string
  leaderHealth: number
  leaderMaxHealth: number
  /** Normal / crystallize shields held by the leader (each capped at 10). */
  leaderShield?: Shield
  /** Burning turns applied to the leader by burgeon. */
  leaderBurningTurns?: number
  /** Leader elemental attachment (e.g. Barbara's healing crest). */
  leaderAura?: ElementalAura[]
  /** Healing absorption remaining from a Bond of Life. */
  bondOfLife?: number

  pp: number
  maxPp: number
  /** Shared elemental energy, 0 to 5. */
  energy: number
  crests?: CrestState[]
  amulets?: AmuletState[]

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
  /** Optional intermediate snapshots for UI playback; never part of saved game rules. */
  presentationFrames?: Array<{
    label: string
    state: Omit<GameState, 'presentationFrames'>
  }>
  turn: number
  currentPlayerId: string
  players: [Player, Player]
  phase: GamePhase
  winnerId: string | null
}
