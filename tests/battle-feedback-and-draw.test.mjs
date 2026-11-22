import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const css = read('src/App.css')
const lobby = read('src/components/FriendRoomLobby.tsx')
const lobbyCss = read('src/components/FriendRoomLobby.css')

test('only the human sees drawn cards; both CPU and online opponents stay private', () => {
  assert.match(app, /const isSelf=player\.id===selfId/)
  assert.match(app, /cardId:isSelf&&getCard\(cards\[index\]\)\?cards\[index\]:undefined/)
  assert.match(css, /@keyframes battle-draw-flip/)
})

test('opponent and self leader show total shield opposite their HP only when shielded', () => {
  assert.equal((app.match(/className="leader-shield-badge"/g) ?? []).length, 2)
  assert.match(app, /opponent\.leaderShield\?\.crystallize/)
  assert.match(app, /currentPlayer\.leaderShield\?\.crystallize/)
  assert.match(css, /\.game--battle \.leader-shield-badge \{[\s\S]*?left:-27px/)
  assert.match(css, /\.game--battle \.leader-shield-badge strong/)
})

test('pending fanfare, spell and ability target displays its card without blocking clicks', () => {
  assert.match(app, /const targetingCardId = selectedHandIndex !== null/)
  assert.match(app, /selectedAbility \? currentPlayer\.field\.find/)
  assert.match(app, /className="battle-targeting-card"/)
  assert.match(app, /<CardArtwork cardId=\{targetingCard\.id\}/)
  assert.match(css, /\.game--battle-fit \.battle-targeting-card \{[\s\S]*?pointer-events:none/)
})

test('copy feedback reports success only after clipboard promise resolves', () => {
  assert.match(lobby, /await navigator\.clipboard\.writeText\(code\)/)
  assert.match(lobby, /setCodeCopied\(true\)/)
  assert.match(lobby, /role="status" aria-live="polite">コピーしました/)
  assert.match(lobby, /setCodeCopied\(false\), 2200/)
  assert.match(lobbyCss, /\.friend-copy-confirmation/)
})


test('own online draws reveal the front directly, without relying on the GPU flip', () => {
  assert.match(app, /flight\.isSelf && flight\.cardId \? 'battle-draw-card battle-draw-card--revealed'/)
  assert.match(app, /\{!\(flight\.isSelf && flight\.cardId\) && <div className="battle-draw-card-back"/)
  assert.match(app, /\{flight\.isSelf && flight\.cardId && <div className="battle-draw-card-front"/)
  assert.match(app, /<CardArtwork cardId=\{flight\.cardId\}[^>]*priority/)
  assert.match(css, /\.game--battle-fit \.battle-draw-card--revealed \{[\s\S]*?animation:none/)
  assert.match(css, /\.game--battle-fit \.battle-draw-card--revealed \.battle-draw-card-front \{[\s\S]*?transform:none/)
})

test('draw artwork is eagerly decoded, while regular catalogue artwork stays lazy', () => {
  const artwork = read('src/components/CardArtwork.tsx')
  assert.match(artwork, /loading=\{priority \? "eager" : "lazy"\}/)
  assert.match(artwork, /decoding=\{priority \? "sync" : "async"\}/)
})


test('blank battlefield clicks cancel preparation without intercepting valid target clicks', () => {
  assert.match(app, /const isBlank = !target\.closest\(/)
  assert.match(app, /selectedHandIndex !== null \|\| selectedAbility !== null/)
  assert.match(app, /if \(isBlank && \(selectedHandIndex !== null \|\| selectedAbility !== null \|\| selectedAttackerId !== null\)\) \{/)
  assert.match(app, /\[data-attack-drop\]/)
  assert.match(app, /setSelectedAttackerId\(null\)\s+setSelectedHandIndex\(null\)\s+setSelectedAbility\(null\)/)
})

test('preparation preview takes precedence over card hover details', () => {
  assert.match(app, /!targetingCard && inspectCard && <BattleCardTooltip/)
  assert.match(app, /setSelectedAbility\(\{ followerId: follower\.instanceId, kind \}\)[\s\S]*?setInspectedCard\(null\)/)
  assert.match(app, /fromDrag \? handIndex : previous === handIndex \? null : handIndex[\s\S]*?setInspectedCard\(null\)/)
})

test('automatic ability flag lights only the actual resolved trigger source', () => {
  const engine = read('src/game/engine.ts')
  const presentation = read('src/game/presentation.ts')
  const server = read('server/src/onlinePresentation.ts')
  const client = read('src/online/matchClient.ts')
  assert.match(engine, /captureFrame\(result, `\$\{card\?\.name \?\? source\.cardId\}：\$\{trigger === 'turn_end'[^\n]+undefined, sourceId\)/)
  assert.equal((engine.match(/captureFrame\(buffed, '攻撃時能力', undefined, attackerId\)/g) ?? []).length,2)
  assert.match(presentation, /triggerSourceId\?: string/)
  assert.match(presentation, /triggerSourceId \? \{ triggerSourceId \} : \{\}/)
  assert.match(app, /playback\.frames\[playback\.index\]\.triggerSourceId/)
  assert.match(app, /activeTriggerSourceId === follower\.instanceId/)
  assert.match(app, /emblem\.key === 'triggered' && triggerActive/)
  assert.match(app, /follower-emblem--trigger-active/)
  assert.match(css, /@keyframes flag-trigger-pulse/)
  assert.match(css, /follower-emblem--trigger-active[\s\S]*?animation:flag-trigger-pulse/)
  assert.match(server, /triggerSourceId:frame\.triggerSourceId/)
  assert.match(client, /triggerSourceId\?: string/)
  assert.match(app, /frame\.triggerSourceId \? \{ triggerSourceId: frame\.triggerSourceId \} : \{\}/)
})
