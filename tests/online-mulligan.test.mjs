import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
after(async () => { await vite.close() })
const { applyIndependentMulligan } = await vite.ssrLoadModule('/server/src/mulligan.ts')

function initial() {
  return {
    turn: 1,
    phase: 'mulligan',
    currentPlayerId: 'player1',
    winnerId: null,
    players: [
      { id: 'player1', name: '空', deck: ['C011', 'C012', 'C013', 'C014', 'C015'], hand: ['C001', 'C002', 'C003', 'C004'], pp: 0, maxPp: 0 },
      { id: 'player2', name: '蛍', deck: ['C021', 'C022', 'C023', 'C024', 'C025'], hand: ['C005', 'C006', 'C007', 'C008'], pp: 0, maxPp: 0 },
    ],
  }
}

test('蛍が先に確定しても、空のマリガン画面は維持される', () => {
  const starting = initial()
  const guest = applyIndependentMulligan(starting, [false, false], 1, [0, 2])
  assert.deepEqual(guest.mulliganReady, [false, true])
  assert.equal(guest.state.phase, 'mulligan')
  assert.equal(guest.state.currentPlayerId, 'player1')
  assert.equal(guest.state.players[0].hand.join(','), starting.players[0].hand.join(','))
  assert.equal(guest.state.players[1].hand.length, 4)
  assert.equal(guest.state.players[0].pp, 0)
  // No mutation of the original state.
  assert.deepEqual(starting, initial())

  const host = applyIndependentMulligan(guest.state, guest.mulliganReady, 0, [])
  assert.deepEqual(host.mulliganReady, [true, true])
  assert.equal(host.state.phase, 'main')
  assert.equal(host.state.currentPlayerId, 'player1')
  assert.equal(host.state.players[0].pp, 1)
  assert.equal(host.state.players[0].maxPp, 1)
})

test('空が先に確定しても、蛍の完了まで対戦は始まらない', () => {
  const host = applyIndependentMulligan(initial(), [false, false], 0, [1])
  assert.deepEqual(host.mulliganReady, [true, false])
  assert.equal(host.state.phase, 'mulligan')
  assert.equal(host.state.players[0].hand.length, 4)
  const guest = applyIndependentMulligan(host.state, host.mulliganReady, 1, [0])
  assert.deepEqual(guest.mulliganReady, [true, true])
  assert.equal(guest.state.phase, 'main')
  assert.equal(guest.state.currentPlayerId, 'player1')
  assert.equal(guest.state.players[0].pp, 1)
})

test('確定済みのマリガンを再送しても手札を変更できない', () => {
  const host = applyIndependentMulligan(initial(), [false, false], 0, [])
  assert.throws(() => applyIndependentMulligan(host.state, host.mulliganReady, 0, [1]), /すでに確定/)
})

test('範囲外や同じカードの重複選択は拒否する', () => {
  assert.throws(() => applyIndependentMulligan(initial(), [false, false], 1, [0, 0]), /不正/)
  assert.throws(() => applyIndependentMulligan(initial(), [false, false], 0, [4]), /不正/)
})
