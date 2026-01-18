import { resolveProxyBase } from './proxyBase.js';

const API_BASE_URL = resolveProxyBase(
  process.env.REACT_APP_EDHTOP16_API,
  '/edhapi'
);

const defaultHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

const buildUrl = (path, params) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  // Support relative base (e.g., CRA proxy `/edhapi`) or absolute base.
  const base = API_BASE_URL;
  const url = base.startsWith('http')
    ? new URL(`${base}${normalizedPath}`)
    : new URL(`${base}${normalizedPath}`, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, value);
    });
  }

  return url.toString();
};

/**
 * Generic fetch wrapper for the EDHTOP16 API.
 * @param {string} path - API path, e.g. "/commanders"
 * @param {object} options - fetch options
 * @param {object} options.params - query params to append to the URL
 */
export async function fetchEdhTop16(path, { params, ...options } = {}) {
  const url = buildUrl(path, params);
  const response = await fetch(url, {
    headers: { ...defaultHeaders, ...options.headers },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `EDHTOP16 request failed (${response.status}): ${errorText || 'No body'}`
    );
  }

  // Some endpoints could return empty bodies; handle gracefully.
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Example convenience helpers. Adjust paths/params to match the API you use.
export const getTopCommanders = (params) =>
  fetchEdhTop16('/commanders', { params });

export const getTopCards = (params) =>
  fetchEdhTop16('/cards', { params });

// GraphQL convenience wrapper.
export async function queryGraphQL({ query, variables }) {
  const url = buildUrl('/graphql');
  const response = await fetch(url, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();
  if (json.errors) {
    const messages =
      json.errors
        .map((e) => e?.message)
        .filter(Boolean) || [];
    const message =
      messages.join('; ') ||
      (json.errors.length ? JSON.stringify(json.errors[0]) : '');
    throw new Error(message || 'GraphQL request failed');
  }
  return json.data;
}

/**
 * Fetch recent entries (tournament finishes) for a commander.
 * Returned array contains entry nodes so callers can rank/select a decklist.
 */
export async function getCommanderEntries({
  commanderName,
  first = 25,
  timePeriod,
  minEventSize = 0,
  maxStanding,
}) {
  const data = await queryGraphQL({
    query: `
      query CommanderEntries(
        $commanderName: String!
        $first: Int!
        $timePeriod: TimePeriod!
        $minEventSize: Int!
        $maxStanding: Int
      ) {
        commander(name: $commanderName) {
          name
          entries(
            first: $first
            sortBy: TOP
            filters: {
              timePeriod: $timePeriod
              minEventSize: $minEventSize
              maxStanding: $maxStanding
            }
          ) {
            edges {
              node {
                decklist
                standing
                tournament {
                  name
                  tournamentDate
                  TID
                  size
                }
              }
            }
          }
        }
      }
    `,
    variables: {
      commanderName,
      first,
      timePeriod,
      minEventSize,
      maxStanding,
    },
  });

  return data?.commander?.entries?.edges?.map((edge) => edge?.node).filter(Boolean) || [];
}


