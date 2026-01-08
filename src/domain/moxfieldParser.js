import { createCard } from './card.js';

/**
 * Parse a Moxfield "Copy Plain Text" decklist into library and commanders.
 * Removes any sideboard block if present; any counted lines after the sideboard and a blank
 * are treated as commanders. If no sideboard header is present, everything is treated as main.
 * @param {string} text
 * @returns {{library: import('./card.js').Card[], commanders: import('./card.js').Card[]}}
 */
export function parseMoxfieldPlainText(text = '') {
  const lines = text.split(/\r?\n/);

  const library = [];
  const commanders = [];

  let section = 'main'; // main | sideboard | commanders
  let sawSideboard = false;
  let promotedToCommanders = false;

  const addCards = (target, count, name) => {
    const n = Number.parseInt(count, 10) || 0;
    for (let i = 0; i < n; i += 1) {
      target.push(createCard({ id: `${name}-${i}`, name }));
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (section === 'sideboard') {
        section = 'commanders';
        promotedToCommanders = true;
      }
      continue;
    }

    if (/^sideboard[:]?$/i.test(line)) {
      section = 'sideboard';
      sawSideboard = true;
      continue;
    }

    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) continue;

    const [, count, name] = match;

    if (section === 'main') {
      addCards(library, count, name);
    } else if (section === 'sideboard') {
      // ignore sideboard entries
      continue;
    } else if (section === 'commanders') {
      addCards(commanders, count, name);
    }
  }

  return { library, commanders };
}

