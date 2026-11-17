import { useState } from 'react'
import { DeckBuilder } from './DeckBuilder'
import { ElementIcon } from './ElementIcon'
import { validateDeck, type DeckDefinition } from '../data/deckRules'
import { copyDeck, type SavedDeck } from '../data/savedDecks'
import './DeckManager.css'

interface Props {
  savedDecks: SavedDeck[]
  onChange: (decks: SavedDeck[]) => void
  onBack: () => void
}

function freshDeck(): DeckDefinition {
  return { elements: [], cards: [] }
}

export function DeckManager({ savedDecks, onChange, onBack }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DeckDefinition | null>(null)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const startNew = () => {
    setEditingId(null)
    setDraft(freshDeck())
    setName('')
    setMessage('')
  }
  const startEdit = (saved: SavedDeck) => {
    setEditingId(saved.id)
    setDraft(copyDeck(saved.deck))
    setName(saved.name)
    setMessage('')
  }
  const startCopy = (saved: SavedDeck) => {
    setEditingId(null)
    setDraft(copyDeck(saved.deck))
    setName(saved.name + '（コピー）')
    setMessage('')
  }

  const saveDraft = () => {
    if (!draft) return
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 40) {
      setMessage('デッキ名を1〜40文字で入力してください。')
      return
    }
    const errors = validateDeck(draft)
    if (errors.length) {
      setMessage(errors[0])
      return
    }
    const id = editingId ?? `deck-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const saved: SavedDeck = { id, name: trimmed, deck: copyDeck(draft) }
    onChange(editingId
      ? savedDecks.map(deck => deck.id === editingId ? saved : deck)
      : [...savedDecks, saved])
    setDraft(null)
    setMessage('')
    setEditingId(null)
  }

  if (draft) return <div className="game">
    <div className="deck-manager-savebar" role="region" aria-label="デッキ保存">
      <label htmlFor="saved-deck-name">デッキ名</label>
      <input id="saved-deck-name" type="text" maxLength={40} value={name}
        onChange={event => { setName(event.target.value); setMessage('') }}
        placeholder="例：炎水蒸発デッキ" />
      <button type="button" onClick={saveDraft} disabled={validateDeck(draft).length > 0 || !name.trim()}>
        {editingId ? '変更を保存' : 'このデッキを登録'}
      </button>
      {message && <p role="alert">{message}</p>}
      {validateDeck(draft).length > 0 && <small>{validateDeck(draft)[0]}</small>}
      <small>デッキはこのブラウザに保存されます。編集内容は「保存」時に確定します。</small>
    </div>

    <DeckBuilder
      title={editingId ? '登録済みデッキ' : '新規デッキ'}
      deck={draft}
      onChange={setDraft}
      onBack={() => { setDraft(null); setMessage('') }}
    />
  </div>

  return <div className="game">
    <header className="game-header">
      <h1>原神カードゲーム</h1>
      <span>デッキ管理</span>
      <button type="button" onClick={onBack}>対戦準備に戻る</button>
    </header>
    <main className="deck-manager">
      <div className="deck-manager-heading">
        <div>
          <h2>登録済みデッキ</h2>
          <p>対戦前にデッキを作成して保存できます。ローカル・オンラインの両方で使用できます。</p>
        </div>
        <button type="button" onClick={startNew}>＋ 新しいデッキを作成</button>
      </div>
      {savedDecks.length === 0
        ? <div className="deck-manager-empty">登録済みデッキはまだありません。「新しいデッキを作成」から40枚のデッキを登録できます。</div>
        : <div className="deck-manager-grid">{savedDecks.map(saved => <section className="deck-manager-card" key={saved.id}>
            <h3>{saved.name}</h3>
            <div className="deck-manager-elements">
              {saved.deck.elements.map(element => <ElementIcon key={element} element={element} size="sm" withLabel />)}
            </div>
            <p>カード {saved.deck.cards.length}枚 · {validateDeck(saved.deck).length ? '要修正' : '使用可能'}</p>
            <div className="deck-manager-actions">
              <button type="button" onClick={() => startEdit(saved)}>編集</button>
              <button type="button" onClick={() => startCopy(saved)}>複製</button>
              {deleteId === saved.id
                ? <><button type="button" onClick={() => {
                    onChange(savedDecks.filter(deck => deck.id !== saved.id))
                    setDeleteId(null)
                  }}>削除を確定</button>
                  <button type="button" onClick={() => setDeleteId(null)}>キャンセル</button></>
                : <button type="button" onClick={() => setDeleteId(saved.id)}>削除</button>}
            </div>
          </section>)}</div>}
      <p className="deck-manager-storage-note">※ ブラウザ内保存のため、別の端末・ブラウザには自動で同期されません。閲覧データを削除すると登録デッキも消える場合があります。</p>
    </main>
  </div>
}
