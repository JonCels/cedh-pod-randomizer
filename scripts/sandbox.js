/* eslint-disable no-console */
import readline from 'node:readline/promises';
import { parseMoxfieldPlainText } from '../src/domain/moxfieldParser.js';
import { Library } from '../src/domain/library.js';

/**
 * Run with: node ./scripts/sandbox.js
 * Paste a Moxfield "Copy Plain Text" list, then press Ctrl+D (macOS/Linux) or Ctrl+Z Enter (Windows).
 */
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('Paste your decklist (Moxfield "Copy Plain Text"), then Ctrl+D / Ctrl+Z Enter to submit:');

  const lines = [];
  for await (const line of rl) {
    lines.push(line);
  }
  rl.close();

  const text = lines.join('\n');
  if (!text.trim()) {
    console.log('No input provided. Exiting.');
    return;
  }

  const { library, commanders } = parseMoxfieldPlainText(text);
  console.log(`Parsed ${library.length} cards; commanders: ${commanders.map((c) => c.name).join(', ') || 'none'}`);

  const lib = new Library({ name: 'User Library', cards: library });
  const { hand } = lib.drawOpeningHand(7);
  console.log('Opening hand:');
  hand.forEach((c, idx) => {
    console.log(`${idx + 1}. ${c.name}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
