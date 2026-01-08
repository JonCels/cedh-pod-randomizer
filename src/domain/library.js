import { createCard } from './card.js';

/**
 * Model class for a library (stack of cards).
 */
export class Library {
  constructor({ name, commanderId = null, cards = [] } = {}) {
    this.name = name || 'Untitled Library';
    this.commanderId = commanderId;
    this.cards = cards.map((c) => (c instanceof Object ? createCard(c) : c));
  }

  /**
   * Return a new Library instance with cards shuffled (Fisher-Yates).
   */
  shuffled() {
    const next = [...this.cards];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return new Library({ name: this.name, commanderId: this.commanderId, cards: next });
  }

  /**
   * Draw N cards from the top; returns { hand, library } without mutating original.
   */
  draw(count = 1) {
    const n = Math.max(0, Math.min(count, this.cards.length));
    const hand = this.cards.slice(0, n);
    const remainder = this.cards.slice(n);
    return {
      hand,
      library: new Library({ name: this.name, commanderId: this.commanderId, cards: remainder }),
    };
  }

  /**
   * Draw an opening hand with optional mulligan (simple rebuild/shuffle).
   */
  drawOpeningHand(size = 7) {
    const shuffled = this.shuffled();
    return shuffled.draw(size);
  }

  /**
   * Draw a single random card without reshuffling the whole library.
   */
  drawRandom() {
    if (!this.cards.length) {
      return { hand: [], library: new Library({ name: this.name, commanderId: this.commanderId, cards: [] }) };
    }
    const idx = Math.floor(Math.random() * this.cards.length);
    const hand = [this.cards[idx]];
    const next = this.cards.slice(0, idx).concat(this.cards.slice(idx + 1));
    return {
      hand,
      library: new Library({ name: this.name, commanderId: this.commanderId, cards: next }),
    };
  }
}

export const createLibrary = (raw = {}) => new Library(raw);

