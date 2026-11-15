# カードデータの追加方法（STEP 23）

カードデータはゲームエンジンから独立して管理します。

## ファイル構成

- `cards/neutral.ts`: 無元素10枚（B4/S4/G2）
- `cards/pyro.ts`: 炎15枚（B4/S4/G4/L3）
- `cards/hydro.ts`: 水15枚（B4/S4/G4/L3）
- `cards/cryo.ts`: 氷15枚（B4/S4/G4/L3）
- `cards/electro.ts`: 雷15枚（B4/S4/G4/L3）
- `cards/anemo.ts`: 風15枚（B4/S4/G4/L3）
- `cards/geo.ts`: 岩15枚（B4/S4/G4/L3）
- `cards/dendro.ts`: 草15枚（B4/S4/G4/L3）
- `productionCards.ts`: 上記8ファイルを統合
- `testCards.ts`: 動作確認専用カード。正式115枚には含まない
- `cardRegistry.ts`: 全カード検索・重複ID検出・トークンのデッキ除外
- `cardValidation.ts`: 正式115枚の枠数・カード情報の検証
- `cardFilters.ts`: 一覧画面の検索・フィルタ
- `../components/CardLibrary.tsx`: ゲーム内のカード一覧画面

B=ブロンズ、S=シルバー、G=ゴールド、L=レジェンド。
無元素10枚＋7元素×15枚＝115枚。

## 正式カードの登録方法

該当する元素ファイルの配列に `Card` 型のデータを追加します。
必須項目は `id`、`name`、`type`、`rarity`、`element`、`cost`。
フォロワーなら `attack`、`health` も必要です。
効果は `effects`、`elementalSkill`、`elementalBurst` に記載します。

元の `engine.ts` と `elemental.ts` は変更せず、登録済みカードの検索対象になります。
共通処理で表現できない能力が出た場合のみ `CardEffect` などを拡張します。

## 検証と一覧

- 登録済み枚数・残り枚数はカード一覧画面で確認できます。
- 登録ファイルが空の間は「登録準備中（未完成）」と表示します。開発中であること自体はエラーではありません。
- 重複ID、空ID、空の名前、枠数超過、無効な数値、不正なスキルや爆発を検出します。
- `token: true` は正式115枚に数えません。
- テストカードと正式カードを統合した際の重複IDは `createCardRegistry` が検出します。
- `npm run build`、`npm run lint`、`npm test` はGitHub Actionsで実行されます。

**正式115枚の実データはまだ未登録です。** 確定済みのカード表に基づいて、今後各元素ファイルへ追加していきます。
