import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const css = read('src/App.css')

test('local and online share a browser fullscreen control on the battle screen', () => {
  assert.match(app, /ref=\{battleScreenRef\} className=\{\['game','game--battle','game--battle-fit'/)
  assert.match(app, /document\.fullscreenElement === battleScreenRef\.current/)
  assert.match(app, /battleScreenRef\.current\.requestFullscreen\(\)/)
  assert.match(app, /document\.exitFullscreen\(\)/)
  assert.match(app, /document\.addEventListener\('fullscreenchange', sync\)/)
  assert.match(app, /aria-pressed=\{battleFullscreen\}/)
})

test('desktop battle card, leader, and hand sizes respond to viewport height', () => {
  assert.match(css, /\.game--battle-fit:fullscreen/)
  assert.match(css, /@media \(min-width:761px\)/)
  assert.match(css, /\.game--battle-fit \.field-card:has\(\.card-artwork\)/)
  assert.match(css, /\.game--battle-fit \.hand-card:has\(\.card-artwork\)/)
  assert.match(css, /@media \(min-width:761px\) and \(max-height:740px\)/)
  assert.match(css, /overflow-y:auto/)
})

test('fullscreen does not change card targeting or the engine attack actions', () => {
  assert.match(app, /onPointerDown=\{!isOpponent \? event => startAttackDrag/)
  assert.match(app, /onPointerDown=\{event => startHandDrag\(event, index\)\}/)
  assert.match(app, /onlineSend\(\{type:'attackFollower',attackerId,targetId\}\)/)
  assert.match(app, /attackFollower\(previous, attackerId, targetId\)/)
})

test('crests and new followers cannot increase desktop battlefield height', () => {
  assert.match(css, /\.game--battle-fit \{\s*height:100dvh;/)
  assert.match(css, /\.game--battle-fit \.player-effects \{[\s\S]*?flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;/)
  assert.match(css, /\.game--battle-fit \.crest-tray-icons \{flex-wrap:nowrap;/)
  assert.match(css, /\.game--battle-fit \.field \{\s*display:grid;[\s\S]*?grid-template-rows:minmax\(0,1fr\) 16px minmax\(0,1fr\)/)
  assert.match(css, /\.game--battle-fit \.card-slot \{[\s\S]*?min-height:0;[\s\S]*?height:100%/)
  assert.match(css, /\.game--battle-fit \.follower-wrapper>div:not\(\.follower-aura-icons\)/)
})

test('online battle history does not create extra height when actions accumulate', () => {
  assert.match(css, /\.game--battle-fit:has\(> \.online-latest-action\)/)
  assert.match(css, /\.game--battle-fit > \.online-action-history\[open\] ol/)
  assert.match(css, /max-height:160px;overflow-y:auto/)
})
