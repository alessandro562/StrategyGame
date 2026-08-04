/**
 * Le credenziali Redis arrivano con nomi diversi a seconda di come è collegato
 * il database. Leggerne una sola coppia significa ritrovarsi in produzione
 * sullo store in memoria senza accorgersene: su Vercel ogni invocazione può
 * atterrare su un'istanza diversa, quindi i commit sparirebbero a caso.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { redisEffimero } from '@/lib/redis';

const CHIAVI = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'VERCEL',
  'VERCEL_ENV',
];

let originali: Record<string, string | undefined> = {};

beforeEach(() => {
  originali = Object.fromEntries(CHIAVI.map((k) => [k, process.env[k]]));
  CHIAVI.forEach((k) => delete process.env[k]);
});

afterEach(() => {
  for (const [k, v] of Object.entries(originali)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('risoluzione delle credenziali', () => {
  it('senza variabili lo store è effimero', () => {
    expect(redisEffimero()).toBe(true);
  });

  it('riconosce i nomi dell’integrazione Upstash classica', () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://esempio.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    expect(redisEffimero()).toBe(false);
  });

  it('riconosce i nomi iniettati dal marketplace Vercel', () => {
    process.env.KV_REST_API_URL = 'https://esempio.upstash.io';
    process.env.KV_REST_API_TOKEN = 'token';
    expect(redisEffimero()).toBe(false);
  });

  it('accetta una coppia mista', () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://esempio.upstash.io';
    process.env.KV_REST_API_TOKEN = 'token';
    expect(redisEffimero()).toBe(false);
  });

  it('un url senza token non basta', () => {
    process.env.KV_REST_API_URL = 'https://esempio.upstash.io';
    expect(redisEffimero()).toBe(true);
  });
});
