import { useState } from 'react'
import type { DeckDefinition } from '../data/deckRules'
import { copyDeck, type SavedDeck } from '../data/savedDecks'
import './SavedDeckPicker.css'

export function SavedDeckPicker({
  savedDecks, onSelect, disabled = false,
}: {
  savedDecks: SavedDeck[]
  onSelect: (deck: DeckDefinition) => void
  disabled?: boolean
}) {
  const [selectedId, setSelectedId] = useState('')
  const selected = savedDecks.find(deck => deck.id === selectedId)
  return <div className="saved-deck-picker">
    <label>登録済みデッキから選ぶ
      <select value={selected ? selectedId : ''} disabled={disabled || savedDecks.length === 0}
        onChange={event => setSelectedId(event.target.value)}>
        <option value="">デッキを選択してください</option>
        {savedDecks.map(saved => <option key={saved.id} value={saved.id}>{saved.name}（{saved.deck.cards.length}枚）</option>)}
      </select>
    </label>
    <button type="button" disabled={disabled || !selected}
      onClick={() => {
        if (!selected) return
        onSelect(copyDeck(selected.deck))
      }}>このデッキを使う</button>
    {savedDecks.length === 0 && <small>まだ登録済みデッキがありません。トップ画面の「デッキ管理」から登録できます。</small>}
    <small>選択すると対戦用デッキにコピーします。保存済みの元デッキは変更されません。</small>
  </div>
}
