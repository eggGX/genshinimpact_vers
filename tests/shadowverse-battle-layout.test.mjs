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
  assert.match(app, /followerEmblems\(follower\.cardId, follower\.keywords\)/)
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

test('hand defaults to compact right dock and expands only after a hand click', () => {
  assert.match(app, /const \[handOpen, setHandOpen\] = useState\(false\)/)
  assert.match(app, /handOpen \? 'game--hand-open' : ''/)
  assert.match(app, /if \(!handOpen\) \{\s*setHandOpen\(true\)/)
  assert.match(css, /\.game--battle-fit:not\(\.game--hand-open\) \.hand-cards/)
  assert.match(css, /\.game--battle-fit\.game--hand-open > \.hand/)
})

test('blank battlefield dismisses expanded hand without intercepting interactive cards', () => {
  assert.match(app, /if \(handOpen && isBlank && target\.closest\('\.field'\)\)/)
  assert.match(app, /const isBlank = !target\.closest\(/)
  assert.match(app, /setHandOpen\(false\)/)
  assert.match(app, /setExpandedHandIndex\(null\)/)
  assert.match(app, /onPointerDown=\{event => startHandDrag\(event, index\)\}/)
})


test('compact hand is left of ability controls and both hand modes keep stats above screen bottom', () => {
  const override = css.split('/* Keep the entire hand (including attack/health) inside the viewport.')[1]
  assert.ok(override, 'Expected final layout override')
  assert.match(override, /not\(\.game--hand-open\) > \.hand/)
  assert.match(override, /right:clamp\(205px,13vw,255px\)/)
  assert.match(override, /bottom:14px/)
  assert.match(override, /game--hand-open > \.hand/)
  assert.match(override, /bottom:18px/)
  assert.match(override, /\.hand-card \.hand-card-stats/)
  assert.match(override, /margin-top:auto/)
  assert.match(override, /box-sizing:border-box/)
})


test('leaders and follower board share a centerline with larger leader portraits', () => {
  const refinements = css.split('/* Duel composition refinements:')[1]
  assert.ok(refinements, 'layout refinements are present')
  assert.match(refinements, /\.player \.leader-avatar \{/)
  assert.match(refinements, /width:clamp\(102px,7\.9vw,130px\)/)
  assert.match(refinements, /left:50%/)
  assert.match(refinements, /left:12%;\s*right:12%/)
})

test('crest details stay within the viewport, and expanded hand is fully opaque', () => {
  const refinements = css.split('/* Duel composition refinements:')[1]
  assert.ok(refinements)
  assert.match(refinements, /\.crest-tray \.crest-detail \{/)
  assert.match(refinements, /left:0;\s*right:auto/)
  assert.match(refinements, /max-height:min\(320px,55dvh\)/)
  assert.match(refinements, /\.game--hand-open \.hand-card--unplayable/)
  assert.match(refinements, /opacity:1/)
})


test('both follower rows shift closer to the centered duel area', () => {
  const latest = css.split('/* Pull both follower rows toward the same centerline.')[1]
  assert.ok(latest, 'center adjustment rules must exist')
  assert.match(latest, /\.game--battle-fit > \.field,/)
  assert.match(latest, /top:29%;\s*bottom:25%/)
  assert.match(latest, /left:12%;\s*right:12%/)
})


test('amulets have a distinctive artifact frame without changing follower portraits', () => {
  const styles = css.split('/* Amulets are framed artifacts rather than arched follower portraits:')[1]
  assert.ok(styles, 'artifact frame styles are present')
  assert.match(styles, /\.game--battle-fit \.amulet-card/)
  assert.match(styles, /border-radius:13px 13px 7px 7px/)
  assert.match(styles, /border-style:double/)
  assert.match(styles, /\.amulet-card::after/)
  assert.match(styles, /content:'◆'/)
  assert.match(app, /'field-card','amulet-card'/)
})
