import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const library = read('src/components/CardLibrary.tsx')
const art = read('src/components/CardArtwork.tsx')
const css = read('src/components/CardLibrary.css')

test('catalogue initially mounts a limited number of cards and loads more near the viewport', () => {
  assert.match(library, /const INITIAL_CARDS = 32/)
  assert.match(library, /const MORE_CARDS = 24/)
  assert.match(library, /cards\.slice\(0, count\)\.map/)
  assert.match(library, /new IntersectionObserver\(/)
  assert.match(library, /rootMargin: '600px 0px'/)
  assert.match(library, /さらに表示/)
})

test('catalogue filters reset incremental grid but detail navigation remains over all matching cards', () => {
  assert.match(library, /useMemo\(\(\) => filterCards\(ALL_CARDS/)
  assert.match(library, /const selectedIndex = visible\.findIndex/)
  assert.match(library, /const neighbor = visible\[selectedIndex \+ offset\]/)
  assert.match(library, /<LibraryGrid key=\{/)
  assert.match(library, /cards=\{visible\} selectedId=\{selectedId\}/)
})

test('card images decode asynchronously and offscreen catalogue entries avoid rendering work', () => {
  assert.match(art, /loading=\{priority \? ["']eager["'] : ["']lazy["']\}/)
  assert.match(art, /decoding=\{priority \? ["']sync["'] : ["']async["']\}/)
  assert.match(css, /content-visibility:\s*auto/)
  assert.match(css, /contain-intrinsic-size:\s*auto 310px/)
})
