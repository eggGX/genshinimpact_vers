/**
 * Incremental artwork registry for the official 115 cards and 24 tokens.
 *
 * Place the image under public/card-art/ and register its URL here:
 *   C084: '/card-art/C084.webp', // 魈
 *
 * This explicit manifest avoids 404 requests for cards without artwork.
 * File names are tied to the stable card ID, not the display name.
 *
 * Images are not distributed here until their source/license is confirmed.
 */
export const cardArtwork: Readonly<Partial<Record<string, string>>> = {
  'C116': '/card-art/C116.webp', // 荒野の呪い
  'C117': '/card-art/C117.webp', // 反魂の詩
  'C118': '/card-art/C118.webp', // 諭示裁定カーディナル
  'C119': '/card-art/C119.webp', // クルースニクの炉
  'C120': '/card-art/C120.webp', // 一心浄土
  'C121': '/card-art/C121.webp', // 風の翼
  'C122': '/card-art/C122.webp', // 黄金屋
  'C123': '/card-art/C123.webp', // 夢境の力
  'token-mora': '/card-art/token-mora.webp', // モラ
  'C124': '/card-art/C124.webp', // ズバイルシアターの踊り子・ニィロウ
  'token-bountiful-core': '/card-art/C125.webp', // 豊穣の核
  'token-cryo-itzpapa': '/card-art/token-cryo-itzpapa.webp', // イツパパ
  'token-oz': '/card-art/token-oz.webp', // オズ
  'token-sesshou-sakura': '/card-art/token-sesshou-sakura.webp', // 殺生櫻
  'token-surprising-cat-box': '/card-art/token-surprising-cat-box.webp', // ビックラキャット・ボックス
  'token-jade-screen': '/card-art/token-jade-screen.webp', // 璇璣屏
  'token-spinning-turbo': '/card-art/token-spinning-turbo.webp', // ぐるぐるコマちゃん
  'token-solar-isotoma': '/card-art/token-solar-isotoma.webp', // 陽華
  'token-tamoto': '/card-art/token-tamoto.webp', // たもと
  'token-yuegui-jumping': '/card-art/token-yuegui-jumping.webp', // 月桂・跳躍型
  'token-collei-amber': '/card-art/token-collei-amber.webp', // コレアンバー
  'token-dendro-spirit': '/card-art/token-dendro-spirit.webp', // 草の霊蛇
  'token-yuegui-throwing': '/card-art/token-yuegui-throwing.webp', // 月桂・投擲型
  'token-lumidouce-vial': '/card-art/token-lumidouce-vial.webp', // ルミドゥースの瓶
  'dendro-core': '/card-art/dendro-core.webp', // 草原核
  'neutral-dove': '/card-art/neutral-dove.webp', // ハト
  'token-baron-bunny': '/card-art/token-baron-bunny.webp', // ウサギ伯爵
  'token-guoba': '/card-art/token-guoba.webp', // グゥオパァー
  'token-funny-hat-cat': '/card-art/token-funny-hat-cat.webp', // ファニーハット・キャット
  'token-hydro-pressure-device': '/card-art/token-hydro-pressure-device.webp', // 落ち着いた方がいいカモ？
  'token-hydro-phantom': '/card-art/token-hydro-phantom.webp', // 虚影
  'token-hydro-jellyfish': '/card-art/token-hydro-jellyfish.webp', // 化海月
  'token-cryo-cicin': '/card-art/token-cryo-cicin.webp', // 氷蛍
  'token-electro-cicin': '/card-art/token-electro-cicin.webp', // 雷蛍
  'token-cryo-ice-lotus': '/card-art/token-cryo-ice-lotus.webp', // 氷蓮
  C075: '/card-art/C075.webp', // 魔術・アストニシングシフト
  C076: '/card-art/C076.webp', // 禁・風霊作成・七五同構弐型
  C090: '/card-art/C090.webp', // 天権崩玉
  C091: '/card-art/C091.webp', // 大掃除
  C105: '/card-art/C105.webp', // 玉顆珊々月中落
  C106: '/card-art/C106.webp', // ニャンコトレジャー
  C015: '/card-art/C015.webp', // 旋火輪
  C016: '/card-art/C016.webp', // 素晴らしい旅
  C030: '/card-art/C030.webp', // 古華剣・裁雨留虹
  C031: '/card-art/C031.webp', // シャイニングミラクル♪
  C045: '/card-art/C045.webp', // 凛冽なる輪舞
  C046: '/card-art/C046.webp', // 星流揺籠の夢
  C060: '/card-art/C060.webp', // 夜の幻現
  C061: '/card-art/C061.webp', // 御詠鳴神刈山祭
  C102: '/card-art/C102.webp', // スメールの知恵
  C013: '/card-art/C013.webp', // ドドコ
  C017: '/card-art/C017.webp', // ファデュイ・デットエージェント・炎
  C018: '/card-art/C018.webp', // 双界の炎
  C044: '/card-art/C044.webp', // 霜の精
  C047: '/card-art/C047.webp', // ファデュイ・氷蛍術師
  C059: '/card-art/C059.webp', // 雷フライム
  C062: '/card-art/C062.webp', // ファデュイ・雷蛍術師
  C072: '/card-art/C072.webp', // モンド城
  C078: '/card-art/C078.webp', // ファデュイ・烈風の従者
  C087: '/card-art/C087.webp', // 璃月港
  C107: '/card-art/C107.webp', // ヴァナラーナ
  C028: '/card-art/C028.webp', // コホラ仔竜
  C032: '/card-art/C032.webp', // 堅盾重甲ヤドカニ
  C043: '/card-art/C043.webp', // イクトミ仔竜
  C058: '/card-art/C058.webp', // ライノ仔竜
  C073: '/card-art/C073.webp', // クク仔竜
  C088: '/card-art/C088.webp', // テペトル仔竜
  C092: '/card-art/C092.webp', // 獣域ハウンド・岩
  C103: '/card-art/C103.webp', // ユムカ仔竜
  C004: '/card-art/C004.webp', // ワイルドハント
  C014: '/card-art/C014.webp', // アビスの魔術師・炎
  C029: '/card-art/C029.webp', // アビスの魔術師・水
  C057: '/card-art/C057.webp', // グルグル雷キノコン
  C063: '/card-art/C063.webp', // 獣域ハウンド・雷
  C074: '/card-art/C074.webp', // 風フライム
  C089: '/card-art/C089.webp', // ベビーヴィシャップ
  C093: '/card-art/C093.webp', // ヴィシャップ・岩
  C104: '/card-art/C104.webp', // 草フライム
  C108: '/card-art/C108.webp', // エルマイト旅団・フローラルリングダンサー
  C001: '/card-art/C001.webp', // ヒルチャール
  C002: '/card-art/C002.webp', // 宝盗団・雑夫
  C003: '/card-art/C003.webp', // 遺跡守衛
  C005: '/card-art/C005.webp', // ヒルチャール強襲
  C006: '/card-art/C006.webp', // エラ・マスク
  C007: '/card-art/C007.webp', // ティミー
  C008: '/card-art/C008.webp', // ヒルチャール暴徒
  C011: '/card-art/C011.webp', // 炎スライム
  C012: '/card-art/C012.webp', // ヒルチャール射手・炎
  C026: '/card-art/C026.webp', // 水スライム
  C027: '/card-art/C027.webp', // ヒルチャールシャーマン・水
  C033: '/card-art/C033.webp', // ヒルチャールレンジャー・水
  C041: '/card-art/C041.webp', // 氷スライム
  C042: '/card-art/C042.webp', // ヒルチャール射手・氷
  C048: '/card-art/C048.webp', // ヒルチャール・霜鎧の王
  C056: '/card-art/C056.webp', // 雷スライム
  C071: '/card-art/C071.webp', // 風スライム
  C077: '/card-art/C077.webp', // ヒルチャールレンジャー・風
  C086: '/card-art/C086.webp', // 岩スライム
  C101: '/card-art/C101.webp', // 草スライム
  C009: '/card-art/C009.webp', // パイモンのへそくり
  C010: '/card-art/C010.webp', // 第四降臨者の力
  C019: '/card-art/C019.webp', // アンバー
  C020: '/card-art/C020.webp', // 香菱
  C021: '/card-art/C021.webp', // ベネット
  C022: '/card-art/C022.webp', // シュヴルーズ
  C023: '/card-art/C023.webp', // ディルック
  C024: '/card-art/C024.webp', // リネ
  C025: '/card-art/C025.webp', // 胡桃
  C034: '/card-art/C034.webp', // バーバラ
  C035: '/card-art/C035.webp', // 行秋
  C036: '/card-art/C036.webp', // キャンディス
  C037: '/card-art/C037.webp', // アイノ
  C038: '/card-art/C038.webp', // モナ
  C039: '/card-art/C039.webp', // 珊瑚宮心海
  C040: '/card-art/C040.webp', // タルタリヤ
  C049: '/card-art/C049.webp', // ディオナ
  C050: '/card-art/C050.webp', // ガイア
  C051: '/card-art/C051.webp', // レイラ
  C052: '/card-art/C052.webp', // シャルロット
  C053: '/card-art/C053.webp', // 甘雨
  C054: '/card-art/C054.webp', // シトラリ
  C055: '/card-art/C055.webp', // 神里綾華
  C064: '/card-art/C064.webp', // フィッシュル
  C065: '/card-art/C065.webp', // 久岐忍
  C066: '/card-art/C066.webp', // 九条裟羅
  C067: '/card-art/C067.webp', // オロルン
  C068: '/card-art/C068.webp', // セノ
  C069: '/card-art/C069.webp', // 八重神子
  C070: '/card-art/C070.webp', // ヴァレサ
  C079: '/card-art/C079.webp', // スクロース
  C080: '/card-art/C080.webp', // 早柚
  C081: '/card-art/C081.webp', // ファルザン
  C082: '/card-art/C082.webp', // リネット
  C083: '/card-art/C083.webp', // ファルカ
  C084: '/card-art/C084.webp', // 魈
  C085: '/card-art/C085.webp', // 放浪者
  C094: '/card-art/C094.webp', // ノエル
  C095: '/card-art/C095.webp', // 凝光
  C096: '/card-art/C096.webp', // ゴロー
  C097: '/card-art/C097.webp', // カチーナ
  C098: '/card-art/C098.webp', // 千織
  C099: '/card-art/C099.webp', // ナヴィア
  C100: '/card-art/C100.webp', // アルベド
  C109: '/card-art/C109.webp', // ヨォーヨ
  C110: '/card-art/C110.webp', // 綺良々
  C111: '/card-art/C111.webp', // コレイ
  C112: '/card-art/C112.webp', // カーヴェ
  C113: '/card-art/C113.webp', // ティナリ
  C114: '/card-art/C114.webp', // エミリエ
  C115: '/card-art/C115.webp', // キィニチ
}

export function getCardArtwork(cardId: string): string | undefined {
  return cardArtwork[cardId]
}
