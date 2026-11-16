import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const tooltip = readFileSync(new URL('../src/components/BattleCardTooltip.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/components/BattleCardTooltip.css', import.meta.url), 'utf8')

test('battle field cards and amulets expose hover inspection', () => {
  assert.match(app, /setInspectedCard\(\{ kind: 'follower', instanceId: follower\.instanceId \}\)/)
  assert.match(app, /setInspectedCard\(\{ kind: 'amulet', instanceId: amulet\.instanceId \}\)/)
  assert.match(app, /<BattleCardTooltip card=\{inspectCard\}/)
})
test('hand cards expose hover and focus inspection', () => {
  assert.match(app, /data-hand-index=\{index\}/)
  assert.match(app, /onMouseEnter=\{\(\) => setInspectedCard\(\{ kind: 'hand', cardId \}\)\}/)
  assert.match(app, /onFocus=\{\(\) => setInspectedCard\(\{ kind: 'hand', cardId \}\)\}/)
})
test('inspection includes live stats, aura, shields, effects and abilities', () => {
  for (const term of ['follower.attack','follower.health','follower.aura','follower.shield.normal',
    'follower.shield.crystallize','follower.keywords','follower.skillUsed','follower.burstUsed',
    'amulet.turnsRemaining','card.description','card.elementalSkill','card.elementalBurst']) {
    assert.ok(tooltip.includes(term), `missing ${term}`)
  }
  assert.match(css, /pointer-events:none/)
})
