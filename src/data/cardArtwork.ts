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
