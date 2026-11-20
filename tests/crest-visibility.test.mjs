import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const crest = read('src/components/CrestIcons.tsx')
const server = read('server/src/index.ts')

test('both leaders see public crests in the battle interface', () => {
  assert.ok(app.includes('<CrestIcons crests={opponent.crests} ownerName={opponent.name} placement="below" />'))
  assert.ok(app.includes('<CrestIcons crests={currentPlayer.crests} ownerName={currentPlayer.name} placement="above" />'))
  assert.ok(server.includes('crests: player.crests ?? []'))
  assert.ok(app.includes('crests: p.crests ?? []'))
})

test('crest icons show artwork or elemental fallback, turns and details', () => {
  for (const item of ['getCardArtwork(id)', '<ElementIcon element={element}', 'crest-turn-count', 'aria-expanded=', 'onClick={() => setSelected', 'active.card?.description', 'active.crest.usedElements']) {
    assert.ok(crest.includes(item), 'Missing feature: ' + item)
  }
})


test('five crest sockets remain visible before any crest is gained', () => {
  const css = read('src/components/CrestIcons.css')
  assert.doesNotMatch(crest, /if \(!crests\.length\) return null/)
  assert.match(crest, /Math\.max\(5, entries\.length\)/)
  assert.match(crest, /className="crest-empty-slot"/)
  assert.match(crest, /const entry = entries\[index\]/)
  assert.match(crest, /if \(!entry\) return/)
  assert.match(css, /\.crest-empty-slot/)
  assert.match(css, /pointer-events:none/)
})
