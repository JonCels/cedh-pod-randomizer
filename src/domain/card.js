/**
 * Minimal card model for lookups and display.
 */
export class Card {
  constructor({
    id,
    name = '',
    imageUrl = '',
    oracleText = '',
  }) {
    this.id = id || name;
    this.name = name;
    this.imageUrl = imageUrl;
    this.oracleText = oracleText;
  }
}

/**
 * Factory function to create a Card instance from raw data.
 */
export const createCard = (raw = {}) => new Card(raw);
