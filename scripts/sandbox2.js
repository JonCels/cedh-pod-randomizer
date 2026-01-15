/* eslint-disable no-console */
import readline from 'node:readline/promises';
import process from 'node:process';

/**
 * Run with: node ./scripts/sandbox2.js
 * Paste a Moxfield deck link (e.g., https://www.moxfield.com/decks/abcd1234).
 * This script calls the upstream Moxfield API directly using your local env var:
 *   MOXFIELD_USER_AGENT="MoxKey; …"
 * Optionally set MOXFIELD_API_KEY and MOXFIELD_BASE_URL (defaults to https://api2.moxfield.com/v2).
 */
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const url = await rl.question('Paste Moxfield deck URL: ');
  rl.close();
  
  const m = url.match(/\/decks\/([^/]+)/);
  if (!m) {
    console.error('Could not extract deckId from URL. Expected https://www.moxfield.com/decks/<id>');
    return;
  }
  const deckId = m[1];
  
  const userAgent = process.env.MOXFIELD_USER_AGENT || '';
  const apiKey = process.env.MOXFIELD_API_KEY || '';
  const baseUrl = process.env.MOXFIELD_BASE_URL || 'https://api2.moxfield.com/v2';
  if (!userAgent) {
    console.error('MOXFIELD_USER_AGENT is not set. Set it in your shell before running.');
    return;
  }

  
  const upstreamUrl = `${baseUrl}/decks/all/${encodeURIComponent(deckId)}`;
  console.log(`Fetching ${upstreamUrl} ...`);

  try {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
    };
    if (apiKey) {
      headers['X-Moxfield-Key'] = apiKey;
    }

    console.log('Headers:', headers);
    const res = await fetch(upstreamUrl, { headers });
    const text = await res.text();
    console.log('Status:', res.status);
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.log('Raw body:\n', text);
      return;
    }

    if (!json || !json.mainboard || !json.commanders) {
      console.log('Unexpected shape, raw body:\n', text);
      return;
    }

    const toArray = (value) => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') return Object.values(value);
      return [];
    };

    const formatCards = (cards) =>
      toArray(cards).map((c) => {
        const name = c.card?.name || c.name || c.cardName || 'Unknown';
        const qty = c.quantity ?? c.qty ?? c.count ?? 1;
        const scryfall = c.card?.scryfall_id || c.scryfall_id || c.card?.scryfallId || 'n/a';
        return { name, qty, scryfall };
      });

    const mainboard = formatCards(json.mainboard);
    const commanders = formatCards(json.commanders);

    console.log('\n=== Mainboard ===');
    mainboard.forEach((c) => {
      console.log(`${c.qty}x ${c.name} (scryfall_id: ${c.scryfall})`);
    });

    console.log('\n=== Commanders ===');
    commanders.forEach((c) => {
      console.log(`${c.qty}x ${c.name} (scryfall_id: ${c.scryfall})`);
    });
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

