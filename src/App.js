import { useCallback, useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Grid from '@mui/material/Grid';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import DrawIcon from '@mui/icons-material/Style'; // Using Style as a card icon
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import CasinoIcon from '@mui/icons-material/Casino';
import './App.css';
import { queryGraphQL, getCommanderEntries } from './api/edhTop16';
import {
  loadMoxfieldDeckFromUrl,
  extractMoxfieldId,
} from './domain/moxfieldParser';
import {
  loadArchidektDeckFromUrl,
  extractArchidektId,
} from './domain/archidektParser';
import {
  loadTopdeckDeckFromUrl,
  extractTopdeckIds,
} from './domain/topdeckParser';
import { createLibrary } from './domain/library.js';

function App() {
  const [commanders, setCommanders] = useState([]);
  const [selection, setSelection] = useState([]);
  const [seatAssignments, setSeatAssignments] = useState([]);
  const [userSeat, setUserSeat] = useState(1);
  const [imageCache, setImageCache] = useState({});
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    timePeriod: 'THREE_MONTHS',
    minTournamentSize: '',
    minEntries: '',
    count: 50,
  });
  const [pendingFilters, setPendingFilters] = useState({
    timePeriod: 'THREE_MONTHS',
    minTournamentSize: '',
    minEntries: '',
    count: 50,
  });
  const [deckUrl, setDeckUrl] = useState('');
  const [deckLoading, setDeckLoading] = useState(false);
  const [deckError, setDeckError] = useState(null);
  const [deckStatus, setDeckStatus] = useState('');
  const [userLibrary, setUserLibrary] = useState(null);
  const [originalUserLibrary, setOriginalUserLibrary] = useState(null);
  const [userHand, setUserHand] = useState([]);
  const [userCommanders, setUserCommanders] = useState([]);
  const [deckNameCounts, setDeckNameCounts] = useState({});
  const [deckLinks, setDeckLinks] = useState({});
  const [deckLinksLoading, setDeckLinksLoading] = useState(false);
  const [deckLinksError, setDeckLinksError] = useState(null);
  const [opponentDeckChoices, setOpponentDeckChoices] = useState([]);
  const [opponentLibraries, setOpponentLibraries] = useState({});
  const [opponentDraws, setOpponentDraws] = useState({});
  const [opponentDeckLoading, setOpponentDeckLoading] = useState(false);
  const [opponentDeckErrors, setOpponentDeckErrors] = useState({});
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPasteDecklist, setShowPasteDecklist] = useState(false);
  const [pasteDecklistText, setPasteDecklistText] = useState('');
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [handImagesLoading, setHandImagesLoading] = useState(false);
  const [showGlobalLoading, setShowGlobalLoading] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  const getNameParts = (name) => {
    if (!name) return [];
    // Treat "//" as a single commander (double-faced), not partners.
    if (name.includes('//')) return [name.trim()];
    return name
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);
  };

  const isDoubleFaced = (name) => name?.includes('//');

  const weightedSampleWithReplacement = (items, count, getWeight) => {
    if (!items.length || count <= 0) return [];
    const weights = items.map((item) => Math.max(getWeight(item) || 0, 0));
    const total = weights.reduce((sum, w) => sum + w, 0);
    const effectiveTotal = total > 0 ? total : items.length;

    const pickOne = () => {
      const target = Math.random() * effectiveTotal;
      let running = 0;
      for (let i = 0; i < items.length; i += 1) {
        running += total > 0 ? weights[i] : 1;
        if (running >= target) return items[i];
      }
      return items[items.length - 1];
    };

    return Array.from({ length: count }, pickOne);
  };

  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const normalizeAndSortEntries = useCallback((entries = []) => {
    const normalized = entries
      .map((entry) => ({
        decklist: entry?.decklist,
        standing:
          entry?.standing === 0 || entry?.standing
            ? Number(entry.standing)
            : Number.POSITIVE_INFINITY,
        tournamentName: entry?.tournament?.name || '',
        tournamentDate: entry?.tournament?.tournamentDate || '',
        eventSize:
          entry?.tournament?.size === 0 || entry?.tournament?.size
            ? Number(entry.tournament.size)
            : 0,
      }))
      .filter((e) => e.decklist);

    normalized.sort((a, b) => {
      if (a.standing !== b.standing) return a.standing - b.standing;
      if (a.eventSize !== b.eventSize) return b.eventSize - a.eventSize;
      const dateA = a.tournamentDate ? Date.parse(a.tournamentDate) || 0 : 0;
      const dateB = b.tournamentDate ? Date.parse(b.tournamentDate) || 0 : 0;
      if (dateA !== dateB) return dateB - dateA;
      return 0; // stable on fetch order if still tied
    });

    return normalized;
  }, []);

  const rollSelection = (list = commanders) => {
    const picks = weightedSampleWithReplacement(
      list,
      3,
      (c) => c?.stats?.metaShare ?? 0
    );
    const seats = shuffle([1, 2, 3, 4]);
    setUserSeat(seats[0]);
    setSeatAssignments(seats.slice(1, 1 + picks.length));
    setSelection(picks);
  };

  // Fetch commander images from Scryfall (fallback if API has none).
  useEffect(() => {
    const fetchMissingImages = async () => {
      const namesToFetch = new Set();
      selection.forEach((c) => {
        if (!c) return;
        const parts = getNameParts(c.name);
        parts.forEach((p) => {
          if (!imageCache[p]) namesToFetch.add(p);
        });
        const needsDfFaces =
          isDoubleFaced(c.name) && !imageCache[c.name]; // fetch even if API gave single-face art
        if (!imageCache[c.name] && (!c.cardDetail?.cardPreviewImageUrl || needsDfFaces)) {
          namesToFetch.add(c.name);
        }
      });
      if (!namesToFetch.size) return;

      const results = await Promise.all(
        Array.from(namesToFetch).map(async (name) => {
          // Find the card object to get art info
          const card = selection.find(c => c.name === name);
          const urls = await fetchImageUrls(name, card);
          return { name, urls };
        })
      );

      setImageCache((prev) => {
        const next = { ...prev };
        results.forEach(({ name, urls }) => {
          if (name && urls?.length) next[name] = urls;
        });
        return next;
      });
    };

    fetchMissingImages();
  }, [selection, imageCache]);

  useEffect(() => {
    const fetchUserCommanderImages = async () => {
      const names = userCommanders.map((c) => c?.name).filter(Boolean);
      const namesToFetch = names.filter((n) => !imageCache[n]);
      if (!namesToFetch.length) return;
      const results = await Promise.all(
        namesToFetch.map(async (name) => {
          // Find the card object to get art info
          const card = userCommanders.find(c => c.name === name);
          const urls = await fetchImageUrls(name, card);
          return { name, urls };
        })
      );
      setImageCache((prev) => {
        const next = { ...prev };
        results.forEach(({ name, urls }) => {
          if (name && urls?.length) next[name] = urls;
        });
        return next;
      });
    };
    fetchUserCommanderImages();
  }, [userCommanders, imageCache]);

  useEffect(() => {
    const fetchHandImages = async () => {
      const cards = userHand.filter((c) => c?.name && !imageCache[c.name]);
      if (!cards.length) {
        setHandImagesLoading(false);
        setShowGlobalLoading(false);
        return;
      }

      // Only show global loading for explicit global loading requests
      if (showGlobalLoading) {
        setHandImagesLoading(true);
      }

      const batch = await fetchHandBatchImages(cards);
      const results = Object.entries(batch).map(([name, urls]) => ({ name, urls }));
      setImageCache((prev) => {
        const next = { ...prev };
        results.forEach(({ name, urls }) => {
          if (name && urls?.length) next[name] = urls;
        });
        return next;
      });

      setHandImagesLoading(false);
      setShowGlobalLoading(false);
    };
    fetchHandImages();
  }, [userHand, imageCache, showGlobalLoading]);

  useEffect(() => {
    const fetchOpponentDrawImages = async () => {
      const cards = Object.values(opponentDraws)
        .filter((c) => c?.name && !imageCache[c.name]);
      if (!cards.length) return;
      const batch = await fetchHandBatchImages(cards);
      const results = Object.entries(batch).map(([name, urls]) => ({ name, urls }));
      setImageCache((prev) => {
        const next = { ...prev };
        results.forEach(({ name, urls }) => {
          if (name && urls?.length) next[name] = urls;
        });
        return next;
      });
    };
    fetchOpponentDrawImages();
  }, [opponentDraws, imageCache]);

  const loadCommanders = async (activeFilters = filters) => {
    setIsLoading(true);
    setError(null);
    try {
      const desired = Number(activeFilters.count) > 0 ? Number(activeFilters.count) : 50;
      const fetchSize = desired + 5; // oversample to absorb filtered-out entries
      const minTournamentSizeVal =
        activeFilters.minTournamentSize === ''
          ? null
          : Number(activeFilters.minTournamentSize);
      const minEntriesVal =
        activeFilters.minEntries === '' ? null : Number(activeFilters.minEntries);

      const data = await queryGraphQL({
        query: `
          query Commanders(
            $first: Int!
            $timePeriod: TimePeriod!
            $minTournamentSize: Int
            $minEntries: Int
          ) {
            commanders(
              first: $first
              sortBy: POPULARITY
              timePeriod: $timePeriod
              minTournamentSize: $minTournamentSize
              minEntries: $minEntries
            ) {
              edges {
                node {
                  id
                  name
                  colorId
                  cardDetail {
                    cardPreviewImageUrl
                    imageUrls
                  }
                  stats(filters: { timePeriod: $timePeriod }) {
                    conversionRate
                    metaShare
                    topCuts
                    count
                  }
                }
              }
            }
          }
        `,
        variables: {
          first: fetchSize,
          timePeriod: activeFilters.timePeriod,
          minTournamentSize: minTournamentSizeVal,
          minEntries: minEntriesVal,
        },
      });
      const edges = data?.commanders?.edges || [];
      const list = edges
        .map((edge) => edge.node)
        .filter((c) => {
          const name = c?.name?.toLowerCase?.() || '';
          return name && name !== 'other' && name !== 'unknown';
        })
        .slice(0, desired);
      setCommanders(list);
      rollSelection(list);
    } catch (err) {
      setError(err.message || 'Unable to fetch commanders');
      // Surface details for debugging.
      // eslint-disable-next-line no-console
      console.error('EDHTOP16 fetch failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCommanders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => {
    setFilters(pendingFilters);
    loadCommanders(pendingFilters);
  };

  useEffect(() => {
    const fetchDeckLinks = async () => {
      const names = selection.map((c) => c?.name).filter(Boolean);
      if (!names.length) {
        setDeckLinks({});
        return;
      }

      setDeckLinksLoading(true);
      setDeckLinksError(null);

      try {
        const minEventSizeRaw =
          filters.minTournamentSize === '' ? 0 : Number(filters.minTournamentSize);
        const minEventSize = Number.isFinite(minEventSizeRaw) ? minEventSizeRaw : 0;
        const timePeriod = filters.timePeriod;

        const results = await Promise.all(
          names.map(async (name) => {
            try {
              const entries = await getCommanderEntries({
                commanderName: name,
                first: 200,
                timePeriod,
                minEventSize,
              });
              const sorted = normalizeAndSortEntries(entries);
              return { name, sorted };
            } catch (err) {
              // eslint-disable-next-line no-console
              console.warn('Failed to fetch decklist for', name, err);
              return { name, sorted: [], error: err };
            }
          })
        );

        const map = {};
        results.forEach(({ name, sorted }) => {
          if (sorted && sorted.length) map[name] = sorted;
        });
        setDeckLinks(map);

        if (results.some((r) => r.error)) {
          setDeckLinksError('Some decklists could not be fetched.');
        }
      } catch (err) {
        setDeckLinks({});
        setDeckLinksError(err.message || 'Unable to fetch decklists');
      } finally {
        setDeckLinksLoading(false);
      }
    };

    fetchDeckLinks();
  }, [selection, filters, normalizeAndSortEntries]);

  const onFilterChange = (key, value) => {
    setPendingFilters((prev) => ({ ...prev, [key]: value }));
  };

  const metaTotal = commanders.reduce(
    (sum, c) => sum + (c?.stats?.metaShare ?? 0),
    0
  );

  const formatMetaSharePct = (commander) => {
    const raw = commander?.stats?.metaShare;
    if (raw === undefined || raw === null) return 'N/A';
    if (metaTotal > 0) {
      return `${((raw / metaTotal) * 100).toFixed(1)}%`;
    }
    return raw.toFixed(3);
  };

  const formatConversionPct = (commander) => {
    const raw = commander?.stats?.conversionRate;
    if (raw === undefined || raw === null) return 'N/A';
    return `${(raw * 100).toFixed(1)}%`;
  };

  const colorGradient = (colorId = '') => {
    const id = colorId.toUpperCase();
    const mono = {
      W: 'radial-gradient(circle at 20% 20%, rgba(255, 245, 215, 0.30), transparent 45%), radial-gradient(circle at 80% 10%, rgba(255, 255, 255, 0.20), transparent 40%)',
      U: 'radial-gradient(circle at 20% 20%, rgba(125, 200, 255, 0.24), transparent 45%), radial-gradient(circle at 80% 10%, rgba(80, 170, 255, 0.16), transparent 40%)',
      B: 'radial-gradient(circle at 20% 20%, rgba(90, 80, 120, 0.32), transparent 45%), radial-gradient(circle at 80% 10%, rgba(40, 35, 60, 0.26), transparent 40%)',
      R: 'radial-gradient(circle at 20% 20%, rgba(240, 110, 90, 0.32), transparent 45%), radial-gradient(circle at 80% 10%, rgba(200, 70, 60, 0.26), transparent 40%)',
      G: 'radial-gradient(circle at 20% 20%, rgba(140, 200, 140, 0.25), transparent 45%), radial-gradient(circle at 80% 10%, rgba(90, 170, 110, 0.20), transparent 40%)',
      C: 'radial-gradient(circle at 20% 20%, rgba(180, 190, 200, 0.18), transparent 45%), radial-gradient(circle at 80% 10%, rgba(120, 130, 145, 0.14), transparent 40%)',
    };

    if (id.length === 1 && mono[id]) return mono[id];

    const two = {
      UW: 'radial-gradient(circle at 20% 20%, rgba(130, 190, 255, 0.24), transparent 45%), radial-gradient(circle at 80% 10%, rgba(240, 240, 200, 0.20), transparent 40%)',
      WB: 'radial-gradient(circle at 20% 20%, rgba(240, 230, 200, 0.24), transparent 45%), radial-gradient(circle at 80% 10%, rgba(90, 80, 130, 0.24), transparent 40%)',
      UB: 'radial-gradient(circle at 20% 20%, rgba(120, 180, 240, 0.24), transparent 45%), radial-gradient(circle at 80% 10%, rgba(90, 80, 140, 0.24), transparent 40%)',
      BR: 'radial-gradient(circle at 20% 20%, rgba(120, 90, 140, 0.26), transparent 45%), radial-gradient(circle at 80% 10%, rgba(240, 100, 80, 0.22), transparent 40%)',
      RG: 'radial-gradient(circle at 20% 20%, rgba(240, 140, 100, 0.26), transparent 45%), radial-gradient(circle at 80% 10%, rgba(110, 180, 110, 0.22), transparent 40%)',
      GW: 'radial-gradient(circle at 20% 20%, rgba(140, 200, 140, 0.26), transparent 45%), radial-gradient(circle at 80% 10%, rgba(240, 230, 200, 0.20), transparent 40%)',
      UR: 'radial-gradient(circle at 20% 20%, rgba(120, 190, 255, 0.26), transparent 45%), radial-gradient(circle at 80% 10%, rgba(255, 130, 100, 0.22), transparent 40%)',
      BG: 'radial-gradient(circle at 20% 20%, rgba(90, 80, 140, 0.24), transparent 45%), radial-gradient(circle at 80% 10%, rgba(110, 180, 110, 0.22), transparent 40%)',
      RW: 'radial-gradient(circle at 20% 20%, rgba(255, 140, 120, 0.26), transparent 45%), radial-gradient(circle at 80% 10%, rgba(240, 230, 200, 0.20), transparent 40%)',
      GU: 'radial-gradient(circle at 20% 20%, rgba(130, 200, 230, 0.24), transparent 45%), radial-gradient(circle at 80% 10%, rgba(120, 200, 140, 0.22), transparent 40%)',
      GR: 'radial-gradient(circle at 20% 20%, rgba(140, 200, 140, 0.26), transparent 45%), radial-gradient(circle at 80% 10%, rgba(240, 140, 120, 0.22), transparent 40%)',
      BW: 'radial-gradient(circle at 20% 20%, rgba(90, 80, 140, 0.24), transparent 45%), radial-gradient(circle at 80% 10%, rgba(240, 230, 200, 0.20), transparent 40%)',
    };
    if (id.length === 2 && two[id]) return two[id];

    // For 3-5 colors, build a blended gradient based on contained colors.
    const has = (c) => id.includes(c);
    const parts = [];
    if (has('W')) parts.push('rgba(255, 245, 215, 0.30)');
    if (has('U')) parts.push('rgba(120, 190, 255, 0.28)');
    if (has('B')) parts.push('rgba(90, 80, 120, 0.32)');
    if (has('R')) parts.push('rgba(240, 110, 90, 0.32)');
    if (has('G')) parts.push('rgba(120, 190, 140, 0.28)');

    // For 4-5 colors, blend along a linear gradient with evenly spaced stops.
    if (parts.length >= 4) {
      const slice = 100 / (parts.length - 1 || 1);
      const stops = parts
        .map((color, idx) => {
          const pos = (idx * slice).toFixed(2);
          return `${color} ${pos}%`;
        })
        .join(', ');
      return `linear-gradient(90deg, ${stops})`;
    }

    const anchors = [
      [20, 22],
      [78, 18],
      [50, 78],
      [24, 72],
      [80, 70],
    ];

    const stops = parts.map((color, idx) => {
      const [x, y] = anchors[idx % anchors.length];
      return `radial-gradient(circle at ${x}% ${y}%, ${color}, transparent 52%)`;
    });

    return stops.join(', ') || 'radial-gradient(circle at 20% 20%, rgba(180, 190, 200, 0.15), transparent 45%)';
  };

  const fetchImageUrls = async (name, card = null) => {
    if (!name) return [];

    // Check if we have preserved art information from the deck source
    if (card?.customImageUrl) {
      return [card.customImageUrl];
    }

    // If we have a specific Scryfall ID, use it for exact printing
    if (card?.scryfallId) {
      try {
        const res = await fetch(`https://api.scryfall.com/cards/${card.scryfallId}`);
        if (res.ok) {
          const cardData = await res.json();
          const faceImages =
            (cardData?.card_faces || [])
              .map(
                (face) =>
                  face?.image_uris?.art_crop ||
                  face?.image_uris?.normal ||
                  face?.image_uris?.large ||
                  null
              )
              .filter(Boolean) || [];
          const primaryImage =
            cardData?.image_uris?.art_crop ||
            cardData?.image_uris?.normal ||
            cardData?.image_uris?.large ||
            null;

          const isDf = isDoubleFaced(name);
          if (isDf && faceImages.length) return faceImages.slice(0, 2);
          if (faceImages.length) return [faceImages[0]];
          if (primaryImage) return [primaryImage];
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Scryfall specific ID fetch failed for', name, card.scryfallId, e);
      }
    }

    // Fallback to fuzzy search
    const isDf = isDoubleFaced(name);
    const queryName = (isDf ? name.split('//')[0] : name.split('/')[0]).trim();
    const query = encodeURIComponent(queryName);
    try {
      const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${query}`);
      if (!res.ok) return [];
      const cardData = await res.json();
      const faceImages =
        (cardData?.card_faces || [])
          .map(
            (face) =>
              face?.image_uris?.art_crop ||
              face?.image_uris?.normal ||
              face?.image_uris?.large ||
              null
          )
          .filter(Boolean) || [];
      const primaryImage =
        cardData?.image_uris?.art_crop ||
        cardData?.image_uris?.normal ||
        cardData?.image_uris?.large ||
        null;

      if (isDf && faceImages.length) return faceImages.slice(0, 2);
      if (faceImages.length) return [faceImages[0]];
      if (primaryImage) return [primaryImage];
      return [];
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Scryfall fetch failed for', name, e);
      return [];
    }
  };

  const fetchHandImageUrls = async (name, card = null) => {
    if (!name) return [];

    // Check if we have preserved art information from the deck source
    if (card?.customImageUrl) {
      return [card.customImageUrl];
    }

    // If we have a specific Scryfall ID, use it for exact printing
    if (card?.scryfallId) {
      try {
        const res = await fetch(`https://api.scryfall.com/cards/${card.scryfallId}`);
        if (res.ok) {
          const cardData = await res.json();
          const faceImages =
            (cardData?.card_faces || [])
              .map(
                (face) =>
                  face?.image_uris?.small ||
                  face?.image_uris?.normal ||
                  face?.image_uris?.large ||
                  face?.image_uris?.art_crop ||
                  null
              )
              .filter(Boolean) || [];
          const primaryImage =
            cardData?.image_uris?.small ||
            cardData?.image_uris?.normal ||
            cardData?.image_uris?.large ||
            cardData?.image_uris?.art_crop ||
            null;

          if (faceImages.length) return [faceImages[0]];
          if (primaryImage) return [primaryImage];
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Scryfall specific ID hand fetch failed for', name, card.scryfallId, e);
      }
    }

    // Fallback to fuzzy search
    const queryName = (isDoubleFaced(name) ? name.split('//')[0] : name.split('/')[0]).trim();
    const query = encodeURIComponent(queryName);
    try {
      const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${query}`);
      if (!res.ok) return [];
      const cardData = await res.json();
      const faceImages =
        (cardData?.card_faces || [])
          .map(
            (face) =>
              face?.image_uris?.small ||
              face?.image_uris?.normal ||
              face?.image_uris?.large ||
              face?.image_uris?.art_crop ||
              null
          )
          .filter(Boolean) || [];
      const primaryImage =
        cardData?.image_uris?.small ||
        cardData?.image_uris?.normal ||
        cardData?.image_uris?.large ||
        cardData?.image_uris?.art_crop ||
        null;

      if (faceImages.length) return [faceImages[0]];
      if (primaryImage) return [primaryImage];
      return [];
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Scryfall hand fetch failed for', name, e);
      return [];
    }
  };

  const fetchHandBatchImages = async (cards = []) => {
    const unique = Array.from(new Set(cards.filter(Boolean)));
    if (!unique.length) return {};

    // Separate cards with preserved art info from those needing Scryfall lookup
    const preservedArtCards = unique.filter(card => card.customImageUrl);
    const needsLookupCards = unique.filter(card => !card.customImageUrl);

    const map = {};

    // Handle cards with preserved art directly
    preservedArtCards.forEach(card => {
      if (card.name && card.customImageUrl) {
        map[card.name] = [card.customImageUrl];
      }
    });

    // Handle cards needing Scryfall lookup
    if (needsLookupCards.length > 0) {
      const queries = needsLookupCards.map((card) => ({
        key: card.name,
        query: (isDoubleFaced(card.name) ? card.name.split('//')[0] : card.name.split('/')[0]).trim(),
        scryfallId: card.scryfallId,
      }));

      // First try exact Scryfall IDs for cards that have them
      const exactIdCards = queries.filter(q => q.scryfallId);
      if (exactIdCards.length > 0) {
        const exactPromises = exactIdCards.map(async (query) => {
          try {
            const res = await fetch(`https://api.scryfall.com/cards/${query.scryfallId}`);
            if (res.ok) {
              const cardData = await res.json();
              const faceImages =
                (cardData?.card_faces || [])
                  .map(
                    (face) =>
                      face?.image_uris?.small ||
                      face?.image_uris?.normal ||
                      face?.image_uris?.large ||
                      face?.image_uris?.art_crop ||
                      null
                  )
                  .filter(Boolean) || [];
              const primaryImage =
                cardData?.image_uris?.small ||
                cardData?.image_uris?.normal ||
                cardData?.image_uris?.large ||
                cardData?.image_uris?.art_crop ||
                null;
              const urls = faceImages.length ? [faceImages[0]] : primaryImage ? [primaryImage] : [];
              return { name: query.key, urls };
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Scryfall exact ID fetch failed for', query.key, query.scryfallId, e);
          }
          return { name: query.key, urls: [] };
        });

        const exactResults = await Promise.all(exactPromises);
        exactResults.forEach(({ name, urls }) => {
          if (urls.length) map[name] = urls;
        });
      }

      // For remaining cards without exact IDs, do batch fuzzy search
      const fuzzyQueries = queries.filter(q => !q.scryfallId && !map[q.key]);
      if (fuzzyQueries.length > 0) {
        try {
          const body = {
            identifiers: fuzzyQueries.map((q) => ({ name: q.query })),
          };
          const res = await fetch('https://api.scryfall.com/cards/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (res.ok) {
            const data = await res.json();
            (data?.data || []).forEach((card, idx) => {
              const name = fuzzyQueries[idx]?.key || card?.name;
              if (!name) return;
              const faceImages =
                (card?.card_faces || [])
                  .map(
                    (face) =>
                      face?.image_uris?.small ||
                      face?.image_uris?.normal ||
                      face?.image_uris?.large ||
                      face?.image_uris?.art_crop ||
                      null
                  )
                  .filter(Boolean) || [];
              const primaryImage =
                card?.image_uris?.small ||
                card?.image_uris?.normal ||
                card?.image_uris?.large ||
                card?.image_uris?.art_crop ||
                null;
              const urls = faceImages.length ? [faceImages[0]] : primaryImage ? [primaryImage] : [];
              if (urls.length) map[name] = urls;
            });
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Scryfall batch fuzzy fetch failed', e);
        }
      }
    }

    return map;
  };

  const prefetchHandImages = async (cards = []) => {
    const toFetch = cards.filter((c) => c?.name && !imageCache[c.name]);
    if (!toFetch.length) return;

    const batch = await fetchHandBatchImages(toFetch);
    if (!batch || !Object.keys(batch).length) return;

    // Store URLs in cache
    setImageCache((prev) => {
      const next = { ...prev };
      Object.entries(batch).forEach(([name, urls]) => {
        if (name && urls?.length) next[name] = urls;
      });
      return next;
    });

    // Actually preload the images by creating Image objects
    const preloadPromises = Object.values(batch).flat().map(url => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => resolve(url); // Don't fail on individual image errors
        img.src = url;
      });
    });

    // Wait for all images to load (or fail)
    await Promise.allSettled(preloadPromises);
  };

  const getDeckLoader = (source) => {
    switch (source) {
      case 'archidekt':
        return loadArchidektDeckFromUrl;
      case 'topdeck':
        return loadTopdeckDeckFromUrl;
      case 'moxfield':
      default:
        return loadMoxfieldDeckFromUrl;
    }
  };

  const detectDeckSource = useCallback((url = '') => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (lower.includes('archidekt')) return 'archidekt';
    if (lower.includes('moxfield')) return 'moxfield';
    if (lower.includes('topdeck.gg/deck')) return 'topdeck';

    const archId = extractArchidektId(trimmed);
    if (archId) return 'archidekt';
    const moxId = extractMoxfieldId(trimmed);
    if (moxId) return 'moxfield';
    const topdeckIds = extractTopdeckIds(trimmed);
    if (topdeckIds) return 'topdeck';
    return null;
  }, []);

  const buildOpponentDeckChoices = useCallback(() => {
    if (!selection.length) return [];
    const deckUseCounts = {};
    return selection
      .map((commander, idx) => ({
        seat: seatAssignments[idx] ?? idx + 2,
        commander,
      }))
      .sort((a, b) => a.seat - b.seat)
      .map((entry) => {
        const currentCount = deckUseCounts[entry.commander.name] || 0;
        const candidate = deckLinks[entry.commander.name]?.[currentCount];
        deckUseCounts[entry.commander.name] = currentCount + 1;
        return { ...entry, entry: candidate };
      });
  }, [selection, seatAssignments, deckLinks]);

  useEffect(() => {
    const choices = buildOpponentDeckChoices();
    setOpponentDeckChoices(choices);
    setOpponentLibraries({});
    setOpponentDraws({});
    setOpponentDeckErrors({});
  }, [buildOpponentDeckChoices]);

  const drawOpponentCard = useCallback((key) => {
    setOpponentLibraries((prev) => {
      const library = prev[key];
      if (!library) return prev;
      const draw = library.drawRandom();
      setOpponentDraws((prevDraws) => ({
        ...prevDraws,
        [key]: draw.hand[0],
      }));
      return { ...prev, [key]: draw.library };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadOpponentDecks = async () => {
      if (!opponentDeckChoices.length) {
        setOpponentLibraries({});
        setOpponentDraws({});
        setOpponentDeckErrors({});
        setOpponentDeckLoading(false);
        return;
      }

      setOpponentDeckLoading(true);
      const results = await Promise.all(
        opponentDeckChoices.map(async (choice) => {
          const key = `${choice.seat}-${choice.commander.name}`;
          const deckUrl = choice.entry?.decklist;
          if (!deckUrl) {
            return { key, error: 'Decklist unavailable' };
          }
          const source = detectDeckSource(deckUrl);
          if (!source) {
            return { key, error: 'Unsupported deck link' };
          }
          const loader = getDeckLoader(source);
          try {
            const { library } = await loader(deckUrl);
            const draw = library.drawRandom();
            return { key, library: draw.library, card: draw.hand[0] };
          } catch (err) {
            return { key, error: err.message || 'Failed to load deck' };
          }
        })
      );

      if (cancelled) return;
      const libs = {};
      const draws = {};
      const errors = {};
      results.forEach((result) => {
        if (result.library) libs[result.key] = result.library;
        if (result.card) draws[result.key] = result.card;
        if (result.error) errors[result.key] = result.error;
      });
      setOpponentLibraries(libs);
      setOpponentDraws(draws);
      setOpponentDeckErrors(errors);
      setOpponentDeckLoading(false);
    };

    loadOpponentDecks();
    return () => {
      cancelled = true;
    };
  }, [opponentDeckChoices, detectDeckSource]);

  const loadDeckFromUrl = async () => {
    setDeckLoading(true);
    setDeckError(null);
    setDeckStatus('Loading deck...');
    try {
      const source = detectDeckSource(deckUrl);
      if (!source) {
        throw new Error('Enter a valid Moxfield, Archidekt, or TopDeck deck URL');
      }
      const loader = getDeckLoader(source);
      const { library, commanders, name } = await loader(deckUrl);
      setUserLibrary(library);
      setOriginalUserLibrary(library);
      setUserCommanders(commanders);
      // track counts for duplicate detection during draws
      const nameCounts = library.cards.reduce((map, card) => {
        if (!card?.name) return map;
        map[card.name] = (map[card.name] || 0) + 1;
        return map;
      }, {});
      setDeckNameCounts(nameCounts);
      const label =
        source === 'archidekt' ? 'Archidekt' : source === 'topdeck' ? 'TopDeck' : 'Moxfield';
      const named = name ? `: ${name}` : '';
      setDeckStatus(
        `Loaded ${library.cards.length} cards from ${label}${named}.`
      );
      setUserHand([]);
      await prefetchHandImages(library.cards);
    } catch (err) {
      setDeckError(err.message || 'Failed to load deck');
      setUserLibrary(null);
      setUserCommanders([]);
      setUserHand([]);
      setDeckStatus('');
    } finally {
      setDeckLoading(false);
    }
  };

  const drawUserHand = () => {
    if (!originalUserLibrary) return;

    setShowGlobalLoading(true);

    // Reset to original deck state and draw opening hand
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const opening = originalUserLibrary.drawOpeningHand(7);
      const handCounts = opening.hand.reduce((map, card) => {
        if (!card?.name) return map;
        map[card.name] = (map[card.name] || 0) + 1;
        return map;
      }, {});
      const hasBadDup = Object.entries(handCounts).some(([name, count]) => {
        const deckCount = deckNameCounts[name] || 0;
        return deckCount <= 1 && count > 1;
      });
      if (!hasBadDup) {
        // eslint-disable-next-line no-console
        console.log('Opening hand (names):', opening.hand.map((c) => c?.name || '(unknown)'));
        setUserLibrary(opening.library);
        setUserHand(opening.hand);
        setSelectedCardIndex(null);
        return;
      }
      // eslint-disable-next-line no-console
      console.warn('Detected duplicate singleton in opening hand; retrying draw', {
        attempt: attempt + 1,
        handCounts,
      });
      if (attempt === maxAttempts - 1) {
        setUserLibrary(opening.library);
        setUserHand(opening.hand);
        setSelectedCardIndex(null); // fall back to last draw after retries
      }
    }
  };

  const drawSingleCard = () => {
    if (!userLibrary) return;

    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const draw = userLibrary.drawRandom();
      const drawnCard = draw.hand[0];

      if (!drawnCard) return; // No cards left to draw

      // Check if this card would create a duplicate of a singleton
      const cardName = drawnCard.name;
      const deckCount = deckNameCounts[cardName] || 0;
      const handCounts = userHand.reduce((map, card) => {
        if (!card?.name) return map;
        map[card.name] = (map[card.name] || 0) + 1;
        return map;
      }, {});

      const currentHandCount = handCounts[cardName] || 0;
      const hasBadDup = deckCount <= 1 && currentHandCount >= 1;

      if (!hasBadDup) {
        // eslint-disable-next-line no-console
        console.log('Drew card:', drawnCard.name);
        setUserLibrary(draw.library);
        setUserHand(prev => [...prev, drawnCard]);
        // Don't clear selection since we're adding to hand, but adjust index if necessary
        if (selectedCardIndex !== null && selectedCardIndex >= userHand.length) {
          setSelectedCardIndex(null);
        }
        return;
      }

      // eslint-disable-next-line no-console
      console.warn('Would create duplicate singleton; retrying draw', {
        attempt: attempt + 1,
        cardName,
        deckCount,
        currentHandCount,
      });

      if (attempt === maxAttempts - 1) {
        // Fall back to drawing anyway after retries
        setUserLibrary(draw.library);
        setUserHand(prev => [...prev, drawnCard]);
        // Don't clear selection since we're adding to hand, but adjust index if necessary
        if (selectedCardIndex !== null && selectedCardIndex >= userHand.length) {
          setSelectedCardIndex(null);
        }
      }
    }
  };

  const toggleSearch = () => {
    setShowSearch(prev => !prev);
    setSearchTerm('');
  };

  const sendToBottom = () => {
    if (!userLibrary || selectedCardIndex === null) return;

    const selectedCard = userHand[selectedCardIndex];
    if (!selectedCard) return;

    // Remove the selected card from hand
    const newHand = userHand.filter((_, idx) => idx !== selectedCardIndex);

    // Add the card to the bottom of the library
    const newLibraryCards = [...userLibrary.cards, selectedCard];
    const updatedLibrary = createLibrary({
      name: userLibrary.name,
      commanderId: userLibrary.commanderId,
      cards: newLibraryCards
    });

    setUserLibrary(updatedLibrary);
    setUserHand(newHand);
    setSelectedCardIndex(null);

    console.log('Sent card to bottom of library:', selectedCard.name);
  };

  const shuffleLibrary = () => {
    if (!userLibrary) return;

    const shuffled = userLibrary.shuffled();
    setUserLibrary(shuffled);

    setNotificationMessage('Shuffled!');
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 2000);

    console.log('Shuffled library');
  };

  const searchCards = (term) => {
    if (!userLibrary || !term.trim()) return [];

    const searchTerm = term.toLowerCase().trim();
    return userLibrary.cards.filter(card =>
      card.name && card.name.toLowerCase().includes(searchTerm)
    );
  };

  const selectCardFromSearch = (card) => {
    if (!card) return;

    // Remove the selected card from the library
    const remainingCards = userLibrary.cards.filter(c => c.id !== card.id);
    const updatedLibrary = createLibrary({
      name: userLibrary.name,
      commanderId: userLibrary.commanderId,
      cards: remainingCards
    });

    // Add the card to the hand
    setUserLibrary(updatedLibrary);
    setUserHand(prev => [...prev, card]);
    setSelectedCardIndex(null);
    setShowSearch(false);
    setSearchTerm('');

    console.log('Selected card from search:', card.name);
  };

  const parsePastedDecklist = (text) => {
    const lines = text.split('\n').map(line => line.trim());

    const mainboardCards = [];
    const commanders = [];

    // Find the sideboard section (case insensitive)
    let sideboardIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes('sideboard')) {
        sideboardIndex = i;
        break;
      }
    }

    // Find the separator empty line
    let separatorIndex = -1;
    if (sideboardIndex !== -1) {
      // If sideboard exists, find the empty line after it
      for (let i = sideboardIndex + 1; i < lines.length; i++) {
        if (!lines[i]) {
          separatorIndex = i;
          break;
        }
      }
    } else {
      // If no sideboard, find the first empty line
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i]) {
          separatorIndex = i;
          break;
        }
      }
    }

    // Process mainboard cards (before sideboard or before separator)
    const mainboardEndIndex = sideboardIndex !== -1 ? sideboardIndex : separatorIndex;
    for (let i = 0; i < mainboardEndIndex; i++) {
      const line = lines[i];
      if (!line || !line.match(/^\d+/)) continue;

      const cardName = line.replace(/^\d+\s+/, '');
      const count = parseInt(line.match(/^\d+/)[0], 10);

      for (let j = 0; j < count; j++) {
        mainboardCards.push({
          name: cardName,
          id: `${cardName}-${j}-${Date.now()}`, // Unique ID for each copy
        });
      }
    }

    // Process commanders (after separator)
    if (separatorIndex !== -1) {
      for (let i = separatorIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // Commanders can be listed with or without quantities
        let cardName = line;
        if (line.match(/^\d+/)) {
          cardName = line.replace(/^\d+\s+/, '');
        }

        commanders.push({
          name: cardName,
        });
      }
    }

    return { mainboardCards, commanders };
  };

  const loadDeckFromPaste = async () => {
    if (!pasteDecklistText.trim()) return;

    setDeckLoading(true);
    setDeckError(null);
    setDeckStatus('Parsing decklist...');

    try {
      const { mainboardCards, commanders } = parsePastedDecklist(pasteDecklistText);

      if (mainboardCards.length === 0) {
        throw new Error('No mainboard cards found in the pasted decklist');
      }

      // Create library from mainboard cards
      const { createLibrary } = await import('./domain/library.js');
      const library = createLibrary({
        name: 'Pasted Decklist',
        cards: mainboardCards,
      });

      setUserLibrary(library);
      setOriginalUserLibrary(library);
      setUserCommanders(commanders);

      // Track counts for duplicate detection during draws
      const nameCounts = library.cards.reduce((map, card) => {
        if (!card?.name) return map;
        map[card.name] = (map[card.name] || 0) + 1;
        return map;
      }, {});
      setDeckNameCounts(nameCounts);

      setDeckStatus(
        `Loaded ${library.cards.length} cards from pasted decklist.`
      );
      setUserHand([]);
      setShowPasteDecklist(false);
      setPasteDecklistText('');

      await prefetchHandImages(library.cards);
    } catch (err) {
      setDeckError(err.message || 'Failed to parse decklist');
      setUserLibrary(null);
      setUserCommanders([]);
      setUserHand([]);
      setDeckStatus('');
    } finally {
      setDeckLoading(false);
    }
  };

  return (
    <div className="App">
      <Analytics />
      {showNotification && (
        <div className="notification">
          {notificationMessage}
        </div>
      )}
      <header className="pod-selection">
        <div className="brand-logos brand-top-left">
          <img
            src="/mullagain_logo_transparent.png"
            alt="MullAgain logo"
            className="brand-mark"
          />
        </div>

          <Grid container direction="column" spacing={0.75} alignItems="center">
            <Grid item>
              <h1>MULLAGAIN</h1>
            </Grid>
            <Grid item>
              <p className="subtitle">
                Load your deck to practice mulligans with full pod knowledge.
                <br />
                Picks three commanders, weighted by meta share, and randomizes seat order.
              </p>
            </Grid>

          {isLoading && (
            <Grid item>
              <p className="status">Loading commanders...</p>
            </Grid>
          )}
          {error && (
            <Grid item>
              <p className="status error">{error}</p>
            </Grid>
          )}

          {!isLoading && !error && (

            <Grid container spacing={2} columns={16} alignItems="stretch">
              <Grid
                item
                xs={0}
                sm={0}
                md={1}
                lg={1}
                xl={2}
                sx={{ display: { xs: 'none', md: 'block' } }}
              />
            
              <Grid item xs={16} sm={16} md={7} lg={7} xl={6}>
                <div className="card user-deck">
                  <div className="card-header">
                    <h2>Your Deck</h2>
                      <small>
                        Load a Moxfield, Archidekt, or TopDeck deck 
                        <br/>
                        or paste a decklist directly
                      </small>
                  </div>

                  <p className="note seat-note">
                    <strong>Your seat this game: {userSeat}</strong>
                  </p>
                  
                  <Grid container spacing={1.5} alignItems="center" className="deck-url-row">
                    <Grid item xs={12} sm={6}>
                      <input
                        id="deckUrl"
                        type="url"
                        className="deck-url-input"
                        value={deckUrl}
                        onChange={(e) => setDeckUrl(e.target.value)}
                        placeholder="eg. https://www.moxfield.com/decks/..."
                      />
                    </Grid>

                    <Grid item xs={6} sm={3}>
                        <div className="deck-actions inline load-actions">
                        <button
                            type="button"
                            className="primary"
                            onClick={loadDeckFromUrl}
                            disabled={deckLoading || !deckUrl}
                        >
                            <FileUploadIcon sx={{ mr: 0.75, fontSize: '1rem', verticalAlign: 'middle' }} />
                            {deckLoading ? 'Loading...' : 'Load Decklist'}
                        </button>
                        </div>
                    </Grid>

                    <Grid item xs={6} sm={3}>
                        <div className="deck-actions inline load-actions">
                        <button
                            type="button"
                            onClick={() => setShowPasteDecklist(true)}
                            disabled={deckLoading}
                        >
                            <ContentPasteIcon sx={{ mr: 0.75, fontSize: '1rem', verticalAlign: 'middle' }} />
                            Paste Decklist
                        </button>
                        </div>
                    </Grid>

                    {/* Commander display */}
                    {userCommanders.length > 0 && (
                      <Grid container component="ul" className="selection-list" justifyContent="center">
                        {(() => {
                          const asArray = (val) => (Array.isArray(val) ? val : val ? [val] : []);
                          const paired = userCommanders.length > 1
                            ? [{
                                name: `${userCommanders[0].name} / ${userCommanders[1].name}`,
                                parts: [userCommanders[0].name, userCommanders[1].name],
                              }]
                            : userCommanders.map((c) => ({ name: c.name, parts: [c.name] }));

                          return paired.map((entry) => {
                            const images = entry.parts
                              .map((p) => asArray(imageCache[p]))
                              .flat()
                              .slice(0, 2);
                            const hasSplit = images.length > 1;
                            const topImage = images[0];

                            return (
                              <Grid
                                item
                                xs={12}
                                component="li"
                                key={`user-commander-${entry.name}`}
                                className={`commander-card${images.length ? ' has-bg' : ''}`}
                                style={
                                  !hasSplit && topImage
                                    ? {
                                        backgroundImage: `url(${topImage})`,
                                        backgroundPosition: 'center 12.5%',
                                      }
                                    : undefined
                                }
                              >
                                {hasSplit && (
                                  <div className="card-art-split">
                                    {images.slice(0, 2).map((url, artIdx) => (
                                      <div
                                        key={`${entry.name}-art-${artIdx}`}
                                        className="card-art"
                                        style={{
                                          backgroundImage: `url(${url})`,
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                                <div className="commander-card__content">
                                  <div className="name">{entry.name}</div>
                                </div>
                              </Grid>
                            );
                          });
                        })()}
                      </Grid>
                    )}

                    {deckError && 
                    <Grid item xs={12}>
                        <p className="status error">{deckError}</p>
                    </Grid>
                    }
                    {deckStatus &&
                    <Grid item xs={12}>
                        <p className="status">{deckStatus}</p>
                    </Grid>
                    }

                    {/* Draw 7/Mulligan button - only shown after deck is loaded */}
                    {userLibrary && !userHand.length && (
                      <Grid item xs={12}>
                        <Grid container spacing={1}>
                          <Grid item xs={6} sm={3}>
                            <div className="deck-actions">
                              <button
                                type="button"
                                onClick={drawUserHand}
                                disabled={!userLibrary}
                                className="full-width-btn primary"
                              >
                                <RefreshIcon sx={{ mr: 0.75, fontSize: '1rem', verticalAlign: 'middle' }} />
                                Draw 7
                              </button>
                            </div>
                          </Grid>
                          <Grid item xs={6} sm={9}>
                            {/* Empty space */}
                          </Grid>
                        </Grid>
                      </Grid>
                    )}

                    {/* Additional deck controls - only shown after drawing opening hand */}
                    {userLibrary && userHand.length > 0 && (
                      <Grid item xs={12}>
                        <Grid container spacing={1}>
                          <Grid item xs={6} sm={3}>
                            <div className="deck-actions">
                              <button
                                type="button"
                                onClick={drawUserHand}
                                disabled={!userLibrary}
                                className="full-width-btn primary"
                              >
                                <RefreshIcon sx={{ mr: 0.75, fontSize: '1rem', verticalAlign: 'middle', transform: 'scaleX(-1)' }} />
                                Mulligan
                              </button>
                            </div>
                          </Grid>
                          <Grid item xs={6} sm={9}>
                            {/* Empty space */}
                          </Grid>

                          {/* Second row: Other buttons */}
                          <Grid item xs={6} sm={3}>
                            <div className="deck-actions">
                              <button
                                type="button"
                                disabled={!userLibrary}
                                onClick={drawSingleCard}
                                className="full-width-btn"
                              >
                                <DrawIcon sx={{ mr: 0.5, fontSize: '1rem', verticalAlign: 'middle' }} />
                                Draw Card
                              </button>
                            </div>
                          </Grid>

                          <Grid item xs={6} sm={3}>
                            <div className="deck-actions">
                              <button
                                type="button"
                                disabled={!userLibrary}
                                onClick={shuffleLibrary}
                                className="full-width-btn"
                              >
                                <ShuffleIcon sx={{ mr: 0.5, fontSize: '1rem', verticalAlign: 'middle' }} />
                                Shuffle Library
                              </button>
                            </div>
                          </Grid>

                          <Grid item xs={6} sm={3}>
                            <div className="deck-actions">
                              <button
                                type="button"
                                disabled={!userLibrary || selectedCardIndex === null}
                                onClick={sendToBottom}
                                className="full-width-btn"
                                title="Please select a card"
                              >
                                <ArrowDownwardIcon sx={{ mr: 0.5, fontSize: '1rem', verticalAlign: 'middle' }} />
                                Send to Bottom
                              </button>
                            </div>
                          </Grid>

                          <Grid item xs={6} sm={3}>
                            <div className="deck-actions">
                              <button
                                type="button"
                                disabled={!userLibrary}
                                onClick={toggleSearch}
                                className="full-width-btn"
                              >
                                <SearchIcon sx={{ mr: 0.5, fontSize: '1rem', verticalAlign: 'middle' }} />
                                Search Library
                              </button>
                            </div>
                          </Grid>
                        </Grid>
                      </Grid>
                    )}

                  </Grid>

                  {showSearch && (
                    <div className="search-interface">
                      <div className="search-input-container">
                        <input
                          type="text"
                          className="search-input"
                          placeholder="Search for cards in your deck..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="search-close-btn"
                          onClick={toggleSearch}
                        >
                          ✕
                        </button>
                      </div>
                      {searchTerm && (
                        <div className="search-results">
                          {searchCards(searchTerm).slice(0, 10).map((card, idx) => (
                            <button
                              key={`${card.id || card.name}-${idx}`}
                              type="button"
                              className="search-result-item"
                              onClick={() => selectCardFromSearch(card)}
                            >
                              {card.name}
                            </button>
                          ))}
                          {searchCards(searchTerm).length === 0 && (
                            <div className="search-no-results">No cards found</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Paste Decklist Popup */}
                  {showPasteDecklist && (
                    <div className="paste-decklist-overlay" onClick={() => setShowPasteDecklist(false)}>
                      <div className="paste-decklist-popup" onClick={(e) => e.stopPropagation()}>
                        <div className="paste-decklist-header">
                          <h3>Paste Decklist</h3>
                          <button
                            type="button"
                            className="paste-decklist-close-btn"
                            onClick={() => setShowPasteDecklist(false)}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="paste-decklist-content">
                          <textarea
                            className="paste-decklist-textarea"
                            placeholder={`Paste your decklist here. Format should be:
1 Card Name
1 Another Card
...
SIDEBOARD:
1 Sideboard Card
...
Commander Name`}
                            value={pasteDecklistText}
                            onChange={(e) => setPasteDecklistText(e.target.value)}
                            autoFocus
                          />
                          <div className="paste-decklist-instructions">
                            <p><strong>Format:</strong></p>
                            <ul>
                              <li>Mainboard cards: <code>1 Card Name</code> (one per line)</li>
                              <li>Sideboard: Any line containing "sideboard" (case insensitive) - everything after until empty line is ignored</li>
                              <li>Commanders: Listed after an empty line (after sideboard if present, or after mainboard if no sideboard)</li>
                            </ul>
                            <p><strong>Example with sideboard:</strong></p>
                            <pre><code>{[
                              '1 Mainboard Card',
                              '1 Another Mainboard Card',
                              '',
                              'SIDEBOARD:',
                              '1 Sideboard Card',
                              '1 Another Sideboard Card',
                              '',
                              '1 Commander Card',
                              '1 Partner Commander'
                            ].join('\n')}</code></pre>

                            <p><strong>Example without sideboard:</strong></p>
                            <pre><code>{[
                              '1 Mainboard Card',
                              '1 Another Mainboard Card',
                              '',
                              'Commander Card',
                              'Partner Commander'
                            ].join('\n')}</code></pre>
                          </div>
                        </div>
                        <div className="paste-decklist-actions">
                          <button
                            type="button"
                            className="paste-decklist-cancel-btn"
                            onClick={() => {
                              setShowPasteDecklist(false);
                              setPasteDecklistText('');
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="paste-decklist-load-btn"
                            onClick={loadDeckFromPaste}
                            disabled={!pasteDecklistText.trim() || deckLoading}
                          >
                            {deckLoading ? 'Loading...' : 'Load Deck'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {userHand.length > 0 && (
                    <div className="hand-preview">
                      <Grid container spacing={0} component="ul" className="hand-grid">
                        <Grid item xs={12}>
                            <p className="note">Your hand:</p>
                        </Grid>
                        {showGlobalLoading ? (
                          <Grid item xs={12}>
                            <div className="hand-loading">
                              <div className="loading-spinner"></div>
                              <p>Loading card images...</p>
                            </div>
                          </Grid>
                        ) : (
                          userHand.map((card, idx) => {
                            const cached = imageCache[card.name];
                            const images = Array.isArray(cached) ? cached : cached ? [cached] : [];
                            const topImage = images[0];
                            const isSelected = selectedCardIndex === idx;
                            // split 4 on top row, 3 on bottom; use xs=6 to force 2 cols on mobile, md for desktop layout
                            return (
                              <Grid
                                item
                                xs="auto"
                                sm="auto"
                                md="auto"
                                lg="auto"
                                component="li"
                                key={card.id || `${card.name}-${idx}`}
                                className={`hand-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => setSelectedCardIndex(isSelected ? null : idx)}
                                style={{ cursor: 'pointer' }}
                              >
                                {topImage ? (
                                  <img
                                    className="hand-card__img"
                                    src={topImage}
                                    alt={card.name}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="hand-card__placeholder">{card.name}</div>
                                )}
                                {isSelected && (
                                  <div className="card-selection-indicator">Selected</div>
                                )}
                              </Grid>
                            );
                          })
                        )}
                      </Grid>
                    </div>
                  )}
                </div>
              </Grid>


              <Grid item xs={16} sm={16} md={7} lg={7} xl={6}>
                <div className="card selection-card">
                  <div className="card-header">
                    <h2>Random Pod</h2>
                    <small>Data from edhtop16.com</small>
                  </div>
                  <div className="controls inline randomize-controls">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => rollSelection()}
                      disabled={!commanders.length}
                    >
                      <CasinoIcon sx={{ mr: 0.5, fontSize: '1rem', verticalAlign: 'middle' }} />
                      Randomize Pod
                    </button>
                    <p className="note">Click to reroll anytime.</p>
                  </div>

                  <Grid
                    container
                    component="ul"
                    className="selection-list"
                    justifyContent="center"
                  >
                    {(() => {
                      return selection
                      .map((commander, idx) => ({
                        seat: seatAssignments[idx] ?? idx + 2,
                        commander,
                      }))
                      .sort((a, b) => a.seat - b.seat)
                      .map(({ commander, seat }) => {
                        const selectionKey = `${seat}-${commander.name}`;
                        const deckChoice = opponentDeckChoices.find(
                          (entry) =>
                            entry.seat === seat && entry.commander.name === commander.name
                        );
                        const deckEntry = deckChoice?.entry;
                        const opponentCard = opponentDraws[selectionKey];
                        const opponentImages = Array.isArray(imageCache[opponentCard?.name])
                          ? imageCache[opponentCard?.name]
                          : opponentCard?.name && imageCache[opponentCard?.name]
                            ? [imageCache[opponentCard?.name]]
                            : [];
                        const parts = getNameParts(commander.name);
                        const isPartner = parts.length > 1;
                        const cacheImages = imageCache[commander.name];
                        const primaryImagesRaw =
                          (Array.isArray(cacheImages) ? cacheImages : null) ||
                          commander.cardDetail?.cardPreviewImageUrl ||
                          commander.cardDetail?.imageUrls?.[0] ||
                          cacheImages;
                        const partnerImages = parts
                          .map((p) => imageCache[p])
                          .filter(Boolean)
                          .flat();

                        const asArray = (val) =>
                          Array.isArray(val) ? val : val ? [val] : [];
                        const primaryImages = asArray(primaryImagesRaw);
                        const isDf = isDoubleFaced(commander.name);

                        let images = [];
                        if (isPartner && partnerImages.length) {
                          images = partnerImages.slice(0, 2);
                        } else if (isDf && primaryImages.length) {
                          images = primaryImages.slice(0, 2);
                        } else {
                          images = primaryImages;
                        }

                        const hasSplit = (isPartner || isDf) && images.length > 1;
                        const topImage = images[0];

                        return (
                          <Grid
                            item
                            xs={12}
                            component="li"
                            key={`${commander.id || commander.name}-${seat}`}
                            className={`commander-card${images.length ? ' has-bg' : ''}`}
                            style={
                              !hasSplit && topImage
                                ? {
                                    backgroundImage: `url(${topImage})`,
                                    backgroundPosition: 'center 12.5%',
                                  }
                                : undefined
                            }
                          >
                            {hasSplit && (
                              <div className="card-art-split">
                                {images.slice(0, 2).map((url, artIdx) => (
                                  <div
                                    key={`${commander.name}-art-${artIdx}`}
                                    className="card-art"
                                    style={{
                                      backgroundImage: `url(${url})`,
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                            <div className="commander-card__content">
                              <div className="name">
                                Seat {seat}: {commander.name}
                              </div>
                              <div className="meta chips">
                                <span>
                                  Meta: {formatMetaSharePct(commander)}
                                </span>
                                <span>Entries: {commander.stats?.count ?? 'N/A'}</span>
                                <span>
                                  Conv: {formatConversionPct(commander)}
                                </span>
                                <span>Top cuts: {commander.stats?.topCuts ?? 'N/A'}</span>
                              </div>
                              <div className="deck-link-row">
                                {deckLinksLoading && !deckLinks[commander.name] && (
                                  <span className="status subtle">Finding a deck...</span>
                                )}
                                {deckEntry?.decklist && (
                                  <a
                                    href={deckEntry.decklist}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="deck-link"
                                  >
                                    View decklist
                                    {Number.isFinite(deckEntry.standing) && (
                                      <>
                                        {' '}
                                        (placed {deckEntry.standing}
                                        {deckEntry.tournamentName
                                          ? ` @ ${deckEntry.tournamentName}`
                                          : ''}
                                        )
                                      </>
                                    )}
                                  </a>
                                )}
                                {deckLinksError && !deckLinks[commander.name] && (
                                  <span className="status error">Decklist unavailable</span>
                                )}
                              </div>
                            </div>
                          </Grid>
                        );
                      });
                    })()}
                  </Grid>
                </div>
              </Grid>

              <Grid
                item
                xs={0}
                sm={0}
                md={1}
                lg={1}
                xl={2}
                sx={{ display: { xs: 'none', md: 'block' } }}
              />
            </Grid>
          )}
        </Grid>
      </header>

      {!isLoading && !error && (
        <section className="pool">
          <Grid container columns={16}justifyContent="center">
            <Grid
              item
              md={1}
              lg={2}
              xl={3}
              sx={{ display: { xs: 'none', md: 'block' } }}
            />
            <Grid item xs={16} md={14} lg={12} xl={10}>
              <div className="filters">
                <Grid container spacing={1.25} columns={15} alignItems="flex-end">
                  <Grid item xs={15} sm={7.5} md={3}>
                    <div className="filter-group">
                      <label htmlFor="timePeriod">Time period</label>
                      <select
                        id="timePeriod"
                        value={pendingFilters.timePeriod}
                        onChange={(e) => onFilterChange('timePeriod', e.target.value)}
                      >
                        <option value="ONE_MONTH">1 month</option>
                        <option value="THREE_MONTHS">3 months</option>
                        <option value="SIX_MONTHS">6 months</option>
                        <option value="ONE_YEAR">1 year</option>
                        <option value="ALL_TIME">All time</option>
                        <option value="POST_BAN">Post ban</option>
                      </select>
                    </div>
                  </Grid>

                  <Grid item xs={15} sm={7.5} md={3}>
                    <div className="filter-group">
                      <label htmlFor="minTournamentSize">Min tournament size</label>
                      <select
                        id="minTournamentSize"
                        value={pendingFilters.minTournamentSize}
                        onChange={(e) => onFilterChange('minTournamentSize', e.target.value)}
                      >
                        <option value="">Any</option>
                        <option value="16">16+</option>
                        <option value="30">30+</option>
                        <option value="50">50+</option>
                        <option value="100">100+</option>
                        <option value="250">250+</option>
                      </select>
                    </div>
                  </Grid>

                  <Grid item xs={15} sm={7.5} md={3}>
                    <div className="filter-group">
                      <label htmlFor="minEntries">Min entries</label>
                      <select
                        id="minEntries"
                        value={pendingFilters.minEntries}
                        onChange={(e) => onFilterChange('minEntries', e.target.value)}
                      >
                        <option value="">All Commanders</option>
                        <option value="20">20+ Entries</option>
                        <option value="60">60+ Entries</option>
                        <option value="120">120+ Entries</option>
                      </select>
                    </div>
                  </Grid>

                  <Grid item xs={15} sm={7.5} md={3}>
                    <div className="filter-group">
                      <label htmlFor="count">Pool size (# commanders)</label>
                      <select
                        id="count"
                        value={pendingFilters.count}
                        onChange={(e) => onFilterChange('count', e.target.value)}
                      >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="250">250</option>
                      </select>
                    </div>
                  </Grid>

                  <Grid item xs={15} sm={15} md={3}>
                    <div className="filter-actions">
                      <button
                        type="button"
                        className="primary apply-btn"
                        onClick={applyFilters}
                        disabled={isLoading}
                      >
                        Apply Filters
                      </button>
                    </div>
                  </Grid>
                </Grid>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3>Commander Pool</h3>
                  <small>
                    Pool size: {filters.count || 50}
                  </small>
                </div>
                <p className="helper">Scroll to browse the pool being sampled from.</p>
                <Grid container component="ul" className="pool-list" spacing={1}>
                  {commanders.map((commander, idx) => (
                    <Grid
                      item
                      xs={12}
                      component="li"
                      key={commander.id || commander.name}
                      style={{
                        backgroundImage: colorGradient(commander.colorId),
                        backgroundColor: '#0b1220',
                      }}
                    >
                      <div className="name">
                        <span className="pool-rank">{idx + 1}.</span> {commander.name}
                      </div>
                      <div className="meta">
                        <span>
                          Meta: {formatMetaSharePct(commander)}
                        </span>
                        <span>Entries: {commander.stats?.count ?? 'N/A'}</span>
                        <span>
                          Conv: {formatConversionPct(commander)}
                        </span>
                        <span>Top cuts: {commander.stats?.topCuts ?? 'N/A'}</span>
                        <span>Color: {commander.colorId}</span>
                      </div>
                    </Grid>
                  ))}
                </Grid>
              </div>
            </Grid>
            <Grid
              item
              md={1}
              lg={2}
              xl={3}
              sx={{ display: { xs: 'none', md: 'block' } }}
            />
          </Grid>
        </section>
      )}

      {/* Author credit */}
      <footer className="author-credit">
        <p>Created by <a href="https://github.com/JonCels" target="_blank" rel="noopener noreferrer">[Jonathan Cels]</a></p>
      </footer>
    </div>
  );
}

export default App;
