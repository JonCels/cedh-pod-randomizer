import { createCard } from './card.js';
import { createLibrary } from './library.js';
import { resolveProxyBase } from '../api/proxyBase.js';

/**
 * Extract a deck id from a Moxfield URL or return the raw string if it looks like an id.
 */
export const extractMoxfieldId = (url = '') => {
  try {
    const parsed = new URL(url.trim());
    const parts = parsed.pathname.split('/').filter(Boolean);
    const decksIdx = parts.findIndex((p) => p.toLowerCase() === 'decks');
    if (decksIdx !== -1 && parts[decksIdx + 1]) {
      return parts[decksIdx + 1];
    }
    if (!url.includes('/')) return url.trim();
  } catch (e) {
    // ignore parse errors
  }
  return '';
};

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

const boardToLines = (board = {}) => {
  const lines = [];
  Object.values(board || {}).forEach((entry) => {
    if (!entry) return;
    const qty = entry.quantity ?? entry.count ?? entry.qty ?? 1;
    const name = entry.card?.name || entry.name;
    if (!name) return;
    lines.push(`${qty} ${name}`);
  });
  return lines;
};

const boardToCards = (board = {}) => {
  const cards = [];
  Object.values(board || {}).forEach((entry) => {
    if (!entry) return;
    const qty = entry.quantity ?? entry.count ?? entry.qty ?? 1;
    const name = entry.card?.name || entry.name;
    if (!name) return;

    // Extract art information from Moxfield's card object
    const cardData = entry.card || {};
    const scryfallId = cardData.id || cardData.scryfall_id || '';
    const illustrationId = cardData.illustration_id || '';
    const customImageUrl = cardData.image_url || cardData.art_crop_url || '';

    for (let i = 0; i < qty; i += 1) {
      cards.push(createCard({
        id: `${name}-${scryfallId || 'default'}-${i}`,
        name,
        scryfallId,
        illustrationId,
        customImageUrl,
      }));
    }
  });
  return cards;
};

/**
 * Convert the Moxfield deck API response into the plain-text format our parser expects.
 * @param {object} data raw response from /v2/decks/all/{id}
 */
export const buildPlainTextFromApiDeck = (data = {}) => {
  const lines = [];
  lines.push(...boardToLines(data.mainboard));
  lines.push('');
  lines.push('SIDEBOARD:');
  lines.push('');
  lines.push(...boardToLines(data.commanders));
  return lines.join('\n');
};

/**
 * Parse Moxfield deck API response directly into structured card data.
 * @param {object} data raw response from /v2/decks/all/{id}
 */
export const parseMoxfieldApiDeck = (data = {}) => {
  const library = [];
  const commanders = [];

  // Parse mainboard (excluding sideboard and commanders)
  if (data.mainboard) {
    library.push(...boardToCards(data.mainboard));
  }

  // Parse commanders separately
  if (data.commanders) {
    commanders.push(...boardToCards(data.commanders));
  }

  return { library, commanders };
};

/**
 * Fetch and parse a Moxfield deck using the public API (requires proxy/headers to avoid CORS).
 * @param {string} deckUrl full deck URL or id
 * @param {object} opts options
 * @param {typeof fetch} opts.fetcher custom fetch for testing
 * @param {string} opts.apiBase base URL (defaults to '/api/moxapi' so a proxy can inject auth/UA)
 * @param {Record<string,string>} opts.headers extra headers (user-agent, auth) if needed
 */
export async function loadMoxfieldDeckFromUrl(
  deckUrl,
  {
    fetcher = fetch,
    apiBase = resolveProxyBase(process.env.REACT_APP_MOXFIELD_PROXY_BASE, '/api/moxapi'),
    headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  } = {}
) {
  const id = extractMoxfieldId(deckUrl);
  if (!id) {
    throw new Error('Enter a valid Moxfield deck URL');
  }

  const res = await fetcher(`${apiBase}/v2/decks/all/${encodeURIComponent(id)}`, {
    headers,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const detail = body ? ` — ${body.slice(0, 200)}` : '';
    throw new Error(
      `Unable to fetch deck (status ${res.status}${res.statusText ? ` ${res.statusText}` : ''})${detail}`
    );
  }
  const data = await res.json();
  const parsed = parseMoxfieldApiDeck(data);
  const library = createLibrary({
    name: data?.name || 'Moxfield Deck',
    commanderId: parsed.commanders[0]?.name || null,
    cards: parsed.library,
  });
  return {
    library,
    commanders: parsed.commanders,
    name: data?.name || 'Moxfield Deck',
  };
}

