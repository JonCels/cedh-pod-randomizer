/* eslint-disable no-console */
import { createCard } from '../src/domain/card.js';
import { Deck } from '../src/domain/deck.js';

/**
 * Run with: node ./scripts/sandbox.js
 * Make sure "type": "module" is set in package.json (CRA sets this by default for ESM).
 */
const cards = [
  createCard({ id: 'c1', name: 'Card 1', imageUrl: 'https://cards.scryfall.io/large/front/a/c/acf0cab3-da50-4561-8797-cd179af39216.jpg?1689998741' }),
  createCard({ id: 'c2', name: 'Card 2', imageUrl: 'https://example.com/c2.jpg' }),
  createCard({ id: 'c3', name: 'Card 3', imageUrl: 'https://example.com/c3.jpg' }),
  createCard({ id: 'c4', name: 'Card 4', imageUrl: 'https://example.com/c4.jpg' }),
  createCard({ id: 'c5', name: 'Card 5', imageUrl: 'https://example.com/c5.jpg' }),
  createCard({ id: 'c6', name: 'Card 6', imageUrl: 'https://example.com/c6.jpg' }),
  createCard({ id: 'c7', name: 'Card 7', imageUrl: 'https://example.com/c7.jpg' }),
  createCard({ id: 'c8', name: 'Card 8', imageUrl: 'https://example.com/c8.jpg' }),
  createCard({ id: 'c9', name: 'Card 9', imageUrl: 'https://example.com/c9.jpg' }),
  createCard({ id: 'c10', name: 'Card 10', imageUrl: 'https://example.com/c10.jpg' }),
];

const deck = new Deck({ name: 'Sandbox Deck', commanderId: 'cmdr-123', cards });

console.log('Initial deck size:', deck.cards.length);

const { hand, deck: remainingAfterHand } = deck.drawOpeningHand(7);
console.log('Opening hand:', hand.map((c) => c.name));
console.log('Remaining deck size after opening hand:', remainingAfterHand.cards.length);

const { hand: randomOne, deck: afterRandom } = remainingAfterHand.drawRandom();
console.log('Random draw:', randomOne.map((c) => c.name));
console.log('Remaining deck size after random draw:', afterRandom.cards.length);


