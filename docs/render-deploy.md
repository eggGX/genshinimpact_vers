# 無料の対戦サーバー公開手順（Render）

## 構成

- ゲーム画面：Firebase Hosting（既存の `https://genshincard-25028.web.app`）
- 対戦サーバー：Render Web Service / **Free** プラン（このリポジトリの `render.yaml`）
- データ保存・匿名認証：既存の Firebase / Firestore

この構成は**試験用**です。Render Freeは15分無通信で停止し、初回アクセス時の再開に約1分かかる場合があります。
FirebaseのSparkプランをBlazeに切り替える必要はありません。ただしRenderの無料枠や通信量の制限は確認してください。

## STEP 1：Firebase Adminの認証情報を準備する（秘密情報）

1. [Firebase Console](https://console.firebase.google.com/project/genshincard-25028/settings/serviceaccounts/adminsdk) のプロジェクト設定 → **サービスアカウント** を開く。
2. Firebase Admin SDKで **「新しい秘密鍵の生成」** を選択する。
3. JSONファイルをPCの安全な場所に保存する。
4. **このJSONをChatGPT、GitHub、公開チャット、.env.local、VITE_で始まる変数には絶対に貼らない。**
   Render側の非公開環境変数にだけ登録する。GitHubに登録すると秘密鍵が漏洩します。

## STEP 2：RenderでBlueprintを登録

1. [Render Dashboard](https://dashboard.render.com/) にログイン。
2. GitHub連携で `eggGX/genshinimpact_vers` にアクセスできるようにする。
3. **New → Blueprint** を選択し、対象リポジトリの `main` ブランチを指定する。
4. リポジトリ直下の `render.yaml` を読み込む。
5. **Freeプラン**であることを確認する。シンガポールリージョンを設定済み。
6. `FIREBASE_SERVICE_ACCOUNT_JSON` の値を求められたら、STEP 1のJSONファイルの**内容全体**をRenderの秘密環境変数入力欄に登録する。
   ※ JSONは一行にまとめても、正しいJSONであれば改行付きでも構いません。
7. Render側でデプロイを実行する。成功後のURLは `https://<Renderが発行した名前>.onrender.com`。

※ Renderが「Free」を提供していない画面、カード請求が必要な画面、想定外の課金画面になった場合は**作成を確定せず確認**してください。

## STEP 3：サーバー起動を確認

Renderの公開URL末尾に `/health` をつけて開きます。

```text
https://<RenderのURL>/health
```

`{"ok":true}` が表示されたら、Nodeサーバーへの通信に成功しています。
これだけではFirebase Admin認証まで成功したことにはなりません。実際のルーム対戦画面で確認します。

## STEP 4：WebサイトにサーバーURLを設定

自分のゲームリポジトリの `.env.local`（`package.json` と同じ階層）に次の行を追加：

```dotenv
VITE_MATCH_SERVER_URL=https://<Renderが発行した名前>.onrender.com
```

この値は**サーバーの公開URL**です。秘密鍵ではありません。

更新してFirebase Hostingに公開：

```bash
git pull
npm run build
npx firebase-tools deploy --only hosting
```

## STEP 5：2ブラウザで新しい対戦ルームをテスト

1. 2つの異なるブラウザ/プロファイルで同じ公開サイトを開く
2. ルーム作成・参加→各自のデッキ選択→双方準備完了
3. ホストが「対戦セッションを開始」
4. サーバー側でシャッフルと初期手札配布
5. ホスト→ゲストの順にマリガン確定
6. 試験用オンライン対戦パネルでカードのプレイやターン終了を操作
7. 双方の盤面・HP・PPなどが更新されることを確認

**現在の制限：** 試験用操作UIのため、複雑な複数対象スキル、既存UIのアニメーションは未統合です。対戦中にRenderの無料サービスが再起動した場合は再接続に時間がかかります。プライベートな山札・手札をFirestoreの公開ルーム文書へ保存してはいけません。

### 秘密鍵について

サービスアカウント鍵が漏洩した場合は、Firebase/Google Cloudのサービスアカウント管理画面で該当鍵を**失効**し、新しい鍵に入れ替えてください。Renderではシークレットとして扱いますが、長期運用では鍵不要の認証方式の検討を推奨します。
