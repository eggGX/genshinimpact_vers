
import type {
  Card,
  Follower,
  GameState,
  Player,
} from './types'
import { getCard, getDeckCardPool } from '../data/cardRegistry'
import { resolveEffects } from './effects'
import { resolveHydroSpell, resolveHydroTurnEnd, resolveHydroAttack } from './hydroRules'
import { resolveCryoPlay, resolveCryoTurnEnd } from './cryoRules'
import { cryoPlay, cryoSpell, cryoSkill, cryoBurst, cryoTurnEnd, cryoCrestsEnd, cryoDestroy, cryoAttack } from './cryoAdvancedRules'
import { damageLeader } from './leaderShield'
import { resolveHydroAdvancedPlay, resolveHydroAdvancedSkill, resolveHydroAdvancedBurst, resolveHydroAdvancedTurnEnd, resolveHydroPermanentsTurnEnd, resolveHydroAdvancedDestroy, resolveHydroAdvancedAttack } from './hydroAdvancedRules'
import { resolveDilucSkill, resolveDilucBurst, transformLyney, resolveLegendaryAttack, effectiveAttack, resolveLegendaryTurnStart, resolveLegendaryDestroy } from './pyroLegendaryRules'
import { resolvePyroDestroy, resolvePyroSpell, resolvePyroAmuletPlay, resolvePyroTurnEnd, resolvePyroAttackAfter, resolvePyroGoldPlay, resolvePyroGoldSkill, resolvePyroGoldTurnEnd } from './pyroRules'
import { applyNeutralAttackBuff, isGuarded, resolveNeutralDestroy, resolveNeutralPlay, resolveNeutralTurnEnd } from './neutralRules'
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
/** A self-buff fanfare can choose an existing ally or the new follower itself. */
export function needsFriendlyPlayTarget(card: Card): boolean {
  return ['C021', 'C044'].includes(card.id)
}

export function needsPlayTarget(card: Card): boolean {
  return card.id === 'C018' || (card.effects ?? []).some(
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

  if (!card || !['follower', 'spell', 'amulet'].includes(card.type) || card.implementationStatus === 'data_only') return false
  if (owner.pp < card.cost) return false
  if (card.type !== 'spell' && owner.field.length + (owner.amulets?.length ?? 0) >= MAX_FIELD_SIZE) return false

  if (
    needsPlayTarget(card) &&
    !enemy.field.some(f => f.health > 0 && !f.keywords.includes('aura') && !f.keywords.includes('stealth'))
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
      result = resolveNeutralDestroy(result, ownerId, follower)
      result = resolvePyroDestroy(result, ownerId, follower)
      result = resolveLegendaryDestroy(result, ownerId, follower)
      result = resolveHydroAdvancedDestroy(result, ownerId, follower)
      result = cryoDestroy(result, ownerId, follower, resolveDeaths)
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
    if (result.winnerId === null && trigger === 'turn_end') {
      result = resolvePyroGoldTurnEnd(result, playerId, sourceId, resolveDeaths)
      result = resolveHydroTurnEnd(result, playerId, sourceId)
      result = resolveHydroAdvancedTurnEnd(result, playerId, sourceId, resolveDeaths)
      result = resolveCryoTurnEnd(result, playerId, sourceId)
      result = cryoTurnEnd(result, playerId, sourceId, resolveDeaths)
      result = resolveDeaths(result)
    }
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

  if (needsFriendlyPlayTarget(card) &&
      (targetId !== 'self' && (!targetId ||
        !player.field.some(f => f.instanceId === targetId && f.health > 0)))) {
    return state
  }

  if (needsPlayTarget(card)) {
    const enemy = state.players[1 - index]

    if (
      !targetId ||
      !enemy.field.some(f => f.instanceId === targetId && f.health > 0 && !f.keywords.includes('aura') && !f.keywords.includes('stealth'))
    ) {
      return state
    }
  }

  if (card.type === 'spell') {
    const players = [...state.players] as [Player, Player]
    players[index] = {
      ...player,
      pp: player.pp - card.cost,
      hand: player.hand.filter((_, i) => i !== handIndex),
      graveyard: [...player.graveyard, card.id],
    }
    let next: GameState = { ...state, players }
    next = resolveEffects(next, playerId, card.effects ?? [], 'on_play',
      targetId, undefined, resolveDeaths)
    if (next.winnerId !== null) return next
    next = resolveNeutralPlay(next, playerId, card)
    if (next.winnerId !== null) return next
    next = resolvePyroSpell(next, playerId, card.id, targetId, resolveDeaths)
    next = resolveHydroSpell(next, playerId, card.id)
    next = cryoSpell(next, playerId, card.id, resolveDeaths)
    return resolveDeaths(next)
  }

  if (card.type === 'amulet') {
    const players = [...state.players] as [Player, Player]
    players[index] = {
      ...player,
      pp: player.pp - card.cost,
      hand: player.hand.filter((_, i) => i !== handIndex),
    }
    return resolvePyroAmuletPlay({ ...state, players }, playerId)
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
    canAttack: Boolean(card.keywords?.includes('storm') ||
      card.keywords?.includes('rush')),
    hasAttacked: false,
    keywords: [...(card.keywords ?? []),
      ...(card.keywords?.includes('rush') ? ['rush_only'] : [])],
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

  if (result.winnerId === null) {
    result = resolveNeutralPlay(result, playerId, card)
    result = resolvePyroGoldPlay(result, playerId, card.id, follower.instanceId, targetId)
    result = resolveHydroAdvancedPlay(result, playerId, card.id)
    result = resolveCryoPlay(result, playerId, card.id)
    result = cryoPlay(result, playerId, card.id, follower.instanceId, targetId)
  }
  return resolveDeaths(result)
}

export type AbilityKind = 'skill' | 'burst'

export function needsAbilityTarget(card: Card, kind: AbilityKind): boolean {
  const ability = kind === 'skill' ? card.elementalSkill : card.elementalBurst
  return (card.id === 'C049' && kind === 'skill') || (ability?.effects ?? []).some(effect =>
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
  if (!ability || (kind === 'skill'
    ? (card?.id === 'C023'
      ? (follower.skillUsesThisTurn ?? (follower.skillUsed ? 1 : 0)) >= 3
      : follower.skillUsed)
    : follower.burstUsed)) return false
  if (kind === 'skill' && owner.pp < (ability.ppCost ?? 0)) return false
  if (kind === 'skill' && ['C019', 'C020', 'C038', 'C039', 'C053', 'C054'].includes(card?.id ?? '') &&
      owner.field.length + (owner.amulets?.length ?? 0) >= MAX_FIELD_SIZE) return false
  if (kind === 'burst' && owner.energy < (ability.energyCost ?? 0)) return false
  if (card && needsAbilityTarget(card, kind) && !state.players[1 - index].field.some(f => f.health > 0 && !f.keywords.includes('aura') && !f.keywords.includes('stealth'))) {
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
      (!targetId || !state.players[1 - index].field.some(f => f.instanceId === targetId && f.health > 0 && !f.keywords.includes('aura') && !f.keywords.includes('stealth')))) {
    return state
  }
  const players = [...state.players] as [Player, Player]
  players[index] = {
    ...owner,
    energy: kind === 'skill'
      ? Math.min(5, owner.energy + 1)
      : owner.energy - (ability.energyCost ?? 0),
    pp: kind === 'skill' ? owner.pp - (ability.ppCost ?? 0) : owner.pp,
    field: owner.field.map(f =>
      f.instanceId === followerId
        ? { ...f,
            skillUsed: kind === 'skill' ? true : f.skillUsed,
            skillUsesThisTurn: kind === 'skill'
              ? (f.skillUsesThisTurn ?? (f.skillUsed ? 1 : 0)) + 1 : f.skillUsesThisTurn,
            burstUsed: kind === 'burst' ? true : f.burstUsed }
        : f),
  }
  let result: GameState = { ...state, players }
  if (card.id === 'C023' && kind === 'skill' && targetId) {
    result = resolveDilucSkill(result, index, followerId, targetId)
  } else if (card.id === 'C023' && kind === 'burst') {
    result = resolveDilucBurst(result, owner.id, resolveDeaths)
  } else {
    result = resolveEffects(
      result, owner.id, ability.effects, kind, targetId, followerId,
      resolveDeaths
    )
  }
  if (result.winnerId === null && kind === 'skill') {
    result = resolvePyroGoldSkill(result, owner.id, card.id)
    if (card.id === 'C025') {
      const player = result.players[index]
      const players = [...result.players] as [Player, Player]
      players[index] = { ...player, field: player.field.map(f =>
        f.instanceId === followerId
          ? { ...f, keywords: [...f.keywords.filter(k => k !== 'normal_attack_pyro'),
              'normal_attack_pyro'] } : f) }
      result = { ...result, players }
    }
  }
  if (result.winnerId === null && kind === 'skill') {
    result = resolveHydroAdvancedSkill(result, owner.id, followerId, card.id)
    result = cryoSkill(result, owner.id, card.id, followerId, targetId, resolveDeaths)
  }
  if (result.winnerId === null && kind === 'burst') {
    if (card.id === 'C024') result = transformLyney(result, index, followerId)
    result = resolveHydroAdvancedBurst(result, owner.id, followerId, card.id, resolveDeaths)
    result = cryoBurst(result, owner.id, card.id, resolveDeaths)
  }
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
    (follower.keywords.includes('double_attack')
      ? (follower.attacksThisTurn ?? (follower.hasAttacked ? 1 : 0)) < 2
      : !follower.hasAttacked)
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
      defender.keywords.includes('intimidate') ||
      defender.keywords.includes('stealth')) return state
  if (!canFollowerAttack(attacker)) return state
  if (isGuarded(enemy) && !defender.keywords.includes('guard') &&
      !attacker.keywords.includes('ignore_guard')) return state

  const declared: GameState = {
    ...state,
    players: state.players.map((p, i) => i !== index ? p : ({
      ...p,
      field: p.field.map(f => f.instanceId === attackerId
        ? { ...f, keywords: f.keywords.filter(k => k !== 'stealth') }
        : f),
    })) as [Player, Player],
  }
  const buffed = cryoAttack(
    resolveHydroAdvancedAttack(
      resolveHydroAttack(
        resolveLegendaryAttack(
          applyNeutralAttackBuff(declared, owner.id, attackerId), owner.id, attackerId
        ), owner.id, attackerId
      ), owner.id, attackerId
    ), owner.id, attackerId
  )
  const boostedOwner = buffed.players[index]
  const boostedAttacker = boostedOwner.field.find(f => f.instanceId === attackerId)!
  const attackDamage = effectiveAttack(buffed, owner.id, boostedAttacker)
  const counterDamage = effectiveAttack(state, enemy.id, defender)
  const attackerElement = boostedAttacker.keywords.includes('normal_attack_cryo')
    ? 'cryo' : boostedAttacker.keywords.includes('normal_attack_hydro')
      ? 'hydro' : boostedAttacker.keywords.includes('normal_attack_pyro')
        ? 'pyro' : getCard(attacker.cardId)?.normalAttackElement
  const defenderElement = getCard(defender.cardId)?.normalAttackElement

  // 両フォロワーの被ダメージを先に確定し、反応の副次効果を解決する。
  const toAttacker = resolveElementalDamage(
    boostedAttacker, counterDamage, defenderElement
  )
  const toDefender = resolveElementalDamage(
    defender, attackDamage, attackerElement
  )
  const players = [...buffed.players] as [Player, Player]
  players[index] = {
    ...boostedOwner,
    field: boostedOwner.field.map(f =>
      f.instanceId === attackerId
        ? { ...toAttacker.follower, hasAttacked: true,
          attacksThisTurn: (boostedAttacker.attacksThisTurn ??
            (boostedAttacker.hasAttacked ? 1 : 0)) + 1 }
        : f
    ),
  }
  players[enemyIndex] = {
    ...enemy,
    field: enemy.field.map(f =>
      f.instanceId === targetId ? toDefender.follower : f
    ),
  }

  let result = { ...buffed, players }
  result = resolveReactionConsequence(
    result, enemyIndex, targetId, toDefender.reaction, toDefender.reactedElement, index
  )
  result = resolveReactionConsequence(
    result, index, attackerId, toAttacker.reaction, toAttacker.reactedElement, enemyIndex
  )
  result = resolveDeaths(result)
  return resolvePyroAttackAfter(result, owner.id, attackerId)
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

  if (!attacker || !canFollowerAttack(attacker) ||
      attacker.keywords.includes('rush_only') || isGuarded(enemy)) {
    return state
  }

  const declared: GameState = {
    ...state,
    players: state.players.map((p, i) => i !== index ? p : ({
      ...p,
      field: p.field.map(f => f.instanceId === attackerId
        ? { ...f, keywords: f.keywords.filter(k => k !== 'stealth') }
        : f),
    })) as [Player, Player],
  }
  const buffed = cryoAttack(
    resolveHydroAdvancedAttack(
      resolveHydroAttack(
        resolveLegendaryAttack(
          applyNeutralAttackBuff(declared, owner.id, attackerId), owner.id, attackerId
        ), owner.id, attackerId
      ), owner.id, attackerId
    ), owner.id, attackerId
  )
  const boostedOwner = buffed.players[index]
  const boostedAttacker = boostedOwner.field.find(f => f.instanceId === attackerId)!
  const damagedLeader = damageLeader(
    buffed.players[enemyIndex], effectiveAttack(buffed, owner.id, boostedAttacker)
  )
  const hp = damagedLeader.leaderHealth

  const players = [...buffed.players] as [Player, Player]

  players[index] = {
    ...boostedOwner,
    field: boostedOwner.field.map(f =>
      f.instanceId === attackerId
        ? { ...f, hasAttacked: true,
          attacksThisTurn: (f.attacksThisTurn ?? (f.hasAttacked ? 1 : 0)) + 1 }
        : f
    ),
  }

  players[enemyIndex] = damagedLeader

  return resolvePyroAttackAfter({
    ...buffed,
    players,
    winnerId: hp === 0 ? owner.id : null,
  }, owner.id, attackerId)
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

  result = resolveNeutralTurnEnd(result, currentId)
  if (result.winnerId !== null) return result

  result = resolvePyroTurnEnd(result, currentId, resolveDeaths)
  if (result.winnerId !== null) return result

  result = resolveHydroPermanentsTurnEnd(result, currentId, resolveDeaths)
  if (result.winnerId !== null) return result

  result = cryoCrestsEnd(result, currentId, resolveDeaths)
  if (result.winnerId !== null) return result

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
    attacksThisTurn: 0,
    skillUsed: false,
    burstUsed: false,
    skillUsesThisTurn: 0,
    keywords: f.keywords.filter(keyword => keyword !== 'rush_only'),
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

  // The Funny Hat Cat's self-destruction resolves before other start effects.
  result = resolveLegendaryTurnStart(result, nextId, resolveDeaths)
  if (result.winnerId !== null) return result

  // 3. ターン開始時効果
  return resolveTurnEffects(
    result,
    nextId,
    'turn_start'
  )
}
