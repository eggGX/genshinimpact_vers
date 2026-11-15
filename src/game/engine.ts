
import type {
  Card,
  Follower,
  GameState,
  Player,
} from './types'
import { getCard, getDeckCardPool } from '../data/cardRegistry'
import { resolveEffects } from './effects'
import { absorbDamage, restoreInherentAura, resolveElementalDamage, resolveReactionConsequence } from './elemental'

const deckCards = getDeckCardPool()

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
      (_, i) => deckCards[i % deckCards.length].id
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
    energy: 0,
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

export { getCard } from '../data/cardRegistry'

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
    !enemy.field.some(f => f.health > 0 && !f.keywords.includes('aura'))
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
        follower.instanceId,
        resolveDeaths
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
      sourceId,
      resolveDeaths
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
      !enemy.field.some(f => f.instanceId === targetId && f.health > 0 && !f.keywords.includes('aura'))
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

    skillUsed: false,
    burstUsed: false,

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
    field: [...player.field, restoreInherentAura(follower)],
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
    follower.instanceId,
    resolveDeaths
  )

  return resolveDeaths(result)
}

export type AbilityKind = 'skill' | 'burst'

export function needsAbilityTarget(card: Card, kind: AbilityKind): boolean {
  const ability = kind === 'skill' ? card.elementalSkill : card.elementalBurst
  return (ability?.effects ?? []).some(effect =>
    effect.target === 'selected_enemy_follower')
}

export function canUseAbility(
  state: GameState,
  followerId: string,
  kind: AbilityKind
): boolean {
  if (state.phase !== 'main' || state.winnerId !== null) return false
  const index = state.players.findIndex(p => p.id === state.currentPlayerId)
  if (index < 0) return false
  const owner = state.players[index]
  const follower = owner.field.find(f => f.instanceId === followerId)
  if (!follower || follower.health <= 0 ||
      follower.keywords.includes('frozen')) return false
  const card = getCard(follower.cardId)
  const ability = kind === 'skill' ? card?.elementalSkill : card?.elementalBurst
  if (!ability || (kind === 'skill' ? follower.skillUsed : follower.burstUsed)) return false
  if (kind === 'burst' && owner.energy < (ability.energyCost ?? 0)) return false
  if (card && needsAbilityTarget(card, kind) && !state.players[1 - index].field.some(f => f.health > 0 && !f.keywords.includes('aura'))) {
    return false
  }
  return true
}

export function activateAbility(
  state: GameState,
  followerId: string,
  kind: AbilityKind,
  targetId?: string
): GameState {
  if (!canUseAbility(state, followerId, kind)) return state
  const index = state.players.findIndex(p => p.id === state.currentPlayerId)
  if (index < 0) return state
  const owner = state.players[index]
  const follower = owner.field.find(f => f.instanceId === followerId)!
  const card = getCard(follower.cardId)!
  const ability = kind === 'skill' ? card.elementalSkill! : card.elementalBurst!
  if (needsAbilityTarget(card, kind) &&
      (!targetId || !state.players[1 - index].field.some(f => f.instanceId === targetId && f.health > 0 && !f.keywords.includes('aura')))) {
    return state
  }
  const players = [...state.players] as [Player, Player]
  players[index] = {
    ...owner,
    energy: kind === 'skill'
      ? Math.min(5, owner.energy + 1)
      : owner.energy - (ability.energyCost ?? 0),
    field: owner.field.map(f =>
      f.instanceId === followerId
        ? { ...f,
            skillUsed: kind === 'skill' ? true : f.skillUsed,
            burstUsed: kind === 'burst' ? true : f.burstUsed }
        : f),
  }
  let result: GameState = { ...state, players }
  result = resolveEffects(
    result, owner.id, ability.effects, kind, targetId, followerId,
    resolveDeaths
  )
  return resolveDeaths(result)
}

export function canFollowerAttack(
  follower: Follower
): boolean {
  return (
    follower.health > 0 &&
    !follower.keywords.includes('frozen') &&
    !follower.keywords.includes('cannot_attack') &&
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

  if (!attacker || !defender || defender.health <= 0 ||
      defender.keywords.includes('intimidate')) return state
  if (!canFollowerAttack(attacker)) return state

  const attackDamage = Math.max(0, attacker.attack)
  const counterDamage = Math.max(0, defender.attack)
  const attackerElement = getCard(attacker.cardId)?.normalAttackElement
  const defenderElement = getCard(defender.cardId)?.normalAttackElement

  // 両フォロワーの被ダメージを先に確定し、反応の副次効果を解決する。
  const toAttacker = resolveElementalDamage(
    attacker, counterDamage, defenderElement
  )
  const toDefender = resolveElementalDamage(
    defender, attackDamage, attackerElement
  )
  const players = [...state.players] as [Player, Player]
  players[index] = {
    ...owner,
    field: owner.field.map(f =>
      f.instanceId === attackerId
        ? { ...toAttacker.follower, hasAttacked: true }
        : f
    ),
  }
  players[enemyIndex] = {
    ...enemy,
    field: enemy.field.map(f =>
      f.instanceId === targetId ? toDefender.follower : f
    ),
  }

  let result = { ...state, players }
  result = resolveReactionConsequence(
    result, enemyIndex, targetId, toDefender.reaction, toDefender.reactedElement, index
  )
  result = resolveReactionConsequence(
    result, index, attackerId, toAttacker.reaction, toAttacker.reactedElement, enemyIndex
  )
  return resolveDeaths(result)
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

  // 燃焼：持ち主のターン終了時に1ダメージ、残りターンを1減らす。
  // ダメージ・持続時間は暫定のテスト仕様。
  const burnPlayers = result.players.map(p => p.id !== currentId ? p : ({
    ...p,
    field: p.field.map(f => {
      const status = f.keywords.find(k => k.startsWith('burning:'))
      if (!status) return f
      const count = Number(status.slice(8)) || 0
      return {
        ...f,
        ...absorbDamage(f, 1),
        keywords: [
          ...f.keywords.filter(k => !k.startsWith('burning:')),
          ...(count > 1 ? [`burning:${count - 1}`] : []),
        ],
      }
    }),
  })) as [Player, Player]
  result = resolveDeaths({ ...result, players: burnPlayers })
  if (result.winnerId !== null) return result

  // 草原核：持ち主のターン終了時、草原核1個につき自陣ランダム1体へ2ダメージ。
  // 草原核自身も候補に含め、複数核は順番に解決する。
  const coreOwner = result.players[currentIndex]
  const cores = coreOwner.field.filter(f => f.cardId === 'dendro-core')
  let coreState = result
  for (const core of cores) {
    if (coreState.winnerId !== null) break
    const current = coreState.players[currentIndex]
    if (!current.field.some(f => f.instanceId === core.instanceId)) continue
    const candidates = current.field.filter(f => f.health > 0)
    if (candidates.length === 0) break
    const chosen = candidates[Math.floor(Math.random() * candidates.length)]
    const players = [...coreState.players] as [Player, Player]
    players[currentIndex] = {
      ...current,
      field: current.field.map(f =>
        f.instanceId === chosen.instanceId ? absorbDamage(f, 2) : f),
    }
    coreState = resolveDeaths({ ...coreState, players })
  }
  result = coreState
  if (result.winnerId !== null) return result

  // 烈開花が与えたリーダー燃焼：自ターン終了時に1ダメージ、3回で終了。
  const burningLeader = result.players[currentIndex]
  if ((burningLeader.leaderBurningTurns ?? 0) > 0) {
    const hp = Math.max(0, burningLeader.leaderHealth - 1)
    const players = [...result.players] as [Player, Player]
    players[currentIndex] = {
      ...burningLeader,
      leaderHealth: hp,
      leaderBurningTurns: (burningLeader.leaderBurningTurns ?? 0) - 1,
    }
    result = {
      ...result,
      players,
      winnerId: hp === 0 ? players[nextIndex].id : result.winnerId,
    }
    if (result.winnerId !== null) return result
  }

  // 凍結は持ち主のターン終了時に解除（次の自分のターン1回を行動不可）。
  // 将来の元素スキル・元素爆発も同じ frozen キーワードを参照する。
  const endedPlayers = result.players.map(p => (
    p.id === currentId
      ? {
          ...p,
          field: p.field.map(f => ({
            ...f,
            keywords: f.keywords.filter(k => k !== 'frozen'),
          })),
        }
      : p
  )) as [Player, Player]
  result = { ...result, players: endedPlayers }

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
    skillUsed: false,
    burstUsed: false,
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
