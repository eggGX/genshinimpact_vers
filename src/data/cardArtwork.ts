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
}

export function getCardArtwork(cardId: string): string | undefined {
  return cardArtwork[cardId]
}
