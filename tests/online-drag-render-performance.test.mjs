import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const app=readFileSync(new URL('../src/App.tsx', import.meta.url),'utf8')

test('online match projection is memoized during UI-only rerenders',()=>{
  assert.match(app,/const game: GameState = useMemo\(\(\) => online \? \{/)
  assert.match(app,/\[online\?\.match, online\?\.match\.seat, localGame\]\)/)
})

test('hand drag pointer movement updates ghost directly and rerenders only on drop-zone transitions',()=>{
  const code=app.split('const moveHandDrag = ')[1]?.split('const finishHandDrag = ')[0]??''
  assert.match(code,/handDragGhostRef\.current/)
  assert.match(code,/ghost\.style\.transform/)
  assert.match(code,/previous\.overField===overField/)
  assert.match(app,/ref=\{handDragGhostRef\}/)
})

test('attack drag pointer movement rerenders only when the hovered target changes',()=>{
  const code=app.split('const moveAttackDrag = ')[1]?.split('const finishAttackDrag = ')[0]??''
  assert.match(code,/attackDragGhostRef\.current/)
  assert.match(code,/ghost\.style\.transform/)
  assert.match(code,/previous\.target===target/)
  assert.match(app,/ref=\{attackDragGhostRef\}/)
})

test('drag final positions and targeting still use pointer release coordinates',()=>{
  assert.match(app,/handOverOwnField\(event\.clientX, event\.clientY\)/)
  assert.match(app,/dragTargetAt\(event\.clientX, event\.clientY, pointer\.attackerId\)/)
})
