/**
 * Minimal card model for lookups and display.
 */
export class Card {
  constructor({
    id,
    name = '',
    imageUrl = '',
    oracleText = '',
    scryfallId = '',
    illustrationId = '',
    customImageUrl = '',
  }) {
    this.id = id || name;
    this.name = name;
    this.imageUrl = imageUrl;
    this.oracleText = oracleText;
    // Art-specific fields for preserving user-selected art
    this.scryfallId = scryfallId; // Specific printing Scryfall ID
    this.illustrationId = illustrationId; // Art illustration ID
    this.customImageUrl = customImageUrl; // Direct image URL from the service
  }
}

/**
 * Factory function to create a Card instance from raw data.
 */
export const createCard = (raw = {}) => new Card(raw);
