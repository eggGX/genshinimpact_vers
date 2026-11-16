import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const backend = read('server/src/index.ts')
const frontend = read('src/online/matchClient.ts')
const lobby = read('src/components/FriendRoomLobby.tsx')
const rules = read('firestore.rules')
const serverManifest = JSON.parse(read('server/package.json'))

test('trusted match server validates caller Firebase ID token and room membership', () => {
  assert.match(backend, /auth\.verifyIdToken\(bearer\[1\], true\)/)
  assert.match(backend, /getSeat\(room, uid\)/)
  assert.match(backend, /room\.status !== 'playing'/)
})
test('game state and shuffling happen on server, inside transaction', () => {
  assert.match(backend, /tx\.get\(matchRef\)/)
  assert.match(backend, /createInitialGameState\(decks\)/)
  assert.match(backend, /tx\.create\(matchRef, stored\)/)
  assert.match(backend, /db\.collection\('onlineMatches'\)/)
})
test('client projection omits opponent hand and all deck orders', () => {
  assert.match(backend, /deckCount: player\.deck\.length/)
  assert.match(backend, /handCount: player\.hand\.length/)
  assert.match(backend, /index === seat \? \{ hand: player\.hand \} : \{\}/)
  assert.doesNotMatch(backend.slice(backend.indexOf('function projectState'),backend.indexOf('function getMatchRef')), /deck: player\.deck/)
  assert.match(rules, /allow read, write: if false/)
})
test('mulligan is gated by seat, current revision and transaction', () => {
  assert.match(backend, /stored\.revision !== revision/)
  assert.match(backend, /stored\.state\.currentPlayerId !==/)
  assert.match(backend, /confirmMulligan\(stored\.state, indices as number\[\]\)/)
  assert.match(backend, /tx\.update\(matchRef, result\)/)
})
test('browser uses optional backend address and never uploads match state to Firestore', () => {
  assert.match(frontend, /VITE_MATCH_SERVER_URL/)
  assert.match(frontend, /Authorization: `Bearer \$\{token\}`/)
  assert.match(lobby, /isMatchServerConfigured\(\)/)
  assert.match(lobby, /submitOnlineMulligan/)
  assert.match(lobby, /手札・山札・マリガン・カード操作/)
})
test('match server has isolated dependencies and admin SDK', () => {
  assert.ok(serverManifest.dependencies['firebase-admin'])
  assert.ok(serverManifest.dependencies.tsx)
})
