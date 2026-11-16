import { getFriendMatchIdToken } from './firebaseRooms'

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
  field: unknown[]
  graveyard: string[]
}
export interface OnlineMatchView {
  revision: number
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
async function requestMatch(code: string, method: 'GET' | 'POST', body?: object): Promise<OnlineMatchView> {
  if (!isMatchServerConfigured()) throw new Error('対戦サーバーがまだ設定されていません。')
  const token = await getFriendMatchIdToken()
  const endpoint = method === 'GET' ? 'state' : 'mulligan'
  const response = await fetch(`${address}/rooms/${encodeURIComponent(code)}/${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  })
  const payload: unknown = await response.json()
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String(payload.error) : '対戦サーバーへの接続に失敗しました。'
    throw new Error(message)
  }
  return payload as OnlineMatchView
}
export function fetchOnlineMatch(code: string): Promise<OnlineMatchView> {
  return requestMatch(code, 'GET')
}
export function submitOnlineMulligan(code: string, revision: number, indices: number[]): Promise<OnlineMatchView> {
  return requestMatch(code, 'POST', { revision, indices })
}
