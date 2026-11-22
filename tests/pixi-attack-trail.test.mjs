import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const overlay = read('src/pixi/PixiBattleOverlay.tsx')
const css = read('src/App.css')

test('attacking cards only lift slightly in place and do not fly across the board', () => {
  assert.match(css, /animation:battle-attack-lunge \.52s ease-out both/)
  assert.match(css, /55% \{transform:translateY\(-13px\) scale\(1\.065\)/)
  assert.doesNotMatch(css, /game--pixi-overlay\.game--animating/)
  assert.doesNotMatch(app, /pixiAttackCue/)
  assert.doesNotMatch(overlay, /spawnCardAttack|spawnAttackTrail|attack\?\.key/)
})

test('Pixi overlay still renders elemental hits and reactions, without blocking input', () => {
  assert.match(app, /<PixiBattleOverlay cue=\{/)
  assert.match(overlay, /drawReactionBurst\(/)
  assert.match(overlay, /reactionFromFrameLabel\(cue\.label\)/)
  assert.match(overlay, /pointerEvents: 'none'/)
  assert.match(css, /battle-target-impact/)
})
