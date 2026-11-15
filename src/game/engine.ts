
import type {
  Card,
  Follower,
  GameState,
  Player,
} from './types'
import { testCards } from '../data/testCards'

const cardDatabase = new Map<string, Card>(
  testCards.map(card => [card.id, card])
)

const DECK_SIZE = 40
const INITIAL_HAND_SIZE = 4
const MAX_HAND_SIZE = 9
const MAX_FIELD_SIZE = 5
const MAX_PP = 10

let nextInstanceId = 1

/**
 * 配列をシャッフル（元の配列は変更しない）
 */
function shuffle<T>(items: T[]): T[] {
  const result = [...items]

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }

  return result
}

/**
 * テスト用40枚デッキ
 */
function createTestDeck(): string[] {
  const cards = Array.from(
    { length: DECK_SIZE },
    (_, index) => testCards[index % testCards.length].id
  )

  return shuffle(cards)
}

/**
 * プレイヤーを作成
 */
function createPlayer(id: string, name: string): Player {
  const deck = createTestDeck()
  const hand = deck.splice(0, INITIAL_HAND_SIZE)

  return {
    id,
    name,
    leaderHealth: 20,
    leaderMaxHealth: 20,
    pp: 0,
    maxPp: 0,
    deck,
    hand,
    field: [],
    graveyard: [],
  }
}

/**
 * ゲーム初期化
 */
export function createInitialGameState(): GameState {
  const player1 = createPlayer(
    'player1',
    'プレイヤー1'
  )

  const player2 = createPlayer(
    'player2',
    'プレイヤー2'
  )

  return {
    turn: 1,
    currentPlayerId: player1.id,
    players: [player1, player2],
    phase: 'mulligan',
    winnerId: null,
  }
}

/**
 * カード情報の取得
 */
export function getCard(
  cardId: string
): Card | undefined {
  return cardDatabase.get(cardId)
}

/**
 * マリガン確定
 *
 * selectedIndices:
 * 交換する手札のインデックス
 */
export function confirmMulligan(
  state: GameState,
  selectedIndices: number[]
): GameState {
  if (state.phase !== 'mulligan') return state
  if (state.winnerId !== null) return state

  const playerIndex = state.players.findIndex(
    player => player.id === state.currentPlayerId
  )

  if (playerIndex === -1) return state

  const player = state.players[playerIndex]

  const indices = new Set(
    selectedIndices.filter(
      index =>
        Number.isInteger(index) &&
        index >= 0 &&
        index < player.hand.length
    )
  )

  // 交換するカード
  const returnedCards = player.hand.filter(
    (_, index) => indices.has(index)
  )

  // 残すカード
  const keptCards = player.hand.filter(
    (_, index) => !indices.has(index)
  )

  // 交換カードをデッキに戻してシャッフル
  const shuffledDeck = shuffle([
    ...player.deck,
    ...returnedCards,
  ])

  // 同じ枚数を引き直す
  const replacementCards = shuffledDeck.slice(
    0,
    returnedCards.length
  )

  const remainingDeck = shuffledDeck.slice(
    returnedCards.length
  )

  const updatedPlayer: Player = {
    ...player,
    hand: [
      ...keptCards,
      ...replacementCards,
    ],
    deck: remainingDeck,
  }

  const nextPlayers = [...state.players] as [
    Player,
    Player,
  ]

  nextPlayers[playerIndex] = updatedPlayer

  // プレイヤー1が確定したらプレイヤー2へ
  if (playerIndex === 0) {
    return {
      ...state,
      players: nextPlayers,
      currentPlayerId: nextPlayers[1].id,
    }
  }

  // 両者のマリガン完了
  const firstPlayer = nextPlayers[0]

  nextPlayers[0] = {
    ...firstPlayer,
    pp: 1,
    maxPp: 1,
  }

  return {
    ...state,
    players: nextPlayers,
    currentPlayerId: nextPlayers[0].id,
    turn: 1,
    phase: 'main',
  }
}

/**
 * フォロワーをプレイ
 */
export function playCard(
  state: GameState,
  playerId: string,
  handIndex: number
): GameState {
  if (state.winnerId !== null) return state
  if (state.phase !== 'main') return state
  if (state.currentPlayerId !== playerId) {
    return state
  }

  const playerIndex = state.players.findIndex(
    player => player.id === playerId
  )

  if (playerIndex === -1) return state

  const player = state.players[playerIndex]
  const cardId = player.hand[handIndex]

  if (!cardId) return state

  const card = getCard(cardId)

  if (!card || card.type !== 'follower') {
    return state
  }

  if (player.pp < card.cost) return state

  if (player.field.length >= MAX_FIELD_SIZE) {
    return state
  }

  const follower: Follower = {
    instanceId: `follower-${nextInstanceId++}`,
    cardId: card.id,
    attack: card.attack ?? 0,
    health: card.health ?? 1,
    maxHealth: card.health ?? 1,

    // 元素ENは暫定データ
    energy: 0,
    maxEnergy: 5,

    aura: [],
    shield: {
      normal: 0,
      crystallize: 0,
    },
    canAttack: false,
    hasAttacked: false,
    keywords: [],
  }

  const nextPlayer: Player = {
    ...player,
    pp: player.pp - card.cost,
    hand: player.hand.filter(
      (_, index) => index !== handIndex
    ),
    field: [...player.field, follower],
  }

  const nextPlayers = [...state.players] as [
    Player,
    Player,
  ]

  nextPlayers[playerIndex] = nextPlayer

  return {
    ...state,
    players: nextPlayers,
  }
}

/**
 * 攻撃可能か判定
 */
export function canFollowerAttack(
  follower: Follower
): boolean {
  return (
    follower.canAttack &&
    !follower.hasAttacked &&
    follower.health > 0
  )
}

/**
 * 破壊フォロワーを墓場へ移動
 */
function removeDestroyedFollowers(
  player: Player
): Player {
  const destroyed = player.field.filter(
    follower => follower.health <= 0
  )

  return {
    ...player,
    field: player.field.filter(
      follower => follower.health > 0
    ),
    graveyard: [
      ...player.graveyard,
      ...destroyed.map(follower => follower.cardId),
    ],
  }
}

/**
 * フォロワー同士の通常攻撃
 */
export function attackFollower(
  state: GameState,
  attackerId: string,
  targetId: string
): GameState {
  if (
    state.winnerId !== null ||
    state.phase !== 'main'
  ) {
    return state
  }

  const attackerIndex = state.players.findIndex(
    player => player.id === state.currentPlayerId
  )

  if (attackerIndex === -1) return state

  const defenderIndex =
    attackerIndex === 0 ? 1 : 0

  const attackerPlayer = state.players[attackerIndex]
  const defenderPlayer = state.players[defenderIndex]

  const attacker = attackerPlayer.field.find(
    follower => follower.instanceId === attackerId
  )

  const defender = defenderPlayer.field.find(
    follower => follower.instanceId === targetId
  )

  if (!attacker || !defender) return state

  if (!canFollowerAttack(attacker)) {
    return state
  }

  // 同時攻撃ダメージ
  const attackerDamage = Math.max(
    0,
    attacker.attack
  )

  const defenderDamage = Math.max(
    0,
    defender.attack
  )

  const updatedAttackerPlayer: Player = {
    ...attackerPlayer,
    field: attackerPlayer.field.map(follower =>
      follower.instanceId === attackerId
        ? {
            ...follower,
            health:
              follower.health - defenderDamage,
            hasAttacked: true,
          }
        : follower
    ),
  }

  const updatedDefenderPlayer: Player = {
    ...defenderPlayer,
    field: defenderPlayer.field.map(follower =>
      follower.instanceId === targetId
        ? {
            ...follower,
            health:
              follower.health - attackerDamage,
          }
        : follower
    ),
  }

  const nextPlayers = [...state.players] as [
    Player,
    Player,
  ]

  nextPlayers[attackerIndex] =
    removeDestroyedFollowers(
      updatedAttackerPlayer
    )

  nextPlayers[defenderIndex] =
    removeDestroyedFollowers(
      updatedDefenderPlayer
    )

  return {
    ...state,
    players: nextPlayers,
  }
}

/**
 * 相手リーダーへの攻撃
 */
export function attackLeader(
  state: GameState,
  attackerId: string
): GameState {
  if (
    state.winnerId !== null ||
    state.phase !== 'main'
  ) {
    return state
  }

  const attackerIndex = state.players.findIndex(
    player => player.id === state.currentPlayerId
  )

  if (attackerIndex === -1) return state

  const defenderIndex =
    attackerIndex === 0 ? 1 : 0

  const attackerPlayer = state.players[attackerIndex]
  const defenderPlayer = state.players[defenderIndex]

  const attacker = attackerPlayer.field.find(
    follower => follower.instanceId === attackerId
  )

  if (!attacker || !canFollowerAttack(attacker)) {
    return state
  }

  const damage = Math.max(0, attacker.attack)

  const remainingHealth = Math.max(
    0,
    defenderPlayer.leaderHealth - damage
  )

  const nextPlayers = [...state.players] as [
    Player,
    Player,
  ]

  nextPlayers[attackerIndex] = {
    ...attackerPlayer,
    field: attackerPlayer.field.map(follower =>
      follower.instanceId === attackerId
        ? {
            ...follower,
            hasAttacked: true,
          }
        : follower
    ),
  }

  nextPlayers[defenderIndex] = {
    ...defenderPlayer,
    leaderHealth: remainingHealth,
  }

  return {
    ...state,
    players: nextPlayers,
    winnerId:
      remainingHealth <= 0
        ? attackerPlayer.id
        : null,
  }
}

/**
 * 1枚ドロー
 */
function drawCard(player: Player): {
  player: Player
  deckOut: boolean
} {
  if (player.deck.length === 0) {
    return {
      player,
      deckOut: true,
    }
  }

  const [drawnCard, ...remainingDeck] =
    player.deck

  // 手札上限9枚
  if (player.hand.length >= MAX_HAND_SIZE) {
    return {
      player: {
        ...player,
        deck: remainingDeck,
      },
      deckOut: false,
    }
  }

  return {
    player: {
      ...player,
      deck: remainingDeck,
      hand: [
        ...player.hand,
        drawnCard,
      ],
    },
    deckOut: false,
  }
}

/**
 * ターン終了と次ターン開始
 */
export function endTurn(
  state: GameState
): GameState {
  if (state.winnerId !== null) return state
  if (state.phase !== 'main') return state

  const nextPlayers = state.players.map(player => ({
    ...player,
    field: player.field.map(
      follower => ({ ...follower })
    ),
  })) as [Player, Player]

  const currentIndex = nextPlayers.findIndex(
    player => player.id === state.currentPlayerId
  )

  if (currentIndex === -1) return state

  const nextIndex =
    currentIndex === 0 ? 1 : 0

  const nextPlayer = nextPlayers[nextIndex]

  // PP回復
  nextPlayer.maxPp = Math.min(
    MAX_PP,
    nextPlayer.maxPp + 1
  )

  nextPlayer.pp = nextPlayer.maxPp

  // 攻撃状態をリセット
  nextPlayer.field = nextPlayer.field.map(
    follower => ({
      ...follower,
      canAttack: true,
      hasAttacked: false,
    })
  )

  // ターン開始時ドロー
  const drawResult = drawCard(nextPlayer)

  nextPlayers[nextIndex] = drawResult.player

  // デッキ切れ敗北
  const winnerId = drawResult.deckOut
    ? nextPlayers[currentIndex].id
    : null

  return {
    ...state,
    turn: state.turn + 1,
    currentPlayerId: nextPlayer.id,
    players: nextPlayers,
    phase: 'main',
    winnerId,
  }
}
