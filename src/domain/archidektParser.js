import { createCard } from './card.js';
import { createLibrary } from './library.js';
import { resolveProxyBase } from '../api/proxyBase.js';

/**
 * Extract an Archidekt deck id from a URL or raw id.
 */
export const extractArchidektId = (url = '') => {
  try {
    const parsed = new URL(url.trim());
    const parts = parsed.pathname.split('/').filter(Boolean);
    const decksIdx = parts.findIndex((p) => p.toLowerCase() === 'decks');
    if (decksIdx !== -1 && parts[decksIdx + 1]) {
      return parts[decksIdx + 1];
    }
  } catch (e) {
    // ignore parse errors and fall back to raw id
  }
  const trimmed = url.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  return '';
};

/**
 * Parse the Archidekt deck payload into library and commanders.
 * @param {object} data raw response from /api/decks/{id}/
 */
export const parseArchidektDeckData = (data = {}) => {
  const cards = data?.cards || [];
  const library = [];
  const commanders = [];

  const normalizeName = (entry = {}) =>
    entry?.card?.oracleCard?.name ||
    entry?.card?.name ||
    entry?.card?.frontFace?.name ||
    entry?.card?.backFace?.name ||
    entry?.card?.uidName ||
    '';

  cards.forEach((entry, idx) => {
    if (!entry) return;
    const categories = (entry.categories || []).map((c) => `${c}`.toLowerCase());
    const board = `${entry.board || entry.section || ''}`.toLowerCase();
    const isSideboard =
      entry.sideboard ||
      categories.some((c) => c.includes('sideboard')) ||
      board.includes('sideboard');
    const isMaybeboard =
      entry.maybeboard ||
      categories.some((c) => c.includes('maybeboard') || c.includes('maybe')) ||
      board.includes('maybe');
    if (isSideboard || isMaybeboard) return;
    const name = normalizeName(entry);
    if (!name) return;

    const qty = Number.parseInt(entry.quantity ?? entry.count ?? 1, 10) || 1;
    const isCommander =
      Array.isArray(entry.categories) &&
      entry.categories.some((c) => (c || '').toLowerCase().includes('commander'));

    const target = isCommander ? commanders : library;
    for (let i = 0; i < qty; i += 1) {
      target.push(
        createCard({
          id: `${name}-${idx}-${i}`,
          name,
        })
      );
    }
  });

  return { library, commanders };
};

/**
 * Fetch and parse an Archidekt deck via the public API.
 * @param {string} deckUrl full deck URL or numeric id
 * @param {object} opts options
 * @param {typeof fetch} opts.fetcher custom fetch for testing
 * @param {string} opts.apiBase base URL (defaults to '/api/archidekt' for proxying)
 * @param {Record<string,string>} opts.headers extra headers if needed
 */
export async function loadArchidektDeckFromUrl(
  deckUrl,
  {
    fetcher = fetch,
    apiBase = resolveProxyBase(process.env.REACT_APP_ARCHIDEKT_PROXY_BASE, '/api/archidekt'),
    headers = {
      Accept: 'application/json',
    },
  } = {}
) {
  const id = extractArchidektId(deckUrl);
  if (!id) {
    throw new Error('Enter a valid Archidekt deck URL');
  }

  const cleanBase = apiBase.replace(/\/+$/, '');
  const res = await fetcher(`${cleanBase}/api/decks/${encodeURIComponent(id)}/`, {
    headers,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const detail = body ? ` — ${body.slice(0, 200)}` : '';
    throw new Error(
      `Unable to fetch Archidekt deck (status ${res.status}${
        res.statusText ? ` ${res.statusText}` : ''
      })${detail}`
    );
  }
  const data = await res.json();
  const parsed = parseArchidektDeckData(data);
  const library = createLibrary({
    name: data?.name || 'Archidekt Deck',
    commanderId: parsed.commanders[0]?.name || null,
    cards: parsed.library,
  });

  return {
    library,
    commanders: parsed.commanders,
    name: data?.name || 'Archidekt Deck',
  };
}


