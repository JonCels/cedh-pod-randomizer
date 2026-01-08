/* eslint-disable no-console */
import { createCard } from '../src/domain/card.js';
import { Deck } from '../src/domain/deck.js';

/**
 * Run with: node ./scripts/sandbox.js
 * Make sure "type": "module" is set in package.json (CRA sets this by default for ESM).
 */
const cards = [
  createCard({ id: 'c1', name: 'Card 1', imageUrl: 'https://cards.scryfall.io/large/front/a/c/acf0cab3-da50-4561-8797-cd179af39216.jpg?1689998741' }),
  createCard({ id: 'c2', name: 'Card 2', imageUrl: 'https://cards.scryfall.io/normal/front/9/4/946ca338-5f43-4cff-bd93-1b28449c5fdc.jpg?1643589923' }),
  createCard({ id: 'c3', name: 'Card 3', imageUrl: 'https://cards.scryfall.io/large/front/b/5/b5f5fbd5-b045-4da7-a996-54f163b35b8d.jpg?1681159160' }),
  createCard({ id: 'c4', name: 'Card 4', imageUrl: 'https://cards.scryfall.io/large/front/3/3/33d94ecf-758b-4f68-a7be-6bf3ff1047f4.jpg?1709720836' }),
  createCard({ id: 'c5', name: 'Card 5', imageUrl: 'https://cards.scryfall.io/large/front/4/e/4e4fb50c-a81f-44d3-93c5-fa9a0b37f617.jpg?1639436752' }),
  createCard({ id: 'c6', name: 'Card 6', imageUrl: 'https://cards.scryfall.io/large/front/6/3/637c5910-f835-496e-b1b9-445bfb71da97.jpg?1767731352' }),
  createCard({ id: 'c7', name: 'Card 7', imageUrl: 'https://cards.scryfall.io/large/front/6/d/6da6957b-8f52-4fc9-affe-e1e0db03fbe2.jpg?1767731340' }),
  createCard({ id: 'c8', name: 'Card 8', imageUrl: 'https://cards.scryfall.io/large/front/c/8/c89c6895-b0f8-444a-9c89-c6b4fd027b3e.jpg?1745319943' }),
  createCard({ id: 'c9', name: 'Card 9', imageUrl: 'https://cards.scryfall.io/large/front/e/f/efd35cb4-862d-4699-a197-b744989b3ceb.jpg?1562943174' }),
  createCard({ id: 'c10', name: 'Card 10', imageUrl: 'https://cards.scryfall.io/large/front/2/6/26cee543-6eab-494e-a803-33a5d48d7d74.jpg?1562902883' }),
];

const deck = new Deck({ name: 'Sandbox Deck', commanderId: 'cmdr-123', cards });

console.log('Initial deck size:', deck.cards.length);

const { hand, deck: remainingAfterHand } = deck.drawOpeningHand(7);
console.log('Opening hand:', hand.map((c) => c.name));
console.log('Remaining deck size after opening hand:', remainingAfterHand.cards.length);

const { hand: randomOne, deck: afterRandom } = remainingAfterHand.drawRandom();
console.log('Random draw:', randomOne.map((c) => c.name));
console.log('Remaining deck size after random draw:', afterRandom.cards.length);


