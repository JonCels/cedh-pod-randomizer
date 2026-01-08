import { parseMoxfieldPlainText } from '../moxfieldParser.js';

const sample = `
1 Ad Nauseam
1 An Offer You Can't Refuse
1 Ancient Tomb
1 Angel's Grace
1 Arcane Signet
1 Arid Mesa
1 Beseech the Mirror
1 Bloodstained Mire
1 Borne Upon a Wind
1 Cabal Ritual
1 Chain of Vapor
1 Chrome Mox
1 City of Brass
1 City of Traitors
1 Command Tower
1 Crystal Vein
1 Culling the Weak
1 Dark Ritual
1 Dauthi Voidwalker
1 Delney, Streetwise Lookout
1 Demonic Consultation
1 Demonic Tutor
1 Diabolic Intent
1 Drannith Magistrate
1 Emergence Zone
1 Enlightened Tutor
1 Esper Sentinel
1 Faerie Mastermind
1 Fierce Guardianship
1 Flare of Denial
1 Flooded Strand
1 Flusterstorm
1 Force of Negation
1 Force of Will
1 Gemstone Caverns
1 Gifts Ungiven
1 Godless Shrine
1 Grafdigger's Cage
1 Grand Abolisher
1 Grim Hireling
1 Grim Monolith
1 Hallowed Fountain
1 High Fae Trickster
1 Imperial Seal
1 Imposter Mech
1 Kitesail Larcenist
1 Lively Dirge
1 Lotho, Corrupt Shirriff
1 Lotus Petal
1 Mana Confluence
1 Mana Vault
1 Marsh Flats
1 Mental Misstep
1 Mindbreak Trap
1 Misty Rainforest
1 Mockingbird
1 Morphic Pool
1 Mox Amber
1 Mox Diamond
1 Mox Opal
1 Mystic Remora
1 Mystical Tutor
1 Necropotence
1 Opposition Agent
1 Orcish Bowmasters
1 Otawara, Soaring City
1 Pact of Negation
1 Polluted Delta
1 Praetor's Grasp
1 Ranger-Captain of Eos
1 Reanimate
1 Rhystic Study
1 Scalding Tarn
1 Scheming Symmetry
1 Scrubland
1 Serra Ascendant
1 Silence
1 Siren Stormtamer
1 Smothering Tithe
1 Snapcaster Mage
1 Sol Ring
1 Spectral Sailor
1 Spyglass Siren
1 Swan Song
1 Tainted Pact
1 Talisman of Dominance
1 Thassa's Oracle
1 Time Sieve
1 Tundra
1 Undercity Sewers
1 Underground Sea
1 Vampiric Tutor
1 Verdant Catacombs
1 Vexing Bauble
1 Voice of Victory
1 Wan Shi Tong, Librarian
1 Watery Grave
1 Wishclaw Talisman

SIDEBOARD:
1 Changeling Outcast

1 Malcolm, Keen-Eyed Navigator
1 Tymna the Weaver
`.trim();

describe('parseMoxfieldPlainText', () => {
  it('parses library and commanders, ignoring sideboard', () => {
    const { library, commanders } = parseMoxfieldPlainText(sample);
    expect(library.some((c) => c.name === 'Ad Nauseam')).toBe(true);
    expect(library.some((c) => c.name === 'An Offer You Can\'t Refuse')).toBe(true);
    expect(library.some((c) => c.name === 'Wishclaw Talisman')).toBe(true);
    expect(commanders.map((c) => c.name)).toEqual([
      'Malcolm, Keen-Eyed Navigator',
      'Tymna the Weaver',
    ]);
  });

  it('handles empty or malformed input gracefully', () => {
    const { library, commanders } = parseMoxfieldPlainText('');
    expect(library).toEqual([]);
    expect(commanders).toEqual([]);
  });
});

