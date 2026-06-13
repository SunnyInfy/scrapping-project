import NodeCache from 'node-cache';

// Standard cache duration: 5 minutes (300 seconds)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

export const getCache = (key: string) => {
  return cache.get(key);
};

export const setCache = (key: string, data: any) => {
  cache.set(key, data);
};

export const clearCache = (key: string) => {
  cache.del(key);
};

export const clearCacheByPrefix = (prefix: string) => {
  const keys = cache.keys();
  const matchingKeys = keys.filter(k => k.startsWith(prefix));
  cache.del(matchingKeys);
};
