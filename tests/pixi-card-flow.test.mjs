import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const fx = read('src/pixi/PixiCardFlowOverlay.tsx')
const css = read('src/App.css')

test('existing CSS card draw and mulligan exchange are preserved', () => {
  assert.match(css, /@keyframes battle-draw-travel/)
  assert.match(css, /@keyframes battle-draw-flip/)
  assert.match(css, /@keyframes mulligan-card-out/)
  assert.match(css, /@keyframes mulligan-card-in/)
  assert.match(app, /drawFlights\.map\(flight=>/)
  assert.match(app, /<MulliganSwapCards reveal=\{mulliganReveal\}/)
})

test('Pixi HUD accents are optional and do not change card or input content', () => {
  assert.match(app, /has\('pixi-overlay'\) && \(drawFlights\.length > 0/)
  assert.match(app, /<PixiCardFlowOverlay drawActive=\{drawFlights\.length > 0\} mulliganActive=\{Boolean\(mulliganReveal\)\}/)
  assert.match(app, /<PixiCardFlowOverlay drawActive=\{false\} mulliganActive/)
  assert.match(fx, /pointerEvents: 'none'/)
  assert.match(fx, /aria-hidden="true"/)
  assert.match(fx, /prefers-reduced-motion: reduce/)
})

test('Pixi HUD reads card positions only, not concealed opponent hands', () => {
  assert.match(fx, /\.battle-draw-layer \.battle-draw-flight/)
  assert.match(fx, /\.mulligan-result-cards \.mulligan-swap--in/)
  assert.match(fx, /getBoundingClientRect\(\)/)
  assert.doesNotMatch(fx, /cardId|opponent\.hand|currentPlayer\.hand/)
  assert.match(fx, /app\.ticker\.remove\(tick\)/)
  assert.match(fx, /app\.destroy\(/)
})
