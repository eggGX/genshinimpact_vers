import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const presentation = read('src/game/presentation.ts')
const elemental = read('src/game/elemental.ts')
const app = read('src/App.tsx')
const overlay = read('src/pixi/PixiBattleOverlay.tsx')
const reactions = read('src/pixi/reactionFx.ts')

test('follower and leader reaction cues survive presentation compaction and carry target IDs', () => {
  assert.match(presentation, /effectTarget\?: string/)
  assert.match(presentation, /frame\.label\.includes\('元素反応：'\)/)
  assert.match(elemental, /reactionLabels\[reaction\]}`, affectedInstanceId\)/)
  assert.match(elemental, /reactionLabels\[hit\.reaction\]}`, target\.id\)/)
})

test('Pixi reaction overlay renders at a public card or leader target even without HP damage', () => {
  assert.match(app, /data-pixi-id=\{follower\.instanceId\}/)
  assert.match(app, /data-pixi-id=\{opponent\.id\}/)
  assert.match(app, /data-pixi-id=\{currentPlayer\.id\}/)
  assert.match(overlay, /cue\.effectTarget/)
  assert.match(overlay, /if \(reaction\)/)
  assert.match(overlay, /reactionTitle = reaction \? new Text/)
  assert.match(overlay, /previousImpact\.current/)
  assert.match(overlay, /querySelector<HTMLElement>\('\.field'\)/)
})

test('every implemented reaction has a unique named PixiJS burst', () => {
  for (const reaction of ['蒸発', '溶解', '感電', '過負荷', '凍結', '超電導',
    '燃焼', '激化', '拡散', '結晶', '開花', '烈開花', '超開花']) {
    assert.ok(reactions.includes(`'${reaction}':`), `missing reaction: ${reaction}`)
  }
})
