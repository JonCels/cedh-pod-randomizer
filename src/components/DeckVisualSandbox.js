import { useMemo, useState } from 'react';
import { createCard } from '../domain/card.js';
import { Deck } from '../domain/deck.js';

const sampleCards = Array.from({ length: 10 }, (_, i) =>
  createCard({
    id: `c${i + 1}`,
    name: `Card ${i + 1}`,
    imageUrl: `https://via.placeholder.com/200x280/1f2937/ffffff?text=Card+${i + 1}`,
  })
);

const makeDeck = () => new Deck({ name: 'Sandbox Deck', cards: sampleCards });

export function DeckVisualSandbox() {
  const [deck, setDeck] = useState(makeDeck);
  const [drawn, setDrawn] = useState([]);

  const remainingIds = useMemo(() => new Set(deck.cards.map((c) => c.id)), [deck]);

  const handleDrawRandom = () => {
    const { hand, deck: next } = deck.drawRandom();
    setDrawn((prev) => [...prev, ...hand]);
    setDeck(next);
  };

  const handleDrawOpeningHand = () => {
    const { hand, deck: next } = deck.drawOpeningHand(7);
    setDrawn((prev) => [...prev, ...hand]);
    setDeck(next);
  };

  const handleReset = () => {
    setDeck(makeDeck());
    setDrawn([]);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.controls}>
        <button type="button" onClick={handleDrawRandom} disabled={!deck.cards.length}>
          Draw Random
        </button>
        <button
          type="button"
          onClick={handleDrawOpeningHand}
          disabled={deck.cards.length < 1}
        >
          Draw Opening Hand (7)
        </button>
        <button type="button" onClick={handleReset}>
          Reset Deck
        </button>
        <div style={styles.status}>
          Remaining: {deck.cards.length} | Drawn: {drawn.length}
        </div>
      </div>

      <h3>Deck (face down)</h3>
      <div style={styles.grid}>
        {deck.cards.map((card) => (
          <div key={card.id} style={styles.card}>
            <img src={card.imageUrl} alt={card.name} style={styles.img} />
            <div style={styles.caption}>{card.name}</div>
          </div>
        ))}
        {!deck.cards.length && <div style={styles.empty}>Deck empty</div>}
      </div>

      <h3>Drawn</h3>
      <div style={styles.grid}>
        {drawn.map((card) => (
          <div key={card.id} style={styles.card}>
            <img src={card.imageUrl} alt={card.name} style={styles.img} />
            <div style={styles.caption}>{card.name}</div>
          </div>
        ))}
        {!drawn.length && <div style={styles.empty}>No cards drawn yet</div>}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { padding: '1rem', color: '#e2e8f0' },
  controls: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: '1rem',
  },
  status: { fontSize: '0.95rem', color: '#cbd5e1', marginLeft: '0.5rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  card: {
    background: '#0b1220',
    border: '1px solid #1f2937',
    borderRadius: '10px',
    padding: '0.35rem',
    textAlign: 'center',
  },
  img: {
    width: '100%',
    borderRadius: '8px',
    display: 'block',
  },
  caption: {
    marginTop: '0.35rem',
    fontSize: '0.9rem',
    color: '#cbd5e1',
  },
  empty: { color: '#94a3b8' },
};

