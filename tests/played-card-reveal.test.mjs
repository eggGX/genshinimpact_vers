import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const style = read('src/App.css')
const recorded = read('server/src/onlinePresentation.ts')
const projected = read('server/src/index.ts')
const client = read('src/online/matchClient.ts')

test('only the actual played card becomes public in online presentation events', () => {
  assert.match(recorded, /action\.type === 'play' \? actor\?\.hand\[action\.handIndex\]/)
  assert.match(recorded, /\.\.\.\(playedCardId \? \{ playedCardId \} : \{\}\)/)
  assert.match(projected, /event\.playedCardId \? \{ playedCardId: event\.playedCardId \}/)
  assert.match(client, /playedCardId\?: string/)
  assert.match(projected, /\.\.\.\(index === seat \? \{ hand: player\.hand \} : \{\}\)/)
})

test('online replays queued actions with their own played card metadata', () => {
  assert.match(app, /nextEvent\.playedCardId/)
  assert.match(app, /first\.playedCardId/)
  assert.match(app, /nextEvent\.actorId/)
  assert.match(app, /first\.actorId/)
  assert.match(app, /playedCardNotice\.actorId !== online\.match\.players\[online\.match\.seat\]\.id/)
})

test('local card plays present the card in every supported play path', () => {
  assert.match(app, /\x60\$\{card\.name\} をプレイ\x60, card\.id/)
  assert.match(app, /currentPlayer\.hand\[index\]\)/)
  assert.match(app, /currentPlayer\.hand\[selectedHandIndex\]\)/)
  assert.match(app, /playedCardId\?: string/)
})

test('reveal is short lived and does not block battle controls', () => {
  assert.match(app, /setPlayedCardNotice\(null\), 2800/)
  assert.match(style, /\.opponent-card-reveal\s*\{/)
  assert.match(style, /pointer-events:none/)
  assert.match(style, /@media\(max-width:700px\)/)
})
