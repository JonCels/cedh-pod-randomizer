const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

const isPrivateIpv4 = (hostname = '') => {
  const parts = hostname.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
};

const isLocalhost = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return LOCAL_HOSTNAMES.has(host) || isPrivateIpv4(host);
};

const isAbsoluteUrl = (value = '') => /^https?:\/\//i.test(value);

const isLocalAbsoluteUrl = (value = '') => {
  try {
    const parsed = new URL(value);
    return LOCAL_HOSTNAMES.has(parsed.hostname) || isPrivateIpv4(parsed.hostname);
  } catch (e) {
    return false;
  }
};

export const resolveProxyBase = (envValue, fallback) => {
  if (!envValue) return fallback;
  if (!isLocalhost()) return envValue;
  if (envValue.startsWith('/')) return envValue;
  if (isAbsoluteUrl(envValue) && isLocalAbsoluteUrl(envValue)) return envValue;
  return fallback;
};
