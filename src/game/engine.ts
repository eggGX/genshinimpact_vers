
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

let nextInstanceId = 1

const DECK_SIZE = 40
const INITIAL_HAND_SIZE = 4
const MAX_HAND_SIZE = 9
const MAX_FIELD_SIZE = 5
const MAX_PP = 10

/**
 * テスト用40枚デッキを作成
 */
function createTestDeck(): string[] {
  const deck = Array.from(
    { length: DECK_SIZE },
    (_, index) => testCards[index % testCards.length].id
  )

  // Fisher-Yates シャッフル
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = deck[i]
    deck[i] = deck[j]
    deck[j] = temp
  }

  return deck
}

/**
 * プレイヤーの初期状態
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
 * ゲーム開始
 */
export function createInitialGameState(): GameState {
  const player1 = createPlayer('player1', 'プレイヤー1')
  const player2 = createPlayer('player2', 'プレイヤー2')

  player1.pp = 1
  player1.maxPp = 1

  return {
    turn: 1,
    currentPlayerId: player1.id,
    players: [player1, player2],
    phase: 'main',
    winnerId: null,
  }
}

/**
 * カード情報取得
 */
export function getCard(cardId: string): Card | undefined {
  return cardDatabase.get(cardId)
}

/**
 * カードをプレイ
 */
export function playCard(
  state: GameState,
  playerId: string,
  handIndex: number
): GameState {
  if (state.winnerId !== null) return state
  if (state.phase !== 'main') return state
  if (state.currentPlayerId !== playerId) return state

  const playerIndex = state.players.findIndex(
    player => player.id === playerId
  )
  if (playerIndex === -1) return state

  const player = state.players[playerIndex]
  const cardId = player.hand[handIndex]
  if (!cardId) return state

  const card = getCard(cardId)
  if (!card || card.type !== 'follower') return state
  if (player.pp < card.cost) return state
  if (player.field.length >= MAX_FIELD_SIZE) return state

  const follower: Follower = {
    instanceId: `follower-${nextInstanceId++}`,
    cardId: card.id,
    attack: card.attack ?? 0,
    health: card.health ?? 1,
    maxHealth: card.health ?? 1,
    // 暫定。正式な元素EN管理は後で修正する
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

  const newPlayer: Player = {
    ...player,
    pp: player.pp - card.cost,
    hand: player.hand.filter((_, i) => i !== handIndex),
    field: [...player.field, follower],
  }

  const newPlayers = [...state.players] as [Player, Player]
  newPlayers[playerIndex] = newPlayer

  return {
    ...state,
    players: newPlayers,
  }
}

/**
 * フォロワーの攻撃可否
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
 * 破壊されたフォロワーを墓場へ移動
 */
function removeDestroyedFollowers(player: Player): Player {
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
  if (state.winnerId !== null || state.phase !== 'main') {
    return state
  }

  const attackerIndex = state.players.findIndex(
    player => player.id === state.currentPlayerId
  )
  if (attackerIndex === -1) return state

  const defenderIndex = attackerIndex === 0 ? 1 : 0

  const attackerPlayer = state.players[attackerIndex]
  const defenderPlayer = state.players[defenderIndex]

  const attacker = attackerPlayer.field.find(
    follower => follower.instanceId === attackerId
  )
  const defender = defenderPlayer.field.find(
    follower => follower.instanceId === targetId
  )

  if (!attacker || !defender) return state
  if (!canFollowerAttack(attacker)) return state

  // 攻撃前の攻撃力を保存し、同時にダメージを与える
  const attackerDamage = Math.max(0, attacker.attack)
  const defenderDamage = Math.max(0, defender.attack)

  const updatedAttackerPlayer: Player = {
    ...attackerPlayer,
    field: attackerPlayer.field.map(follower =>
      follower.instanceId === attackerId
        ? {
            ...follower,
            health: follower.health - defenderDamage,
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
            health: follower.health - attackerDamage,
          }
        : follower
    ),
  }

  const nextPlayers = [...state.players] as [Player, Player]

  nextPlayers[attackerIndex] =
    removeDestroyedFollowers(updatedAttackerPlayer)

  nextPlayers[defenderIndex] =
    removeDestroyedFollowers(updatedDefenderPlayer)

  return {
    ...state,
    players: nextPlayers,
  }
}

/**
 * 相手リーダーへの通常攻撃
 */
export function attackLeader(
  state: GameState,
  attackerId: string
): GameState {
  if (state.winnerId !== null || state.phase !== 'main') {
    return state
  }

  const attackerIndex = state.players.findIndex(
    player => player.id === state.currentPlayerId
  )
  if (attackerIndex === -1) return state

  const defenderIndex = attackerIndex === 0 ? 1 : 0

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

  const nextPlayers = [...state.players] as [Player, Player]

  nextPlayers[attackerIndex] = {
    ...attackerPlayer,
    field: attackerPlayer.field.map(follower =>
      follower.instanceId === attackerId
        ? { ...follower, hasAttacked: true }
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
 * カードを1枚ドロー
 */
function drawCard(player: Player): {
  player: Player
  deckOut: boolean
} {
  // デッキ切れ敗北
  if (player.deck.length === 0) {
    return {
      player,
      deckOut: true,
    }
  }

  const [drawnCard, ...remainingDeck] = player.deck

  // 手札上限9枚
  // 超過カードは消滅させる（仮実装）
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
      hand: [...player.hand, drawnCard],
    },
    deckOut: false,
  }
}

/**
 * ターン終了・次プレイヤーのターン開始
 */
export function endTurn(state: GameState): GameState {
  if (state.winnerId !== null) return state
  if (state.phase !== 'main') return state

  const nextPlayers = state.players.map(player => ({
    ...player,
    field: player.field.map(follower => ({ ...follower })),
  })) as [Player, Player]

  const currentIndex = nextPlayers.findIndex(
    player => player.id === state.currentPlayerId
  )
  if (currentIndex === -1) return state

  const nextIndex = currentIndex === 0 ? 1 : 0
  const nextPlayer = nextPlayers[nextIndex]

  // PPを増加・回復
  nextPlayer.maxPp = Math.min(
    MAX_PP,
    nextPlayer.maxPp + 1
  )
  nextPlayer.pp = nextPlayer.maxPp

  // 攻撃状態をリセット
  nextPlayer.field = nextPlayer.field.map(follower => ({
    ...follower,
    canAttack: true,
    hasAttacked: false,
  }))

  // 次プレイヤーが1枚ドロー
  const drawResult = drawCard(nextPlayer)
  nextPlayers[nextIndex] = drawResult.player

  // デッキ切れなら直前のプレイヤーの勝利
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
