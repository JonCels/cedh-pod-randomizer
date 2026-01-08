import { Library, createLibrary } from '../library.js';
import { createCard } from '../card.js';

const sampleCards = (n) =>
  Array.from({ length: n }, (_, i) => createCard({ id: `c${i}`, name: `Card ${i}` }));

describe('Library', () => {
  it('creates a library with defaults', () => {
    const lib = new Library();
    expect(lib.name).toBe('Untitled Library');
    expect(lib.commanderId).toBeNull();
    expect(lib.cards).toEqual([]);
  });

  it('shuffles without mutating original', () => {
    const cards = sampleCards(5);
    const lib = new Library({ cards });
    const shuffled = lib.shuffled();
    expect(shuffled.cards).toHaveLength(5);
    expect(lib.cards).toHaveLength(5);
    expect(shuffled.cards).not.toBe(lib.cards);
  });

  it('draw returns hand and remaining library', () => {
    const lib = new Library({ cards: sampleCards(3) });
    const { hand, library } = lib.draw(2);
    expect(hand).toHaveLength(2);
    expect(library.cards).toHaveLength(1);
  });

  it('draw caps at library size', () => {
    const lib = new Library({ cards: sampleCards(2) });
    const { hand, library } = lib.draw(5);
    expect(hand).toHaveLength(2);
    expect(library.cards).toHaveLength(0);
  });

  it('drawRandom pulls one card and shrinks library', () => {
    const lib = new Library({ cards: sampleCards(4) });
    const { hand, library } = lib.drawRandom();
    expect(hand).toHaveLength(1);
    expect(library.cards).toHaveLength(3);
  });

  it('drawOpeningHand returns 7 and remaining library', () => {
    const lib = new Library({ cards: sampleCards(10) });
    const { hand, library } = lib.drawOpeningHand(7);
    expect(hand).toHaveLength(7);
    expect(library.cards).toHaveLength(3);
  });

  it('createLibrary wraps raw data', () => {
    const lib = createLibrary({ name: 'X', cards: sampleCards(1) });
    expect(lib).toBeInstanceOf(Library);
    expect(lib.cards).toHaveLength(1);
  });
});

