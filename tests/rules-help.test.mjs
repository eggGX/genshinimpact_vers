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
