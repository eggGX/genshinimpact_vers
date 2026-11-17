import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const help = read('src/components/RulesHelp.tsx')
const keywordBlock = help.split('const keywords: RuleEntry[] = [')[1]?.split('const basics: RuleEntry[]')[0] ?? ''

test('rules help covers elemental creatures and printed keyword abilities', () => {
  const expected = [
    '守護', '疾走', '突進', '潜伏', 'オーラ', '威圧',
    'ラストワード', 'ファンファーレ', '2回攻撃',
    '元素攻撃', '元素生物', '落下攻撃', '攻撃不可',
    '攻撃時', '交戦時', '攻撃後', 'ターン開始時・終了時',
    '自分のターン中', 'カウントダウン', '命の契約',
    '凍結状態', 'シールド',
  ]
  for (const label of expected) {
    assert.ok(keywordBlock.includes("title:'" + label + "'"), 'Missing keyword: ' + label)
  }
})

test('elemental creature entry documents permanent attachment even for Anemo and Geo', () => {
  assert.ok(keywordBlock.includes('風・岩の元素生物'))
  assert.ok(keywordBlock.includes('元素耐性やダメージ軽減を意味する能力ではありません'))
})

test('basic rules entries are separated and grass core text is retained', () => {
  assert.match(help, /title:'草原核'.*\},\s*\{ title:'場・手札の上限'/s)
})
