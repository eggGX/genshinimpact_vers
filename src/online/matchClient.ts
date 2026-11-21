import { getFriendMatchIdToken } from './firebaseRooms'
import type { OnlineAction } from '../../server/src/matchActions'
import type { ElementalAura, Shield } from '../game/types'

export interface OnlineFollowerView {
  instanceId: string
  cardId: string
  attack: number
  health: number
  maxHealth: number
  canAttack: boolean
  hasAttacked: boolean
  attacksThisTurn?: number
  skillUsed: boolean
  skillUsesThisTurn?: number
  burstUsed: boolean
  keywords: string[]
  aura: ElementalAura[]
  shield: Shield
}
export interface OnlinePlayerView {
  id: string
  name: string
  leaderHealth: number
  leaderMaxHealth: number
  pp: number
  maxPp: number
  energy: number
  handCount: number
  deckCount: number
  hand?: string[]
  field: OnlineFollowerView[]
  amulets?: Array<{instanceId: string; cardId: string; turnsRemaining: number}>
  graveyard: string[]
  leaderAura?: ElementalAura[]
  leaderShield?: Shield
  leaderBurningTurns?: number
  leaderSuperconduct?: boolean
  leaderQuickenCharges?: number
  leaderFrozenNextTurn?: boolean
  bondOfLife?: number
  crests?: Array<{id:string;turnsRemaining:number;usedElements:ElementalAura['element'][]}>
}
export interface OnlinePresentationSnapshot {
  turn: number
  phase: 'mulligan' | 'start' | 'main' | 'end'
  currentPlayerId: string
  winnerId: string | null
  players: [OnlinePlayerView, OnlinePlayerView]
}
export interface OnlinePresentationEvent {
  revision: number
  actorId: string
  title: string
  playedCardId?: string
  abilityCardId?: string
  abilityKind?: 'skill' | 'burst'
  frames: Array<{ label: string; state: OnlinePresentationSnapshot }>
}
export interface OnlineMatchView {
  revision: number
  history?: OnlinePresentationEvent[]
  mulliganReady: [boolean, boolean]
  seat: 0 | 1
  turn: number
  phase: 'mulligan' | 'start' | 'main' | 'end'
  currentPlayerId: string
  winnerId: string | null
  players: [OnlinePlayerView, OnlinePlayerView]
}

const address = import.meta.env.VITE_MATCH_SERVER_URL?.trim().replace(/\/$/, '')
export function isMatchServerConfigured(): boolean {
  return Boolean(address && /^https:\/\//.test(address))
}
/** Begin waking the Render Free service while users are still in the lobby,
 * rather than waiting for their first match-state request. No auth needed. */
export function warmOnlineMatchServer(): void {
  if (!isMatchServerConfigured()) return
  void fetch(`${address}/health`, { cache: 'no-store' }).catch(() => {
    // Prewarm is best-effort; the real request will surface any error.
  })
}

async function requestMatch(code: string, method: 'GET' | 'POST', endpoint: 'state' | 'mulligan' | 'action', body?: object): Promise<OnlineMatchView> {
  if (!isMatchServerConfigured()) throw new Error('対戦サーバーがまだ設定されていません。')
  const token = await getFriendMatchIdToken()
  let response: Response
  try {
    response = await fetch(`${address}/rooms/${encodeURIComponent(code)}/${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    })
  } catch (error) {
    throw new Error('対戦サーバーに接続できません。Renderの稼働状況とALLOWED_ORIGIN（localhost:5173の許可）を確認してください。', { cause: error })
  }
  const payload: unknown = await response.json()
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String(payload.error) : '対戦サーバーへの接続に失敗しました。'
    throw new Error(message)
  }
  return payload as OnlineMatchView
}
export function fetchOnlineMatch(code: string): Promise<OnlineMatchView> {
  return requestMatch(code, 'GET', 'state')
}
export function submitOnlineMulligan(code: string, revision: number, indices: number[]): Promise<OnlineMatchView> {
  return requestMatch(code, 'POST', 'mulligan', { revision, indices })
}

/** Commands are validated and executed exclusively by the trusted server. */
export function submitOnlineAction(code: string, revision: number, action: OnlineAction): Promise<OnlineMatchView> {
  return requestMatch(code, 'POST', 'action', { revision, action })
}
