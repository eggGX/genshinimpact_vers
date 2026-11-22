import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const main = read('src/main.tsx')

test('PixiJS uses a separate chunk and only mounts in the battle scene', () => {
  assert.match(app, /const PixiBattleOverlay = lazy\(\(\) => import\('\.\/pixi\/PixiBattleOverlay'\)/)
  assert.doesNotMatch(app, /^import \{ PixiBattleOverlay \} from /m)
  assert.match(app, /<Suspense fallback=\{null\}>\s*<PixiBattleOverlay cue=/)
  assert.match(app, /summoningKeys=\{enteringPieces\}/)
  assert.match(app, /<PixiBattleOverlay cue=/)
})

test('card library and deck management code is lazy loaded from the setup screen', () => {
  for (const [component, path] of [
    ['CardLibrary', 'CardLibrary'],
    ['DeckBuilder', 'DeckBuilder'],
    ['DeckManager', 'DeckManager'],
    ['FriendRoomLobby', 'FriendRoomLobby'],
  ]) {
    assert.ok(app.includes(`const ${component} = lazy(() => import('./components/${path}')`))
    assert.ok(!app.includes(`import { ${component} } from './components/${path}'`))
  }
  assert.match(app, /<Suspense fallback=\{<div role="status">フレンド対戦を読み込み中/)
  assert.match(app, /renderOnlineBattle=\{\(match, pending, onAction, onMulligan, onLeave\) => <App online=/)
  assert.match(app, /style=\{\{ display: editingPlayer !== null \? 'none' : undefined \}\}/)
})

test('the existing independent Pixi preview remains lazy loaded', () => {
  assert.match(main, /const PixiPreview = lazy\(async \(\) =>/)
  assert.match(main, /import\('\.\/pixi\/PixiPreview'\)/)
})
