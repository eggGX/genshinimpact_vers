import type { Card, ElementType, Follower, GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'

const MAX_FIELD = 5
const MAX_HAND = 9
const CREST_ELEMENTS: ElementType[] = [
  'anemo', 'geo', 'electro', 'dendro', 'hydro', 'pyro', 'cryo',
]

let nextNeutralInstanceId = 1

/** All summoned followers use the same instance shape as ordinary followers. */
export function createSummonedFollower(cardId: string, keywords: string[] = []): Follower {
  const card = getCard(cardId)
  if (!card || card.type !== 'follower') throw new Error(`Invalid summon: ${cardId}`)
  return {
    instanceId: `summon-${nextNeutralInstanceId++}`,
    cardId,
    attack: card.attack ?? 0,
    health: card.health ?? 1,
    maxHealth: card.health ?? 1,
    skillUsed: false,
    burstUsed: false,
    aura: [],
    shield: { normal: 0, crystallize: 0 },
    canAttack: Boolean(card.keywords?.includes('storm') ||
      card.keywords?.includes('rush')),
    hasAttacked: false,
    keywords: [...(card.keywords ?? []), ...keywords,
      ...(card.keywords?.includes('rush') ? ['rush_only'] : [])],
  }
}

function editPlayer(
  state: GameState,
  ownerId: string,
  edit: (player: Player) => Player
): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  const players = [...state.players] as [Player, Player]
  players[index] = edit(players[index])
  return { ...state, players }
}

export function summonFollowers(
  state: GameState,
  ownerId: string,
  cardId: string,
  count: number,
  keywords: string[] = []
): GameState {
  return editPlayer(state, ownerId, player => ({
    ...player,
    field: [
      ...player.field,
      ...Array.from(
        { length: Math.min(Math.max(0, count), MAX_FIELD - player.field.length) },
        () => createSummonedFollower(cardId, keywords)
      ),
    ],
  }))
}

function buffFollower(f: Follower, attack: number, health: number): Follower {
  return { ...f, attack: Math.max(0, f.attack + attack),
    health: f.health + health, maxHealth: f.maxHealth + health }
}

export function resolveNeutralPlay(
  state: GameState,
  ownerId: string,
  card: Card
): GameState {
  switch (card.id) {
    case 'C002':
      return editPlayer(state, ownerId, player => {
        const candidates = player.deck
          .map((id, index) => ({ id, index }))
          .filter(item => getCard(item.id)?.rarity === 'bronze')
        if (!candidates.length) return player
        const chosen = candidates[Math.floor(Math.random() * candidates.length)]
        return {
          ...player,
          deck: player.deck.filter((_, index) => index !== chosen.index),
          hand: player.hand.length < MAX_HAND
            ? [...player.hand, chosen.id] : player.hand,
        }
      })
    case 'C004':
      return summonFollowers(state, ownerId, 'C004', 1, ['no_last_word'])
    case 'C005':
      return summonFollowers(state, ownerId, 'C001', 4)
    case 'C006':
      return editPlayer(state, ownerId, player => ({
        ...player,
        field: player.field.map(f =>
          getCard(f.cardId)?.traits?.includes('ヒルチャール')
            ? buffFollower(f, 1, 1) : f),
      }))
    case 'C007':
      return summonFollowers(state, ownerId, 'neutral-dove', 2)
    case 'C009':
      if (state.players.find(player => player.id === ownerId)?.deck.length === 0) {
        const opponent = state.players.find(player => player.id !== ownerId)
        return { ...state, winnerId: opponent?.id ?? state.winnerId }
      }
      return editPlayer(state, ownerId, player => {
        // Drawing from an empty deck is an immediate loss, handled by caller.
        const [drawn, ...deck] = player.deck
        return {
          ...player,
          deck: drawn ? deck : player.deck,
          hand: drawn && player.hand.length < MAX_HAND
            ? [...player.hand, drawn] : player.hand,
          maxPp: Math.min(10, player.maxPp + 1),
        }
      })
    case 'C010':
      return editPlayer(state, ownerId, player => ({
        ...player,
        energy: Math.min(5, player.energy + 3),
        crests: [...(player.crests ?? []), {
          id: 'C010',
          turnsRemaining: 7,
          usedElements: [],
        }],
      }))
    default:
      return state
  }
}

/** A Wild Hunt death-spawn has no further last words. */
export function resolveNeutralDestroy(
  state: GameState,
  ownerId: string,
  follower: Follower
): GameState {
  if (follower.cardId === 'C004' && !follower.keywords.includes('no_last_word')) {
    return summonFollowers(state, ownerId, 'C004', 1, ['no_last_word'])
  }
  return state
}

export function resolveNeutralTurnEnd(state: GameState, ownerId: string): GameState {
  const owner = state.players.find(p => p.id === ownerId)
  if (!owner) return state
  const timmies = owner.field.filter(f => f.cardId === 'C007' && f.health > 0)
  const hasDove = owner.field.some(f => f.cardId === 'neutral-dove' && f.health > 0)
  let result = state
  if (!hasDove && timmies.length > 0) {
    const ids = new Set(timmies.map(f => f.instanceId))
    result = editPlayer(result, ownerId, p => ({
      ...p, field: p.field.map(f => ids.has(f.instanceId) ? buffFollower(f, 1, 1) : f),
    }))
  }

  const crests = result.players.find(p => p.id === ownerId)?.crests ?? []
  for (let i = 0; i < crests.length; i++) {
    const p = result.players.find(player => player.id === ownerId)
    const crest = p?.crests?.[i]
    if (!crest || crest.turnsRemaining <= 0 || result.winnerId !== null) continue
    const unused = CREST_ELEMENTS.filter(el => !crest.usedElements.includes(el))
    const element = unused[Math.floor(Math.random() * unused.length)]
    result = editPlayer(result, ownerId, player => ({
      ...player,
      crests: (player.crests ?? []).map((item, index) => index === i
        ? { ...item, turnsRemaining: item.turnsRemaining - 1,
          usedElements: element ? [...item.usedElements, element] : item.usedElements }
        : item),
    }))
    if (element) {
      const enemyIndex = result.players.findIndex(player => player.id !== ownerId)
      const players = [...result.players] as [Player, Player]
      const enemy = players[enemyIndex]
      const hp = Math.max(0, enemy.leaderHealth - 1)
      players[enemyIndex] = { ...enemy, leaderHealth: hp }
      result = { ...result, players,
        winnerId: hp === 0 ? ownerId : result.winnerId }
    }
  }
  return result
}

export function applyNeutralAttackBuff(
  state: GameState,
  ownerId: string,
  followerId: string
): GameState {
  const p = state.players.find(player => player.id === ownerId)
  const attacker = p?.field.find(f => f.instanceId === followerId)
  if (!p || attacker?.cardId !== 'C008') return state
  const ally = p.field.some(f => f.instanceId !== followerId &&
    getCard(f.cardId)?.traits?.includes('ヒルチャール') && f.health > 0)
  if (!ally) return state
  return editPlayer(state, ownerId, player => ({
    ...player,
    field: player.field.map(f => f.instanceId === followerId
      ? buffFollower(f, 1, 0) : f),
  }))
}

export function isGuarded(enemy: Player): boolean {
  return enemy.field.some(f => f.health > 0 && f.keywords.includes('guard'))
}
