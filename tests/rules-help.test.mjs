import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const help = read('src/components/RulesHelp.tsx')
const css = read('src/components/RulesHelp.css')
const main = read('src/main.tsx')

test('rules popup is mounted globally outside App and works in all screens', () => {
  assert.match(main, /import \{ RulesHelp \} from '\.\/components\/RulesHelp'/)
  assert.match(main, /<App \/>/)
  assert.match(main, /<RulesHelp \/>/)
  assert.match(help, /aria-haspopup="dialog"/)
  assert.match(help, /role="dialog" aria-modal="true"/)
  assert.match(help, /event\.key === 'Escape'/)
  assert.match(help, /onClick=\{close\}/)
  assert.match(css, /\.rules-help-trigger\{position:fixed/)
  assert.match(css, /\.rules-help-backdrop\{position:fixed/)
})

test('rules popup has reactions, keywords and basics tabs with card game rules', () => {
  for (const tab of ['元素反応','キーワード','基本ルール']) {
    assert.ok(help.includes(tab), `Missing help tab: ${tab}`)
  }
  for (const reaction of ['蒸発','溶解','感電','過負荷','凍結','超電導','燃焼','原激化','開花','烈開花','超開花','拡散','結晶']) {
    assert.ok(help.includes(`title:'${reaction}'`), `Missing reaction: ${reaction}`)
  }
  for (const keyword of ['守護','疾走','突進','潜伏','オーラ','威圧','ファンファーレ','ラストワード','シールド']) {
    assert.ok(help.includes(`title:'${keyword}'`), `Missing keyword: ${keyword}`)
  }
  assert.match(help, /ダメージに＋2/)
  assert.match(help, /ダメージに＋3/)
  assert.match(help, /デッキ40枚/)
  assert.match(help, /元素エネルギー（EN）/)
})


test('every elemental reaction distinguishes follower and leader behavior', () => {
  const allEntries = help.slice(help.indexOf('const reactions:'),help.indexOf('const keywords:'))
  assert.equal((allEntries.match(/leaderDescription:/g) ?? []).length,13)
  assert.match(help, /rules-help-target--leader/)
  assert.match(help, /現在のゲームエンジンの実装/)
  assert.match(help, /攻撃ダメージ＋2。反応した元素付着を解除/)
  assert.match(help, /攻撃ダメージ＋3。反応した元素付着を解除/)
  assert.match(help, /リーダー自身は凍結状態にならず/)
  assert.match(help, /リーダーに直接開花を起こしても、草原核は生成されません/)
  assert.match(help, /リーダーに3ターンの燃焼状態を付与/)
  assert.match(read('src/game/leaderShield.ts'), /const bonus = reacted && element &&/)
  assert.match(read('src/game/leaderShield.ts'), /leaderAura: nextAuras/)
})
