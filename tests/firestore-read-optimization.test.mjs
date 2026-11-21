import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const server = source('server/src/index.ts')
const lobby = source('src/components/FriendRoomLobby.tsx')
const rules = source('firestore.rules')

const ensure = server.split('async function ensureMatch(')[1]?.split('async function submitMulligan(')[0] ?? ''
const action = server.split('async function submitAction(')[1]?.split('createServer(async')[0] ?? ''

test('match polling reads only the match document for initialized games', () => {
  assert.match(ensure, /const matchSnap = await tx\.get\(matchRef\)/)
  const exists = ensure.split('if (matchSnap.exists) {')[1]?.split('// Initialization is the only path')[0] ?? ''
  assert.ok(exists.includes('getSeat('), 'every state request must authorize the UID')
  assert.ok(exists.includes('stored.hostUid && stored.guestUid'), 'seat IDs must come from stored match')
  assert.doesNotMatch(exists, /tx\.get\(hostRef\)|tx\.get\(guestRef\)/, 'never reload decks for a match')
  assert.match(exists, /tx\.get\(roomRef\)/, 'legacy matches must still check room membership')
})

test('initial game creation validates room, deck owners and deck contents', () => {
  const init = ensure.split('// Initialization is the only path')[1] ?? ''
  assert.match(init, /tx\.get\(roomRef\)/)
  assert.match(init, /tx\.get\(hostRef\)/)
  assert.match(init, /tx\.get\(guestRef\)/)
  assert.match(init, /getSeat\(room, uid\)/)
  assert.match(init, /room\.status !== 'playing'/)
  assert.match(init, /room\.hostReady/)
  assert.match(init, /room\.guestReady/)
  assert.match(init, /ownerUid !== room\.hostUid/)
  assert.match(init, /ownerUid !== room\.guestUid/)
  assert.match(init, /deckFromData\(hostSnap\.data\(\)\)/)
  assert.match(init, /deckFromData\(guestSnap\.data\(\)\)/)
  assert.match(init, /tx\.create\(matchRef, stored\)/)
  assert.match(init, /hostUid: room\.hostUid, guestUid: room\.guestUid/)
})

test('HTTP requests still verify Firebase tokens and mask private state', () => {
  assert.match(server, /auth\.verifyIdToken\(bearer\[1\], true\)/)
  assert.match(server, /projectState\(output\.stored, output\.seat\)/)
  assert.match(server, /\.\.\.\(index === seat \? \{ hand: player\.hand \} : \{\}\)/)
  const projection = server.split('function projectState(')[1]?.split('function projectFrameState(')[0] ?? ''
  assert.doesNotMatch(projection, /hostUid|guestUid|privateDecks/)
})

test('game commands retain transactional room and revision checks', () => {
  assert.match(action, /tx\.get\(roomRef\)/)
  assert.match(action, /tx\.get\(matchRef\)/)
  assert.match(action, /getSeat\(room, uid\)/)
  assert.match(action, /room\.status !== 'playing'/)
  assert.match(action, /stored\.revision !== revision/)
  assert.match(action, /stored\.state\.currentPlayerId !== `player\$\{seat \+ 1\}`/)
  assert.match(action, /tx\.update\(matchRef, result\)/)
})

test('room polling stops in playing mode while match HTTP polling continues', () => {
  assert.match(lobby, /if \(!room \|\| room\.status === 'playing'\) return/)
  assert.match(lobby, /\[room\?\.code, room\?\.status\]/)
  assert.match(lobby, /if \(room\?\.status !== 'playing' \|\| !isMatchServerConfigured\(\)\) return/)
  assert.match(lobby, /fetchOnlineMatch\(room\.code\)/)
  assert.match(lobby, /window\.setInterval\(\(\) => \{ void refresh\(\) \}, 1500\)/)
  assert.match(lobby, /if \(inFlight\) return/)
  assert.match(lobby, /previous\.revision >= latest\.revision/)
  assert.match(rules, /resource\.data\.status == 'waiting'/)
  assert.match(rules, /request\.resource\.data\.status == 'playing'/)
})
