
import './App.css'

function App() {
  return (
    <div className="game">
      <header className="game-header">
        <h1>原神カードゲーム</h1>
        <span>TURN 1</span>
      </header>

      <section className="player opponent">
        <div className="leader">
          <strong>相手リーダー</strong>
          <span>HP 20 / 20</span>
        </div>
        <div className="pp">PP 0 / 0</div>
      </section>

      <section className="field">
        <div className="field-row">
          <p>相手フィールド</p>
          <div className="card-slot">カード配置エリア</div>
        </div>

        <div className="field-divider">VS</div>

        <div className="field-row">
          <p>自分フィールド</p>
          <div className="card-slot">カード配置エリア</div>
        </div>
      </section>

      <section className="player self">
        <div className="leader">
          <strong>自分リーダー</strong>
          <span>HP 20 / 20</span>
        </div>
        <div className="pp">PP 1 / 1</div>
        <button className="end-turn">ターン終了</button>
      </section>

      <footer className="hand">
        <div className="hand-card">カード 1</div>
        <div className="hand-card">カード 2</div>
        <div className="hand-card">カード 3</div>
      </footer>
    </div>
  )
}

export default App
