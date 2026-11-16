/**
 * Trusted prototype for friend matches. Run only on a trusted Node server.
 * Client SDKs cannot read /onlineMatches under the Firestore catch-all deny rule.
 * Do not deploy until a server runtime is configured explicitly.
 */
import { createServer } from 'node:http'
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { createInitialGameState, confirmMulligan } from '../../src/game/engine.ts'
import { validateDeck, type DeckDefinition } from '../../src/data/deckRules.ts'
import type { GameState } from '../../src/game/types.ts'

if (!getApps().length) initializeApp({ credential: applicationDefault() })
const db = getFirestore()
const auth = getAuth()
const port = Number(process.env.PORT || 8080)
const origin = process.env.ALLOWED_ORIGIN || 'https://genshincard-25028.web.app'
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
if (!projectId) console.warn('Using Firebase Admin default project configuration')
const codePattern = /^[A-HJ-NP-Z2-9]{8}$/

type Room = {
  hostUid: string
  guestUid: string
  hostReady: boolean
  guestReady: boolean
  status: string
}
type Stored = { state: GameState; revision: number }

function json(res: import('node:http').ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  })
  res.end(JSON.stringify(data))
}
function readJson(req: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', part => {
      raw += String(part)
      if (raw.length > 8192) { reject(new Error('リクエストが大きすぎます')); req.destroy() }
    })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) as unknown : null) }
      catch { reject(new Error('JSONを読み取れません')) }
    })
    req.on('error', reject)
  })
}
function deckFromData(data: FirebaseFirestore.DocumentData | undefined): DeckDefinition {
  if (!data) throw new Error('デッキが提出されていません')
  const deck = { elements: data.elements, cards: data.cards } as DeckDefinition
  if (validateDeck(deck).length) throw new Error('不正なデッキです: ' + validateDeck(deck)[0])
  return deck
}
function getSeat(room: Room, uid: string): 0 | 1 {
  if (room.hostUid === uid) return 0
  if (room.guestUid && room.guestUid === uid) return 1
  throw new Error('このルームの参加者ではありません')
}
/**
 * The entire internal game state is ONLY in the admin-readable match document.
 * Never send this state to either client. Never reveal shuffled deck ordering.
 */
function projectState(stored: Stored, seat: 0 | 1) {
  const state = stored.state
  return {
    revision: stored.revision,
    seat,
    turn: state.turn,
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    winnerId: state.winnerId,
    players: state.players.map((player, index) => ({
      id: player.id,
      name: player.name,
      leaderHealth: player.leaderHealth,
      leaderMaxHealth: player.leaderMaxHealth,
      pp: player.pp,
      maxPp: player.maxPp,
      energy: player.energy,
      handCount: player.hand.length,
      deckCount: player.deck.length,
      ...(index === seat ? { hand: player.hand } : {}),
      field: player.field,
      graveyard: player.graveyard,
      amulets: player.amulets ?? [],
      crests: player.crests ?? [],
      leaderAura: player.leaderAura ?? [],
      leaderShield: player.leaderShield ?? { normal: 0, crystallize: 0 },
    })),
  }
}
function getMatchRef(code: string) { return db.collection('onlineMatches').doc(code) }

async function ensureMatch(code: string, uid: string): Promise<{ stored: Stored; seat: 0 | 1 }> {
  const roomRef = db.collection('friendRooms').doc(code)
  const hostRef = roomRef.collection('privateDecks').doc('host')
  const guestRef = roomRef.collection('privateDecks').doc('guest')
  const matchRef = getMatchRef(code)
  return db.runTransaction(async tx => {
    // Firestore transaction reads precede all writes.
    const [roomSnap, matchSnap, hostSnap, guestSnap] = await Promise.all([
      tx.get(roomRef), tx.get(matchRef), tx.get(hostRef), tx.get(guestRef),
    ])
    if (!roomSnap.exists) throw new Error('ルームが見つかりません')
    const room = roomSnap.data() as Room
    const seat = getSeat(room, uid)
    if (room.status !== 'playing' || !room.hostReady || !room.guestReady) {
      throw new Error('対戦開始前です')
    }
    if (matchSnap.exists) return { stored: matchSnap.data() as Stored, seat }
    if (hostSnap.data()?.ownerUid !== room.hostUid || guestSnap.data()?.ownerUid !== room.guestUid) {
      throw new Error('デッキ所有者が一致しません')
    }
    const decks: [DeckDefinition, DeckDefinition] = [
      deckFromData(hostSnap.data()), deckFromData(guestSnap.data()),
    ]
    const state = createInitialGameState(decks)
    const stored: Stored = { state, revision: 0 }
    tx.create(matchRef, stored)
    return { stored, seat }
  })
}
async function submitMulligan(
  code: string, uid: string, indices: unknown, revision: unknown,
): Promise<{ stored: Stored; seat: 0 | 1 }> {
  if (!Array.isArray(indices) || indices.length > 4 ||
      !indices.every(i => Number.isInteger(i) && i >= 0 && i < 4) ||
      new Set(indices).size !== indices.length ||
      !Number.isInteger(revision) || (revision as number) < 0) {
    throw new Error('マリガンの指定が不正です')
  }
  const roomRef = db.collection('friendRooms').doc(code)
  const matchRef = getMatchRef(code)
  return db.runTransaction(async tx => {
    const [roomSnap, matchSnap] = await Promise.all([tx.get(roomRef), tx.get(matchRef)])
    if (!roomSnap.exists || !matchSnap.exists) throw new Error('対戦が見つかりません')
    const room = roomSnap.data() as Room
    const seat = getSeat(room, uid)
    const stored = matchSnap.data() as Stored
    if (stored.revision !== revision) throw new Error('対戦状態が更新されています。再読み込みしてください')
    if (stored.state.phase !== 'mulligan' || stored.state.currentPlayerId !== `player${seat + 1}`) {
      throw new Error('今はあなたのマリガン順ではありません')
    }
    const next = confirmMulligan(stored.state, indices as number[])
    if (next === stored.state) throw new Error('マリガンできません')
    const result: Stored = { state: next, revision: stored.revision + 1 }
    tx.update(matchRef, result)
    return { stored: result, seat }
  })
}

createServer(async (req, res) => {
  const requestOrigin = req.headers.origin
  if (requestOrigin && requestOrigin !== origin) {
    json(res, 403, { error: '許可されていない接続元です' }); return
  }
  if (req.method === 'OPTIONS') { json(res, 204, null); return }
  const pathname = new URL(req.url || '/', 'http://localhost').pathname
  if (req.method === 'GET' && pathname === '/health') {
    json(res, 200, { ok: true }); return
  }
  const match = /^\/rooms\/([A-HJ-NP-Z2-9]{8})\/(state|mulligan)$/.exec(pathname)
  if (!match || !codePattern.test(match[1])) {
    json(res, 404, { error: 'エンドポイントが見つかりません' }); return
  }
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)
  if (!bearer) { json(res, 401, { error: '認証が必要です' }); return }
  try {
    const user = await auth.verifyIdToken(bearer[1], true)
    let output: { stored: Stored; seat: 0 | 1 }
    if (req.method === 'GET' && match[2] === 'state') {
      output = await ensureMatch(match[1], user.uid)
    } else if (req.method === 'POST' && match[2] === 'mulligan') {
      const data = await readJson(req)
      if (!data || typeof data !== 'object') throw new Error('不正なリクエスト')
      const payload = data as { indices?: unknown; revision?: unknown }
      output = await submitMulligan(match[1], user.uid, payload.indices, payload.revision)
    } else { json(res, 405, { error: '許可されていない操作です' }); return }
    json(res, 200, projectState(output.stored, output.seat))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'サーバーエラー'
    console.error('match request failed:', message)
    json(res, /認証|参加者/.test(message) ? 403 : /見つかりません/.test(message) ? 404 : 400,
      { error: message })
  }
}).listen(port, () => console.log(`Trusted match server listening on :${port}`))
