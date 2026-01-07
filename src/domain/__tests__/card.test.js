import { Card, createCard } from '../card';

describe('Card', () => {
  it('creates a card with defaults', () => {
    const c = new Card({ id: '1' });
    expect(c.id).toBe('1');
    expect(c.name).toBe('');
    expect(c.imageUrl).toBe('');
    expect(c.oracleText).toBe('');
  });

  it('honors provided fields', () => {
    const c = new Card({
      id: '310',
      name: 'Omnath, Locus of Mana',
      imageUrl: 'https://cards.scryfall.io/large/front/a/c/acf0cab3-da50-4561-8797-cd179af39216.jpg?1689998741',
      oracleText: 'You don’t lose unspent green mana as steps and phases end.\n\nOmnath gets +1/+1 for each unspent green mana you have.',

    });
    expect(c.id).toBe('310');
    expect(c.name).toBe('Omnath, Locus of Mana');
    expect(c.imageUrl).toBe('https://cards.scryfall.io/large/front/a/c/acf0cab3-da50-4561-8797-cd179af39216.jpg?1689998741');
    expect(c.oracleText).toBe('You don’t lose unspent green mana as steps and phases end.\n\nOmnath gets +1/+1 for each unspent green mana you have.');
  });

  it('createCard wraps raw data', () => {
    const c = createCard({ id: 'x', name: 'Y' });
    expect(c).toBeInstanceOf(Card);
    expect(c.id).toBe('x');
    expect(c.name).toBe('Y');
  });
});

