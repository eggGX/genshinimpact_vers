import { useEffect, useRef, useState } from 'react'
import type { ElementType } from '../game/types'
import { ElementIcon } from './ElementIcon'
import './RulesHelp.css'

type RuleEntry = { title: string; description: string; leaderDescription?: string; elements?: ElementType[] }

const reactions: RuleEntry[] = [
  { title:'蒸発', elements:['pyro','hydro'], description:'炎＋水。今回の攻撃ダメージに＋2。反応した付着を解除します。', leaderDescription:'今回のリーダーへの攻撃ダメージ＋1。反応した付着を解除します。' },
  { title:'溶解', elements:['pyro','cryo'], description:'炎＋氷。今回の攻撃ダメージに＋3。反応した付着を解除します。', leaderDescription:'今回のリーダーへの攻撃ダメージ＋1。反応した付着を解除します。' },
  { title:'感電', elements:['hydro','electro'], description:'水＋雷。対象以外の敵フォロワー1体に1ダメージ。いなければ敵リーダーに1ダメージ。', leaderDescription:'リーダー側の別のフォロワー1体に1ダメージ。いなければリーダー自身に追加で1ダメージ。反応した付着を解除します。' },
  { title:'過負荷', elements:['pyro','electro'], description:'炎＋雷。反応対象がコスト5以下のフォロワーなら持ち主の手札に戻します（手札上限9枚）。', leaderDescription:'今回のリーダーへの攻撃ダメージ＋1。リーダーは手札に戻りません。' },
  { title:'凍結', elements:['hydro','cryo'], description:'水＋氷。対象を凍結状態にし、通常攻撃・元素スキル・元素爆発を封じます。', leaderDescription:'次の自分のターンの使用可能PP－1（最大PPは減りません）。同じターンに何回凍結しても減少量は最大1です。' },
  { title:'超電導', elements:['cryo','electro'], description:'氷＋雷。対象が次に受ける物理ダメージを＋2します。', leaderDescription:'次に受ける物理ダメージ＋1。物理ダメージを1回受けると効果を消費します。' },
  { title:'燃焼', elements:['pyro','dendro'], description:'炎＋草。燃焼状態を付与し、ターン終了時に燃焼ダメージを与えます。炎・草の追加攻撃で継続ターンが増えます。', leaderDescription:'リーダーに燃焼を1ターン分付与します。自分のターン終了時に1ダメージを受け、残りターンが減ります。再度燃焼すると継続ターンが加算されます。' },
  { title:'原激化', elements:['dendro','electro'], description:'草＋雷。原激化状態を2回分付与します。雷・草の攻撃を受けるたび残り回数を消費します。', leaderDescription:'リーダーには原激化が発生しません（雷と草が付着していても原激化しません）。' },
  { title:'開花', elements:['dendro','hydro'], description:'草＋水。反応を起こしたプレイヤーの相手の場に草原核を生成します。既にある草原核には体力＋1。', leaderDescription:'反応を起こしたプレイヤーの相手の場に草原核を生成します。既にある場合はその草原核の体力＋1。' },
  { title:'烈開花', elements:['pyro','dendro'], description:'草原核に炎が当たると草原核を破壊し、その持ち主のリーダーを3ターンの燃焼状態にします。', leaderDescription:'リーダーには直接発生しません。草原核へ炎が当たった場合は、核の持ち主のリーダーに3ターンの燃焼を付与します。' },
  { title:'超開花', elements:['electro','dendro'], description:'草原核に雷が当たると草原核を破壊し、その持ち主の場のランダムな別フォロワー1体に3ダメージ。', leaderDescription:'リーダーには直接発生しません。草原核へ雷が当たった場合は、その持ち主の場の別フォロワー1体にランダム3ダメージ。' },
  { title:'拡散', elements:['anemo'], description:'風攻撃が炎・水・氷・雷の付着に当たると、その元素を敵の別フォロワーへ拡散し1ダメージと付着を与えます。追加の元素反応は起こりますが、再拡散はしません。', leaderDescription:'リーダーの炎・水・氷・雷付着に風攻撃が当たると、その側の別の敵フォロワー全員に拡散した元素で1ダメージ＋付着。追加反応は発生しますが再拡散しません。' },
  { title:'結晶', elements:['geo'], description:'岩攻撃が炎・水・氷・雷の付着に当たると、反応を起こした側のフォロワーに結晶シールドを1付与します。', leaderDescription:'リーダーの炎・水・氷・雷付着に岩攻撃が当たると、攻撃した側のリーダーに結晶シールドを1付与します。' },
]

const keywords: RuleEntry[] = [
  { title:'守護', description:'守護を持つ相手フォロワーがいる間、原則としてそれ以外のフォロワーやリーダーには攻撃できません。' },
  { title:'疾走', description:'場に出たターンからフォロワーにもリーダーにも攻撃できます。' },
  { title:'突進', description:'場に出たターンからフォロワーを攻撃できますが、そのターンはリーダーを攻撃できません。' },
  { title:'潜伏', description:'相手の能力で対象に選ばれず、相手の攻撃対象にもなりません。自分から攻撃すると解除されます。' },
  { title:'オーラ', description:'相手の能力で対象に選ばれません（通常攻撃の対象にはなります）。' },
  { title:'威圧', description:'相手フォロワーから攻撃されません。能力による対象指定は可能です。' },
  { title:'ラストワード', description:'破壊されたときに発動する能力です。' },
  { title:'ファンファーレ', description:'手札から場にプレイしたときに発動する能力です。' },
  { title:'2回攻撃', description:'条件を満たしていれば、1ターンに2回攻撃できます。' },
  { title:'元素攻撃', description:'通常攻撃に指定された元素が付きます。物理攻撃とは異なり、対応する元素反応を起こせます。' },
  { title:'凍結状態', description:'攻撃・元素スキル・元素爆発を使用できなくなる状態異常です。' },
  { title:'シールド', description:'通常シールドと結晶シールドは別々に保持され、それぞれ最大10。ダメージは通常シールドから先に消費します。' },
]

const basics: RuleEntry[] = [
  { title:'勝利条件', description:'相手リーダーの体力を0にすると勝利。山札がない状態でカードを引こうとしたプレイヤーは敗北します。' },
  { title:'デッキ構築', description:'デッキ40枚。同名カードは最大3枚、元素は最大3種類まで。無元素カードはどのデッキでも採用できます。' },
  { title:'PP', description:'カードのプレイや一部の元素スキルに使うポイントです。ターン経過で使用可能な最大PPが増えます。' },
  { title:'元素エネルギー（EN）', description:'最大5。原則として元素スキル使用で＋1、元素爆発使用で指定量を消費します。スキル・爆発は原則各ターン1回です。' },
  { title:'元素付着', description:'元素攻撃を受けると元素が付着します。基本的に風・岩は付着せず、元素反応後は反応に使われた付着が消えます。元素生物は自身の元素の付着を維持します。' },
  { title:'草原核', description:'攻撃力0・体力1で、自身は攻撃できません。ターン終了時に持ち主の場のランダムなフォロワーに2ダメージを与えます。通常・結晶シールドを持てます。' },
  { title:'場・手札の上限', description:'場はフォロワーとアミュレットを合わせて5枚、手札は最大9枚です。' },
  { title:'通常攻撃', description:'フォロワー同士の攻撃は原則として互いに同時ダメージを与えます。' },
  { title:'先攻・後攻', description:'空が先攻、蛍が後攻です。後攻は追加ドローを受けます。進化システムはありません。' },
]

function Entries({ entries }: { entries: RuleEntry[] }) {
  return <div className="rules-help-list">{entries.map(entry =>
    <article className="rules-help-entry" key={entry.title}>
      <h3>{entry.elements && <span className="rules-help-elements">
        {entry.elements.map((element, i) => <ElementIcon element={element} key={i} size="sm"/>)}
      </span>}{entry.title}</h3>
      {entry.leaderDescription ? <>
        <p><span className="rules-help-target">フォロワー</span>{entry.description}</p>
        <p><span className="rules-help-target rules-help-target--leader">リーダー</span>{entry.leaderDescription}</p>
      </> : <p>{entry.description}</p>}
    </article>
  )}</div>
}

/** Mounted once outside App so the same help is available in every screen. */
export function RulesHelp() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'reactions' | 'keywords' | 'basics'>('reactions')
  const closeButton = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    closeButton.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])
  const close = () => {
    setOpen(false)
    window.setTimeout(() => trigger.current?.focus(), 0)
  }

  return <>
    <button type="button" className="rules-help-trigger" ref={trigger}
      aria-label="元素反応・キーワードのルール説明" aria-haspopup="dialog"
      aria-expanded={open} onClick={() => setOpen(true)}>?</button>
    {open && <div className="rules-help-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) close()
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="rules-help-title"
        className="rules-help-dialog">
        <header className="rules-help-heading">
          <div><small>GAME GUIDE</small><h2 id="rules-help-title">ルール・能力ガイド</h2></div>
          <button type="button" ref={closeButton} onClick={close} aria-label="ヘルプを閉じる">×</button>
        </header>
        <nav className="rules-help-tabs" aria-label="ヘルプの分類">
          <button type="button" aria-pressed={tab === 'reactions'} className={tab === 'reactions' ? 'active' : ''} onClick={() => setTab('reactions')}>元素反応</button>
          <button type="button" aria-pressed={tab === 'keywords'} className={tab === 'keywords' ? 'active' : ''} onClick={() => setTab('keywords')}>キーワード</button>
          <button type="button" aria-pressed={tab === 'basics'} className={tab === 'basics' ? 'active' : ''} onClick={() => setTab('basics')}>基本ルール</button>
        </nav>
        <div className="rules-help-content" key={tab}>
          {tab === 'reactions' && <><p className="rules-help-note">元素反応はフォロワーとリーダーで効果が異なる場合があります。蒸発・溶解・過負荷はリーダーに対してのみ追加ダメージ＋1です。</p><Entries entries={reactions} /></>}
          {tab === 'keywords' && <Entries entries={keywords} />}
          {tab === 'basics' && <Entries entries={basics} />}
        </div>
      </section>
    </div>}
  </>
}
