import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const lobby = read('src/components/FriendRoomLobby.tsx')
const transport = read('src/online/firebaseRooms.ts')
const rules = read('firestore.rules')

test('friend rooms do not replace local match entry', () => {
  assert.match(app, /この2つのデッキでローカル対戦開始/)
  assert.match(app, /<FriendRoomLobby onBack=/)
  assert.match(app, /フレンド対戦（ルーム作成・参加）/)
})
test('room lobby has create, join, and polling', () => {
  assert.match(lobby, /createFriendRoom/)
  assert.match(lobby, /joinFriendRoom\(codeInput\)/)
  assert.match(lobby, /window\.setInterval/)
})
test('Firestore room join uses optimistic precondition', () => {
  assert.match(transport, /currentDocument\.updateTime=/)
  assert.match(transport, /updateMask\.fieldPaths=guestUid/)
  assert.match(transport, /getRandomValues/)
})
test('Firestore rule forbids anonymous reads and any game state writes', () => {
  assert.match(rules, /allow get: if request\.auth != null/)
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['guestUid'\]\)/)
  assert.match(rules, /allow read, write: if false/)
})
test('each friend can update only their own readiness flag', () => {
  assert.ok(transport.includes('setFriendRoomReady'))
  assert.ok(transport.includes('updateMask.fieldPaths=${field}'))
  assert.ok(rules.includes("affectedKeys().hasOnly(['hostReady'])"))
  assert.ok(rules.includes("affectedKeys().hasOnly(['guestReady'])"))
  assert.ok(lobby.includes('このデッキで準備完了'))
  assert.ok(lobby.includes('deckErrors.length > 0'))
})
test('Firestore rules can be deployed along with Hosting', () => {
  const firebase = JSON.parse(read('firebase.json'))
  assert.equal(firebase.firestore.rules, 'firestore.rules')
})
test('online session explicitly distinguishes match start from live card play', () => {
  assert.match(lobby, /既存のローカル対戦UIとの統合は開発中です/)
  assert.match(lobby, /対戦セッションを開始しました/)
})

test('online deck editor preserves mounted lobby and room state', () => {
  assert.match(app, /if \(showFriendLobby && !matchStarted\) \{/)
  assert.match(app, /display: editingPlayer !== null \? 'none' : undefined/)
  assert.match(app, /<FriendRoomLobby onBack=/)
  assert.match(app, /フレンド対戦：自分のデッキ/)
  assert.match(app, /onBack=\{\(\) => setEditingPlayer\(null\)\}/)
})

test('only a ready host can start the online match', () => {
  assert.match(transport, /export async function startFriendMatch/)
  assert.match(transport, /if \(role !== 'host'\)/)
  assert.match(transport, /!room\.hostReady \|\| !room\.guestReady/)
  assert.match(transport, /currentDocument\.updateTime=/)
  assert.ok(rules.includes("affectedKeys().hasOnly(['status'])"))
  assert.ok(rules.includes("request.resource.data.status == 'playing'"))
  assert.ok(rules.includes("resource.data.hostReady == true"))
  assert.ok(rules.includes("resource.data.guestReady == true"))
  assert.match(lobby, /room\.status === 'playing'/)
  assert.match(lobby, /role === 'host'/)
  assert.match(lobby, /ホストの開始操作を待っています/)
})
test('readiness is frozen when the room is playing', () => {
  assert.match(transport, /room\.status !== 'waiting'/)
  assert.match(rules, /resource\.data\.status == 'waiting'/)
})

test('a valid deck is stored privately before ready is set', () => {
  assert.match(transport, /export async function uploadPrivateDeck/)
  assert.match(transport, /validateDeck\(deck\)/)
  assert.match(transport, /\/privateDecks\/\$\{role\}/)
  assert.match(transport, /await uploadPrivateDeck\(room, deck\)/)
  assert.match(lobby, /setFriendRoomReady\(room, ready, ready \? deck : undefined\)/)
})
test('Firestore restricts private deck access and freezes submitted decks when ready', () => {
  assert.match(rules, /match \/privateDecks\/\{seat\}/)
  assert.match(rules, /ownerOfSeat\(\) == request\.auth\.uid/)
  assert.match(rules, /allow list: if false/)
  assert.match(rules, /roomAllowsDeckWrite\(\)/)
  assert.match(rules, /request\.resource\.data\.cards\.size\(\) == 40/)
  assert.match(rules, /privateDecks\/host\)/)
  assert.match(rules, /privateDecks\/guest\)/)
  assert.match(rules, /allow delete: if false/)
})
