import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom', logLevel: 'error',
})
after(async () => { await vite.close() })
const { parseSavedDecks, copyDeck } = await vite.ssrLoadModule('/src/data/savedDecks.ts')
const { createStarterDeck, validateDeck } = await vite.ssrLoadModule('/src/data/deckRules.ts')

const asSource = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('multiple named decks load and preserve all forty cards', () => {
  const deck1 = createStarterDeck(['pyro', 'hydro', 'cryo'])
  const deck2 = createStarterDeck(['electro', 'anemo', 'dendro'])
  assert.deepEqual(validateDeck(deck1), [])
  assert.deepEqual(validateDeck(deck2), [])
  const stored = [{ id: 'one', name: '炎水', deck: deck1 }, { id: 'two', name: '雷風', deck: deck2 }]
  const restored = parseSavedDecks(JSON.stringify(stored))
  assert.equal(restored.length, 2)
  assert.deepEqual(restored.map(x => x.name), ['炎水', '雷風'])
  assert.deepEqual(restored[1].deck, deck2)
})

test('editing a match copy never changes the saved deck', () => {
  const original = createStarterDeck(['pyro','hydro','cryo'])
  const saved = [{ id:'main', name:'登録済み', deck: original }]
  const restored = parseSavedDecks(JSON.stringify(saved))
  const selectedForMatch = copyDeck(restored[0].deck)
  selectedForMatch.cards.pop()
  selectedForMatch.elements.pop()
  assert.equal(restored[0].deck.cards.length, 40)
  assert.equal(restored[0].deck.elements.length, 3)
})

test('corrupt, duplicate and invalid decks are not loaded', () => {
  const valid = createStarterDeck(['pyro','hydro','cryo'])
  const entries = [
    { id:'ok', name:'使用可能', deck:valid },
    { id:'ok', name:'重複', deck:valid },
    { id:'missing', name:'不完全', deck:{ ...valid, cards:[] } },
    { id:'bad', name:'壊れたカード', deck:{elements:['invalid'],cards:valid.cards} },
    { id:'blank', name:'   ', deck:valid },
    null,
  ]
  const parsed = parseSavedDecks(JSON.stringify(entries))
  assert.deepEqual(parsed.map(x => x.id), ['ok'])
  assert.deepEqual(parseSavedDecks('{'), [])
  assert.deepEqual(parseSavedDecks(null), [])
})

test('local and online setup both expose saved deck selection', () => {
  const app = asSource('src/App.tsx')
  const lobby = asSource('src/components/FriendRoomLobby.tsx')
  assert.match(app, /デッキ管理/)
  assert.match(app, /<SavedDeckPicker savedDecks=\{savedDecks\}/)
  assert.match(lobby, /<SavedDeckPicker savedDecks=\{savedDecks\}/)
  assert.match(app, /persistSavedDecks\(savedDecks\)/)
  assert.match(lobby, /disabled=\{pending \|\| Boolean\(myReady\)\}/)
})
