import { Deck, createDeck } from '../deck';
import { createCard } from '../card';

const sampleCards = (n) =>
  Array.from({ length: n }, (_, i) => createCard({ id: `c${i}`, name: `Card ${i}` }));

describe('Deck', () => {
  it('creates a deck with defaults', () => {
    const d = new Deck();
    expect(d.name).toBe('Untitled Deck');
    expect(d.commanderId).toBeNull();
    expect(d.cards).toEqual([]);
  });

  it('shuffles without mutating original', () => {
    const cards = sampleCards(5);
    const d = new Deck({ cards });
    const shuffled = d.shuffled();
    expect(shuffled.cards).toHaveLength(5);
    expect(d.cards).toHaveLength(5);
    expect(shuffled.cards).not.toBe(d.cards);
  });

  it('draw returns hand and remaining deck', () => {
    const d = new Deck({ cards: sampleCards(3) });
    const { hand, deck } = d.draw(2);
    expect(hand).toHaveLength(2);
    expect(deck.cards).toHaveLength(1);
  });

  it('draw caps at deck size', () => {
    const d = new Deck({ cards: sampleCards(2) });
    const { hand, deck } = d.draw(5);
    expect(hand).toHaveLength(2);
    expect(deck.cards).toHaveLength(0);
  });

  it('drawRandom pulls one card and shrinks deck', () => {
    const d = new Deck({ cards: sampleCards(4) });
    const { hand, deck } = d.drawRandom();
    expect(hand).toHaveLength(1);
    expect(deck.cards).toHaveLength(3);
  });

  it('drawOpeningHand returns 7 and remaining deck', () => {
    const d = new Deck({ cards: sampleCards(10) });
    const { hand, deck } = d.drawOpeningHand(7);
    expect(hand).toHaveLength(7);
    expect(deck.cards).toHaveLength(3);
  });
});

