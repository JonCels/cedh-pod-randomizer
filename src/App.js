import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import './App.css';
import { queryGraphQL } from './api/edhTop16';
import { DeckVisualSandbox } from './components/DeckVisualSandbox';

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

        const fetchImage = async (name) => {
          if (!name) return [];
          // For double-faced names, keep the whole string; Scryfall fuzzy handles it.
          const isDf = isDoubleFaced(name);
          const queryName = isDf ? name : name.split('/')[0].trim();
          const query = encodeURIComponent(queryName);
        try {
          const res = await fetch(
            `https://api.scryfall.com/cards/named?fuzzy=${query}`
          );
            if (!res.ok) return [];
            const card = await res.json();
            // Collect up to two faces for double-faced cards; otherwise take primary.
            const faceImages =
              (card?.card_faces || [])
                .map(
                  (face) =>
                    face?.image_uris?.art_crop ||
                    face?.image_uris?.normal ||
                    face?.image_uris?.large ||
                    null
                )
                .filter(Boolean) || [];
            const primaryImage =
              card?.image_uris?.art_crop ||
              card?.image_uris?.normal ||
              card?.image_uris?.large ||
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

      const results = await Promise.all(
        Array.from(namesToFetch).map(async (name) => {
          const urls = await fetchImage(name);
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

  return (
    <div className="App">
      <header className="hero">
        <h1>cEDH Pod Randomizer</h1>
        <p className="subtitle">
          Picks three commanders, weighted by meta share, and randomizes seat order.
        </p>

        <div className="controls">
          <button
            type="button"
            className="primary"
            onClick={() => rollSelection()}
            disabled={!commanders.length}
          >
            Randomize Pod
          </button>
          <p className="note">
            Click to reroll anytime.
          </p>
        </div>

        {isLoading && <p className="status">Loading commanders...</p>}
        {error && <p className="status error">{error}</p>}

        {!isLoading && !error && (
          <div className="card selection-card">
            <div className="card-header">
              <h2>Random Pod</h2>
              <small>Data from edhtop16.com</small>
            </div>
            <p className="note seat-note">
              <strong>Your seat this game: {userSeat}</strong>
            </p>
            <ul className="selection-list">
              {selection
                .map((commander, idx) => ({
                  seat: seatAssignments[idx] ?? idx + 2,
                  commander,
                }))
                .sort((a, b) => a.seat - b.seat)
                .map(({ commander, seat }) => {
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
                  <li
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
                    <div className="name">
                      Seat {seat}: {commander.name}
                    </div>
                    <div className="meta chips">
                      <span>
                        Meta: {formatMetaSharePct(commander)}
                      </span>
                      <span>Entries: {commander.stats?.count ?? 'N/A'}</span>
                      <span>
                        Conv:{' '}
                        {commander.stats?.conversionRate !== undefined
                          ? commander.stats.conversionRate.toFixed(3)
                          : 'N/A'}
                      </span>
                      <span>Top cuts: {commander.stats?.topCuts ?? 'N/A'}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </header>

      {!isLoading && !error && (
        <section className="pool">
          <div className="filters">
            <Grid container spacing={1.25} alignItems="flex-end">
              <Grid item xs={12} sm={6} md={2.4}>
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

              <Grid item xs={12} sm={6} md={2.4}>
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

              <Grid item xs={12} sm={6} md={2.4}>
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

              <Grid item xs={12} sm={6} md={2.4}>
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

              <Grid item xs={12} sm={6} md={2.4}>
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
            <ul className="pool-list">
              {commanders.map((commander, idx) => (
                <li
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
                      Conv:{' '}
                      {commander.stats?.conversionRate !== undefined
                        ? commander.stats.conversionRate.toFixed(3)
                        : 'N/A'}
                    </span>
                    <span>Top cuts: {commander.stats?.topCuts ?? 'N/A'}</span>
                    <span>Color: {commander.colorId}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <DeckVisualSandbox />
        </section>
      )}
    </div>
  );
}

export default App;
