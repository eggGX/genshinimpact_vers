
import type {
  Card,
  Follower,
  GameState,
  Player,
} from './types'
import { testCards } from '../data/testCards'
import { resolveEffects } from './effects'
import { resolveElementalDamage } from './elemental'

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

/**
 * マリガン
 */
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
 * プレイ時の対象選択判定
 */
export function needsPlayTarget(card: Card): boolean {
  return (card.effects ?? []).some(
    effect =>
      effect.trigger === 'on_play' &&
      effect.target === 'selected_enemy_follower'
  )
}

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
 * 破壊処理とラストワード
 *
 * 同時破壊はターンプレイヤー優先。
 * 同じプレイヤー内では配置順。
 */
function resolveDeaths(state: GameState): GameState {
  let result = state

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

    result = { ...result, players }

    for (const { ownerId, follower } of destroyed) {
      if (result.winnerId !== null) break

      const card = getCard(follower.cardId)

      result = resolveEffects(
        result,
        ownerId,
        card?.effects ?? [],
        'on_destroy',
        undefined,
        follower.instanceId
      )
    }

    if (result.winnerId !== null) break
  }

  return result
}

/**
 * ターン開始・終了時効果
 */
function resolveTurnEffects(
  state: GameState,
  playerId: string,
  trigger: 'turn_start' | 'turn_end'
): GameState {
  const player = state.players.find(
    p => p.id === playerId
  )

  if (!player) return state

  const sourceIds = player.field.map(
    follower => follower.instanceId
  )

  let result = state

  for (const sourceId of sourceIds) {
    if (result.winnerId !== null) break

    const currentOwner = result.players.find(
      p => p.id === playerId
    )
    const source = currentOwner?.field.find(
      f => f.instanceId === sourceId
    )

    if (!source || source.health <= 0) continue

    const card = getCard(source.cardId)

    result = resolveEffects(
      result,
      playerId,
      card?.effects ?? [],
      trigger,
      undefined,
      sourceId
    )

    result = resolveDeaths(result)
  }

  return result
}

/**
 * フォロワーをプレイ
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

    // 暫定。正式な元素エネルギー管理は後で変更
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
    targetId,
    follower.instanceId
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
  const attackerElement = getCard(attacker.cardId)?.normalAttackElement
  const defenderElement = getCard(defender.cardId)?.normalAttackElement

  const players = [...state.players] as [Player, Player]

  players[index] = {
    ...owner,
    field: owner.field.map(f =>
      f.instanceId === attackerId
        ? {
            ...resolveElementalDamage(
              f,
              counterDamage,
              defenderElement
            ).follower,
            hasAttacked: true,
          }
        : f
    ),
  }

  players[enemyIndex] = {
    ...enemy,
    field: enemy.field.map(f =>
      f.instanceId === targetId
        ? resolveElementalDamage(
            f,
            attackDamage,
            attackerElement
          ).follower
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

/**
 * デッキから1枚ドロー
 */
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
 * ターン終了・次ターン開始
 */
export function endTurn(state: GameState): GameState {
  if (state.phase !== 'main') return state
  if (state.winnerId !== null) return state

  const currentIndex = state.players.findIndex(
    p => p.id === state.currentPlayerId
  )
  if (currentIndex < 0) return state

  const nextIndex = 1 - currentIndex
  const currentId = state.players[currentIndex].id
  const nextId = state.players[nextIndex].id

  // 1. ターン終了時効果
  let result = resolveTurnEffects(
    state,
    currentId,
    'turn_end'
  )

  if (result.winnerId !== null) {
    return result
  }

  // 2. 次のプレイヤーへ
  const players = result.players.map(p => ({
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

  result = {
    ...result,
    players,
    turn: result.turn + 1,
    currentPlayerId: nextId,
    phase: 'main',
    winnerId: draw.deckOut ? currentId : null,
  }

  if (result.winnerId !== null) {
    return result
  }

  // 3. ターン開始時効果
  return resolveTurnEffects(
    result,
    nextId,
    'turn_start'
  )
}
