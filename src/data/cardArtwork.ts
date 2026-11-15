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
}

export function getCardArtwork(cardId: string): string | undefined {
  return cardArtwork[cardId]
}
