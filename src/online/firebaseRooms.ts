/**
 * Firebase REST transport for the friend-room lobby.
 * This module deliberately stores NO decks, hands, draws, or game state.
 * Online game actions must go through a trusted server in a later phase.
 */
import { validateDeck, type DeckDefinition } from '../data/deckRules'

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim()
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim()
const SESSION_KEY = 'genshin-friend-room-auth-v1'

type AuthSession = {
  uid: string
  idToken: string
  refreshToken: string
  expiresAt: number
}
export type FriendRoom = {
  code: string
  hostUid: string
  guestUid: string
  status: 'waiting' | 'playing'
  hostReady: boolean
  guestReady: boolean
  updateTime: string
}

let currentSession: AuthSession | null = null

export function isFriendRoomsConfigured(): boolean {
  return Boolean(projectId && apiKey)
}

function requiredConfig(): { projectId: string; apiKey: string } {
  if (!projectId || !apiKey) {
    throw new Error('Firebaseが未設定です。VITE_FIREBASE_PROJECT_ID と VITE_FIREBASE_API_KEY を設定してください。')
  }
  return { projectId, apiKey }
}

function sessionFromStorage(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const s = value as Partial<AuthSession>
    if (typeof s.uid === 'string' && typeof s.idToken === 'string' &&
        typeof s.refreshToken === 'string' && typeof s.expiresAt === 'number') {
      return s as AuthSession
    }
  } catch { /* Blocked storage creates a fresh anonymous session. */ }
  return null
}

function storeSession(session: AuthSession): AuthSession {
  currentSession = session
  try { window.localStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch { /* optional */ }
  return session
}

async function jsonRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (data && typeof data === 'object' && 'error' in data)
      ? (data as { error?: { message?: string } }).error?.message : undefined
    throw new Error(error || `サーバーへの接続に失敗しました（HTTP ${response.status}）`)
  }
  return data as T
}

async function getSession(): Promise<AuthSession> {
  const { apiKey } = requiredConfig()
  const old = currentSession ?? sessionFromStorage()
  if (old && old.expiresAt > Date.now() + 90_000) return old
  if (old?.refreshToken) {
    try {
      const result = await jsonRequest<{
        id_token: string; refresh_token: string; expires_in: string; user_id: string
      }>(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: old.refreshToken }),
      })
      return storeSession({
        uid: result.user_id, idToken: result.id_token,
        refreshToken: result.refresh_token,
        expiresAt: Date.now() + Number(result.expires_in) * 1000,
      })
    } catch { /* Revoked identity: create a new anonymous identity. */ }
  }
  const created = await jsonRequest<{
    localId: string; idToken: string; refreshToken: string; expiresIn: string
  }>(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  })
  return storeSession({
    uid: created.localId, idToken: created.idToken,
    refreshToken: created.refreshToken,
    expiresAt: Date.now() + Number(created.expiresIn) * 1000,
  })
}

const firestoreBase = () =>
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(requiredConfig().projectId)}/databases/(default)/documents/friendRooms`
type FirestoreRoom = {
  fields?: Record<string, { stringValue?: string; booleanValue?: boolean }>
  updateTime?: string
}
const value = (s: string) => ({ stringValue: s })
const boolValue = (b: boolean) => ({ booleanValue: b })
const roomFromDocument = (code: string, document: FirestoreRoom): FriendRoom => ({
  code,
  hostUid: document.fields?.hostUid?.stringValue ?? '',
  guestUid: document.fields?.guestUid?.stringValue ?? '',
  status: (document.fields?.status?.stringValue === 'playing' ? 'playing' : 'waiting'),
  hostReady: document.fields?.hostReady?.booleanValue === true,
  guestReady: document.fields?.guestReady?.booleanValue === true,
  updateTime: document.updateTime ?? '',
})
async function firestore<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession()
  return jsonRequest<T>(`${firestoreBase()}${path}`, {
    ...init, headers: {
      Authorization: `Bearer ${session.idToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
}
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8)
}
function generateCode(): string {
  const bytes = new Uint32Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, n => ALPHABET[n % ALPHABET.length]).join('')
}

export async function createFriendRoom(): Promise<FriendRoom> {
  const session = await getSession()
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    try {
      const room = await firestore<FirestoreRoom>(`?documentId=${code}`, {
        method: 'POST',
        body: JSON.stringify({ fields: {
          hostUid: value(session.uid),
          guestUid: value(''),
          status: value('waiting'),
          hostReady: boolValue(false),
          guestReady: boolValue(false),
        } }),
      })
      return roomFromDocument(code, room)
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('ALREADY_EXISTS')) throw error
    }
  }
  throw new Error('ルームコードを発行できませんでした。もう一度お試しください。')
}

export async function fetchFriendRoom(code: string): Promise<FriendRoom> {
  const clean = normalizeRoomCode(code)
  if (clean.length !== 8) throw new Error('ルームコードは8文字です。')
  try {
    return roomFromDocument(clean, await firestore<FirestoreRoom>(`/${clean}`))
  } catch (error) {
    if (error instanceof Error && error.message.includes('NOT_FOUND')) {
      throw new Error('ルームが見つかりません。コードを確認してください。')
    }
    throw error
  }
}

export async function joinFriendRoom(code: string): Promise<FriendRoom> {
  const session = await getSession()
  const room = await fetchFriendRoom(code)
  if (room.hostUid === session.uid || room.guestUid === session.uid) return room
  if (room.guestUid) throw new Error('このルームはすでに2人参加しています。')
  // Firestore updateTime precondition prevents two simultaneous joins.
  // Security rules permit updating guestUid only while the slot is empty.
  try {
    const document = await firestore<FirestoreRoom>(
      `/${room.code}?updateMask.fieldPaths=guestUid&currentDocument.updateTime=${encodeURIComponent(room.updateTime)}`,
      { method: 'PATCH', body: JSON.stringify({ fields: { guestUid: value(session.uid) } }) },
    )
    return roomFromDocument(room.code, document)
  } catch (error) {
    if (error instanceof Error && /FAILED_PRECONDITION|PERMISSION_DENIED|ABORTED/.test(error.message)) {
      throw new Error('別の人が先に参加した可能性があります。ルームを確認してください。')
    }
    throw error
  }
}

export async function getMyFriendRoomRole(room: FriendRoom): Promise<'host' | 'guest' | null> {
  const { uid } = await getSession()
  if (room.hostUid === uid) return 'host'
  if (room.guestUid === uid) return 'guest'
  return null
}

/**
 * Register a 40-card snapshot into this participant's PRIVATE document.
 * Clients cannot read the other participant's deck through Firestore rules.
 * A future trusted game server will validate both snapshots before shuffling.
 */
export async function uploadPrivateDeck(room: FriendRoom, deck: DeckDefinition): Promise<void> {
  const role = await getMyFriendRoomRole(room)
  if (!role) throw new Error('このルームの参加者ではありません。')
  if (!room.guestUid || room.status !== 'waiting') {
    throw new Error('対戦準備中のルームでのみデッキを登録できます。')
  }
  if ((role === 'host' ? room.hostReady : room.guestReady)) {
    throw new Error('デッキの再登録は準備完了を解除してから行ってください。')
  }
  const errors = validateDeck(deck)
  if (errors.length) throw new Error(errors[0])
  await firestore<FirestoreRoom>(`/${room.code}/privateDecks/${role}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: {
        ownerUid: value(role === 'host' ? room.hostUid : room.guestUid),
        elements: { arrayValue: { values: deck.elements.map(value) } },
        cards: { arrayValue: { values: deck.cards.map(value) } },
      },
    }),
  })
}

/** Update only this participant's readiness, after private deck registration. */
export async function setFriendRoomReady(
  room: FriendRoom, ready: boolean, deck?: DeckDefinition,
): Promise<FriendRoom> {
  const role = await getMyFriendRoomRole(room)
  if (!role) throw new Error('このルームの参加者ではありません。')
  if (!room.guestUid) throw new Error('もう1人の参加を待ってください。')
  if (room.status !== 'waiting') throw new Error('対戦開始後は準備状態を変更できません。')
  if (ready) {
    if (!deck) throw new Error('デッキが指定されていません。')
    await uploadPrivateDeck(room, deck)
  }
  const field = role === 'host' ? 'hostReady' : 'guestReady'
  const updated = await firestore<FirestoreRoom>(
    `/${room.code}?updateMask.fieldPaths=${field}`,
    { method: 'PATCH', body: JSON.stringify({ fields: { [field]: boolValue(ready) } }) },
  )
  return roomFromDocument(room.code, updated)
}

/**
 * Transition the lobby to an online match session.
 * Only the host can start, and the Firestore rules verify BOTH ready flags.
 * This does not yet create or expose a game state.
 */
export async function startFriendMatch(room: FriendRoom): Promise<FriendRoom> {
  const role = await getMyFriendRoomRole(room)
  if (role !== 'host') throw new Error('対戦を開始できるのはホストだけです。')
  if (room.status === 'playing') return room
  if (!room.guestUid || !room.hostReady || !room.guestReady) {
    throw new Error('2人とも準備完了してから対戦を開始してください。')
  }
  try {
    const started = await firestore<FirestoreRoom>(
      `/${room.code}?updateMask.fieldPaths=status&currentDocument.updateTime=${encodeURIComponent(room.updateTime)}`,
      { method: 'PATCH', body: JSON.stringify({ fields: { status: value('playing') } }) },
    )
    return roomFromDocument(room.code, started)
  } catch (error) {
    if (error instanceof Error && /FAILED_PRECONDITION|PERMISSION_DENIED|ABORTED/.test(error.message)) {
      throw new Error('準備状態が変わった可能性があります。ルームの状態を確認してください。')
    }
    throw error
  }
}
