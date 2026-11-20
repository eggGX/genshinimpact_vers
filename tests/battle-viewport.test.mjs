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
