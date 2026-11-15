
import type {
  Card,
  Follower,
  GameState,
  Player,
} from './types'
import { testCards } from '../data/testCards'
import { resolveEffects } from './effects'

const cardDatabase = new Map<string, Card>(
  testCards.map(card => [card.id, card])
)

const DECK_SIZE = 40
const INITIAL_HAND_SIZE = 4
const MAX_HAND_SIZE = 9
const MAX_FIELD_SIZE = 5
const MAX_PP = 10

let nextInstanceId = 1

function shuffle<T>(items: T[]): T[] {
  const result = [...items]

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

function createTestDeck(): string[] {
  return shuffle(
    Array.from(
      { length: DECK_SIZE },
      (_, i) => testCards[i % testCards.length].id
    )
  )
}

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

export function createInitialGameState(): GameState {
  const p1 = createPlayer('player1', 'プレイヤー1')
  const p2 = createPlayer('player2', 'プレイヤー2')

  return {
    turn: 1,
    currentPlayerId: p1.id,
    players: [p1, p2],
    phase: 'mulligan',
    winnerId: null,
  }
}

export function getCard(cardId: string): Card | undefined {
  return cardDatabase.get(cardId)
}

export function confirmMulligan(
  state: GameState,
  selectedIndices: number[]
): GameState {
  if (state.phase !== 'mulligan') return state
  if (state.winnerId !== null) return state

  const index = state.players.findIndex(
    p => p.id === state.currentPlayerId
  )
  if (index < 0) return state

  const player = state.players[index]
  const chosen = new Set(
    selectedIndices.filter(
      i =>
        Number.isInteger(i) &&
        i >= 0 &&
        i < player.hand.length
    )
  )

  const returned = player.hand.filter(
    (_, i) => chosen.has(i)
  )
  const kept = player.hand.filter(
    (_, i) => !chosen.has(i)
  )
  const deck = shuffle([...player.deck, ...returned])

  const updated: Player = {
    ...player,
    hand: [...kept, ...deck.slice(0, returned.length)],
    deck: deck.slice(returned.length),
  }

  const players = [...state.players] as [Player, Player]
  players[index] = updated

  if (index === 0) {
    return {
      ...state,
      players,
      currentPlayerId: players[1].id,
    }
  }

  players[0] = {
    ...players[0],
    pp: 1,
    maxPp: 1,
  }

  return {
    ...state,
    players,
    currentPlayerId: players[0].id,
    turn: 1,
    phase: 'main',
  }
}

/**
 * 選択対象が必要なファンファーレか
 */
export function needsPlayTarget(
  card: Card
): boolean {
  return (card.effects ?? []).some(
    effect =>
      effect.trigger === 'on_play' &&
      effect.target === 'selected_enemy_follower'
  )
}

/**
 * プレイ可能か
 */
export function canPlayCard(
  state: GameState,
  handIndex: number
): boolean {
  if (state.phase !== 'main') return false
  if (state.winnerId !== null) return false

  const owner = state.players.find(
    p => p.id === state.currentPlayerId
  )
  const enemy = state.players.find(
    p => p.id !== state.currentPlayerId
  )

  if (!owner || !enemy) return false

  const cardId = owner.hand[handIndex]
  const card = cardId ? getCard(cardId) : undefined

  if (!card || card.type !== 'follower') return false
  if (owner.pp < card.cost) return false
  if (owner.field.length >= MAX_FIELD_SIZE) return false

  if (
    needsPlayTarget(card) &&
    enemy.field.length === 0
  ) {
    return false
  }

  return true
}

/**
 * 破壊処理。
 * 同時に破壊されたフォロワーを先にすべて除去し、
 * ターンプレイヤー優先・フィールド配置順で効果を解決。
 */
function resolveDeaths(state: GameState): GameState {
  let result = state

  // 連鎖破壊への安全上限
  for (let pass = 0; pass < 100; pass++) {
    const activeIndex = result.players.findIndex(
      p => p.id === result.currentPlayerId
    )
    if (activeIndex < 0) return result

    const order = [activeIndex, 1 - activeIndex]

    const destroyed = order.flatMap(index =>
      result.players[index].field
        .filter(f => f.health <= 0)
        .map(f => ({
          ownerId: result.players[index].id,
          follower: f,
        }))
    )

    if (destroyed.length === 0) break

    const players = result.players.map(player => {
      const dead = player.field.filter(f => f.health <= 0)

      return {
        ...player,
        field: player.field.filter(f => f.health > 0),
        graveyard: [
          ...player.graveyard,
          ...dead.map(f => f.cardId),
        ],
      }
    }) as [Player, Player]

    result = {
      ...result,
      players,
    }

    for (const { ownerId, follower } of destroyed) {
      if (result.winnerId !== null) break

      const card = getCard(follower.cardId)

      result = resolveEffects(
        result,
        ownerId,
        card?.effects ?? [],
        'on_destroy'
      )
    }

    if (result.winnerId !== null) break
  }

  return result
}

/**
 * カードをプレイし、ファンファーレを実行
 */
export function playCard(
  state: GameState,
  playerId: string,
  handIndex: number,
  targetId?: string
): GameState {
  if (state.currentPlayerId !== playerId) return state
  if (!canPlayCard(state, handIndex)) return state

  const index = state.players.findIndex(
    p => p.id === playerId
  )
  if (index < 0) return state

  const player = state.players[index]
  const cardId = player.hand[handIndex]
  const card = getCard(cardId)!

  if (needsPlayTarget(card)) {
    const enemy = state.players[1 - index]

    if (
      !targetId ||
      !enemy.field.some(f => f.instanceId === targetId)
    ) {
      return state
    }
  }

  const follower: Follower = {
    instanceId: `follower-${nextInstanceId++}`,
    cardId: card.id,
    attack: card.attack ?? 0,
    health: card.health ?? 1,
    maxHealth: card.health ?? 1,
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

  const players = [...state.players] as [Player, Player]

  players[index] = {
    ...player,
    pp: player.pp - card.cost,
    hand: player.hand.filter((_, i) => i !== handIndex),
    field: [...player.field, follower],
  }

  let result: GameState = {
    ...state,
    players,
  }

  result = resolveEffects(
    result,
    playerId,
    card.effects ?? [],
    'on_play',
    targetId
  )

  return resolveDeaths(result)
}

export function canFollowerAttack(
  follower: Follower
): boolean {
  return (
    follower.health > 0 &&
    follower.canAttack &&
    !follower.hasAttacked
  )
}

/**
 * フォロワー同士の通常攻撃
 */
export function attackFollower(
  state: GameState,
  attackerId: string,
  targetId: string
): GameState {
  if (state.phase !== 'main') return state
  if (state.winnerId !== null) return state

  const index = state.players.findIndex(
    p => p.id === state.currentPlayerId
  )
  if (index < 0) return state

  const enemyIndex = 1 - index
  const owner = state.players[index]
  const enemy = state.players[enemyIndex]

  const attacker = owner.field.find(
    f => f.instanceId === attackerId
  )
  const defender = enemy.field.find(
    f => f.instanceId === targetId
  )

  if (!attacker || !defender) return state
  if (!canFollowerAttack(attacker)) return state

  const attackDamage = Math.max(0, attacker.attack)
  const counterDamage = Math.max(0, defender.attack)

  const players = [...state.players] as [Player, Player]

  players[index] = {
    ...owner,
    field: owner.field.map(f =>
      f.instanceId === attackerId
        ? {
            ...f,
            health: f.health - counterDamage,
            hasAttacked: true,
          }
        : f
    ),
  }

  players[enemyIndex] = {
    ...enemy,
    field: enemy.field.map(f =>
      f.instanceId === targetId
        ? {
            ...f,
            health: f.health - attackDamage,
          }
        : f
    ),
  }

  return resolveDeaths({
    ...state,
    players,
  })
}

/**
 * 相手リーダーへの通常攻撃
 */
export function attackLeader(
  state: GameState,
  attackerId: string
): GameState {
  if (state.phase !== 'main') return state
  if (state.winnerId !== null) return state

  const index = state.players.findIndex(
    p => p.id === state.currentPlayerId
  )
  if (index < 0) return state

  const enemyIndex = 1 - index
  const owner = state.players[index]
  const enemy = state.players[enemyIndex]

  const attacker = owner.field.find(
    f => f.instanceId === attackerId
  )

  if (!attacker || !canFollowerAttack(attacker)) {
    return state
  }

  const hp = Math.max(
    0,
    enemy.leaderHealth - Math.max(0, attacker.attack)
  )

  const players = [...state.players] as [Player, Player]

  players[index] = {
    ...owner,
    field: owner.field.map(f =>
      f.instanceId === attackerId
        ? { ...f, hasAttacked: true }
        : f
    ),
  }

  players[enemyIndex] = {
    ...enemy,
    leaderHealth: hp,
  }

  return {
    ...state,
    players,
    winnerId: hp === 0 ? owner.id : null,
  }
}

function drawCard(player: Player): {
  player: Player
  deckOut: boolean
} {
  if (player.deck.length === 0) {
    return { player, deckOut: true }
  }

  const [card, ...deck] = player.deck

  return {
    player: {
      ...player,
      deck,
      hand:
        player.hand.length >= MAX_HAND_SIZE
          ? player.hand
          : [...player.hand, card],
    },
    deckOut: false,
  }
}

/**
 * ターン終了と次ターン開始
 */
export function endTurn(state: GameState): GameState {
  if (state.phase !== 'main') return state
  if (state.winnerId !== null) return state

  const index = state.players.findIndex(
    p => p.id === state.currentPlayerId
  )
  if (index < 0) return state

  const nextIndex = 1 - index

  const players = state.players.map(p => ({
    ...p,
    field: p.field.map(f => ({ ...f })),
  })) as [Player, Player]

  const next = players[nextIndex]

  next.maxPp = Math.min(MAX_PP, next.maxPp + 1)
  next.pp = next.maxPp
  next.field = next.field.map(f => ({
    ...f,
    canAttack: true,
    hasAttacked: false,
  }))

  const draw = drawCard(next)
  players[nextIndex] = draw.player

  return {
    ...state,
    players,
    turn: state.turn + 1,
    currentPlayerId: next.id,
    phase: 'main',
    winnerId: draw.deckOut ? players[index].id : null,
  }
}
