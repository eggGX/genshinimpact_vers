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
  assert.match(transport, /setFriendRoomReady/)
  assert.match(transport, /updateMask.fieldPaths=\\$\\{field\\}/)
  assert.match(rules, /affectedKeys\\(\\)\\.hasOnly\\(\\['hostReady'\\]\\)/)
  assert.match(rules, /affectedKeys\\(\\)\\.hasOnly\\(\\['guestReady'\\]\\)/)
  assert.match(lobby, /このデッキで準備完了/)
  assert.match(lobby, /deckErrors\.length > 0/)
})
test('Firestore rules can be deployed along with Hosting', () => {
  const firebase = JSON.parse(read('firebase.json'))
  assert.equal(firebase.firestore.rules, 'firestore.rules')
})
test('lobby never claims online gameplay is available yet', () => {
  assert.match(lobby, /対戦アクションの同期はまだ有効化していません/)
})
