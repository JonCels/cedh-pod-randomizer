import { createCard } from './card.js';
import { createLibrary } from './library.js';

/**
 * Extract TopDeck tournament + player ids from a deck URL.
 * Expected format: https://topdeck.gg/deck/{tournamentId}/{playerId}
 */
export const extractTopdeckIds = (url = '') => {
  try {
    const parsed = new URL(url.trim());
    const parts = parsed.pathname.split('/').filter(Boolean);
    const deckIdx = parts.findIndex((p) => p.toLowerCase() === 'deck');
    if (deckIdx !== -1 && parts[deckIdx + 1] && parts[deckIdx + 2]) {
      return {
        tournamentId: parts[deckIdx + 1],
        playerId: parts[deckIdx + 2],
      };
    }
  } catch (e) {
    // ignore parse errors and fall back to raw parsing
  }

  const trimmed = url.trim();
  if (!trimmed.includes('/')) return null;
  const parts = trimmed.split('/').filter(Boolean);
  const deckIdx = parts.findIndex((p) => p.toLowerCase() === 'deck');
  if (deckIdx !== -1 && parts[deckIdx + 1] && parts[deckIdx + 2]) {
    return {
      tournamentId: parts[deckIdx + 1],
      playerId: parts[deckIdx + 2],
    };
  }
  return null;
};

const normalizeSectionName = (section = '') => `${section}`.trim().toLowerCase();

const addCards = (target, name, count = 1, seed = '') => {
  const qty = Number.parseInt(count, 10) || 0;
  if (!name || qty <= 0) return;
  for (let i = 0; i < qty; i += 1) {
    target.push(createCard({ id: `${name}-${seed}-${i}`, name }));
  }
};

/**
 * Parse TopDeck's structured deckObj into library and commanders.
 * Handles both array-based sections and object-mapped sections.
 */
export const parseTopdeckDeckObj = (deckObj = {}) => {
  const library = [];
  const commanders = [];

  Object.entries(deckObj || {}).forEach(([section, entries]) => {
    const sectionName = normalizeSectionName(section);
    const isCommanderSection = sectionName.includes('commander');
    const isIgnored =
      sectionName.includes('sideboard') ||
      sectionName.includes('maybe') ||
      sectionName.includes('maybeboard');
    if (isIgnored) return;

    const target = isCommanderSection ? commanders : library;

    if (Array.isArray(entries)) {
      entries.forEach((entry, idx) => {
        const name = entry?.name || entry?.card?.name || entry?.cardName;
        const count = entry?.count ?? entry?.quantity ?? entry?.qty ?? 1;
        addCards(target, name, count, `${sectionName}-${idx}`);
      });
      return;
    }

    if (entries && typeof entries === 'object') {
      Object.entries(entries).forEach(([name, entry], idx) => {
        const count = entry?.count ?? entry?.quantity ?? entry?.qty ?? 1;
        addCards(target, name, count, `${sectionName}-${idx}`);
      });
    }
  });

  return { library, commanders };
};

/**
 * Parse TopDeck decklist text into library and commanders.
 * Supports sections like "~~Commanders~~" and "~~Mainboard~~".
 */
export const parseTopdeckPlainText = (text = '') => {
  const lines = text.split(/\r?\n/);
  const library = [];
  const commanders = [];
  let section = 'main';

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    const sectionMatch = line.match(/^~~(.+?)~~$/);
    if (sectionMatch) {
      const sectionName = normalizeSectionName(sectionMatch[1]);
      if (sectionName.includes('commander')) {
        section = 'commanders';
      } else if (
        sectionName.includes('sideboard') ||
        sectionName.includes('maybe') ||
        sectionName.includes('maybeboard')
      ) {
        section = 'ignore';
      } else {
        section = 'main';
      }
      return;
    }

    if (section === 'ignore') return;
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) return;
    const [, count, name] = match;
    const target = section === 'commanders' ? commanders : library;
    addCards(target, name, count, `text-${idx}`);
  });

  return { library, commanders };
};

const isHttpUrl = (value = '') => /^https?:\/\//i.test(value.trim());

const extractDeckPayload = (data = {}) => {
  if (!data || typeof data !== 'object') return {};
  if (data.deckObj || data.decklist) {
    return {
      deckObj: data.deckObj,
      decklist: data.decklist,
      name: data.deckName || data.name || data.playerName,
    };
  }
  if (data.player && (data.player.deckObj || data.player.decklist)) {
    return {
      deckObj: data.player.deckObj,
      decklist: data.player.decklist,
      name: data.player.deckName || data.player.name,
    };
  }
  if (data.data && (data.data.deckObj || data.data.decklist)) {
    return {
      deckObj: data.data.deckObj,
      decklist: data.data.decklist,
      name: data.data.deckName || data.data.name,
    };
  }
  return {};
};

/**
 * Fetch and parse a TopDeck deck via the public API.
 * @param {string} deckUrl full TopDeck deck URL
 * @param {object} opts options
 * @param {typeof fetch} opts.fetcher custom fetch for testing
 * @param {string} opts.apiBase base URL (defaults to '/api/topdeck' proxy)
 * @param {string} opts.apiKey TopDeck API key (required for direct calls)
 * @param {Record<string,string>} opts.headers extra headers if needed
 */
export async function loadTopdeckDeckFromUrl(
  deckUrl,
  {
    fetcher = fetch,
    apiBase = process.env.REACT_APP_TOPDECK_PROXY_BASE || '/api/topdeck',
    apiKey = '',
    headers = {
      Accept: 'application/json',
    },
  } = {}
) {
  const ids = extractTopdeckIds(deckUrl);
  if (!ids?.tournamentId || !ids?.playerId) {
    throw new Error('Enter a valid TopDeck deck URL');
  }
  const needsKey = isHttpUrl(apiBase);
  if (needsKey && !apiKey) {
    throw new Error('Missing TopDeck API key');
  }

  const cleanBase = apiBase.replace(/\/+$/, '');
  const requestHeaders = apiKey ? { ...headers, Authorization: apiKey } : headers;
  const res = await fetcher(
    `${cleanBase}/v2/tournaments/${encodeURIComponent(
      ids.tournamentId
    )}/players/${encodeURIComponent(ids.playerId)}`,
    {
      headers: requestHeaders,
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const detail = body ? ` — ${body.slice(0, 200)}` : '';
    throw new Error(
      `Unable to fetch TopDeck deck (status ${res.status}${
        res.statusText ? ` ${res.statusText}` : ''
      })${detail}`
    );
  }
  const data = await res.json();
  const payload = extractDeckPayload(data);
  let parsed = null;

  if (payload.deckObj) {
    parsed = parseTopdeckDeckObj(payload.deckObj);
  } else if (payload.decklist) {
    const decklist = payload.decklist;
    if (typeof decklist === 'string' && isHttpUrl(decklist)) {
      const listRes = await fetcher(decklist);
      const text = await listRes.text();
      parsed = parseTopdeckPlainText(text);
    } else if (typeof decklist === 'string') {
      parsed = parseTopdeckPlainText(decklist);
    }
  }

  if (!parsed || (!parsed.library.length && !parsed.commanders.length)) {
    throw new Error('TopDeck decklist not available yet');
  }

  const name = payload.name || 'TopDeck Deck';
  const library = createLibrary({
    name,
    commanderId: parsed.commanders[0]?.name || null,
    cards: parsed.library,
  });

  return {
    library,
    commanders: parsed.commanders,
    name,
  };
}
