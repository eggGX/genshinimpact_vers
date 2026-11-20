import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const css = read('src/App.css')

test('desktop duel uses the viewport instead of fixed-height panels', () => {
  assert.match(css, /Shadowverse-inspired full-bleed duel/)
  assert.match(css, /\.game--battle-fit,\s*\.game--battle-fit:fullscreen/)
  assert.match(css, /\.game--battle-fit > \.field,[\s\S]*?position:absolute/)
  assert.match(css, /\.game--battle-fit > \.hand,[\s\S]*?position:absolute/)
  assert.match(css, /\.game--battle-fit > \.player\.opponent \{top:5\.5%;\}/)
  assert.match(css, /\.game--battle-fit \.player\.self \.end-turn/)
})

test('field followers show portraits stats keywords and auras instead of printed skill controls', () => {
  assert.match(app, /title=\{card\?\.name \?\? '不明なカード'\}/)
  assert.match(app, /className="follower-stats"/)
  assert.match(app, /followerEmblems\(follower\)/)
  assert.match(app, /className="follower-aura-icons"/)
  assert.match(css, /\.game--battle-fit \.field-card \.battle-field-card-name/)
  assert.match(css, /\.game--battle-fit \.field-card \.card-artwork/)
  assert.match(css, /\.game--battle-fit \.field-card>small/)
  assert.match(app, /battle-ability-rail-button--burst/)
  assert.match(app, /handleUseAbility\(abilityFocus, 'skill'\)/)
  assert.match(app, /handleUseAbility\(abilityFocus, 'burst'\)/)
})

test('first hand click expands and next click plays; drag-play handler is retained', () => {
  assert.match(app, /const \[expandedHandIndex, setExpandedHandIndex\]/)
  assert.match(app, /if \(expandedHandIndex !== index\)/)
  assert.match(app, /setExpandedHandIndex\(index\)/)
  assert.match(app, /handlePlayCard\(index\)/)
  assert.match(app, /onPointerDown=\{event => startHandDrag\(event, index\)\}/)
  assert.match(app, /onPointerUp=\{event => finishHandDrag\(event\)\}/)
  assert.match(css, /\.game--battle-fit \.hand-card\.hand-card--expanded/)
})

test('viewport layout falls back on narrower displays', () => {
  assert.match(css, /@media \(min-width:900px\) and \(min-height:640px\)/)
  assert.match(css, /@media\(max-width:899px\), \(max-height:639px\)/)
})
