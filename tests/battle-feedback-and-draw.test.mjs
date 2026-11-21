import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const css = read('src/App.css')
const lobby = read('src/components/FriendRoomLobby.tsx')
const lobbyCss = read('src/components/FriendRoomLobby.css')

test('local draws reveal cards for both player seats; online opponent stays private', () => {
  assert.match(app, /const isSelf=!online \|\| player\.id===selfId/)
  assert.match(app, /cardId:isSelf&&getCard\(cards\[index\]\)\?cards\[index\]:undefined/)
  assert.match(css, /@keyframes battle-draw-flip/)
})

test('opponent and self leader show total shield opposite their HP only when shielded', () => {
  assert.equal((app.match(/className="leader-shield-badge"/g) ?? []).length, 2)
  assert.match(app, /opponent\.leaderShield\?\.crystallize/)
  assert.match(app, /currentPlayer\.leaderShield\?\.crystallize/)
  assert.match(css, /\.game--battle \.leader-shield-badge \{[\s\S]*?left:-27px/)
  assert.match(css, /\.game--battle \.leader-shield-badge strong/)
})

test('pending fanfare, spell and ability target displays its card without blocking clicks', () => {
  assert.match(app, /const targetingCardId = selectedHandIndex !== null/)
  assert.match(app, /selectedAbility \? currentPlayer\.field\.find/)
  assert.match(app, /className="battle-targeting-card"/)
  assert.match(app, /<CardArtwork cardId=\{targetingCard\.id\}/)
  assert.match(css, /\.game--battle-fit \.battle-targeting-card \{[\s\S]*?pointer-events:none/)
})

test('copy feedback reports success only after clipboard promise resolves', () => {
  assert.match(lobby, /await navigator\.clipboard\.writeText\(code\)/)
  assert.match(lobby, /setCodeCopied\(true\)/)
  assert.match(lobby, /role="status" aria-live="polite">コピーしました/)
  assert.match(lobby, /setCodeCopied\(false\), 2200/)
  assert.match(lobbyCss, /\.friend-copy-confirmation/)
})
