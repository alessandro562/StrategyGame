/**
 * Client Redis.
 *
 * In produzione: Upstash via REST (l'integrazione del marketplace Vercel
 * inietta UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN da sola).
 *
 * In locale senza credenziali: uno store in memoria con la stessa interfaccia,
 * così `next dev` gira senza dipendenze esterne. Non è persistente e vive in un
 * solo processo: serve a sviluppare, non a condurre il ritiro.
 */

import { Redis } from '@upstash/redis';

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  /** SET key value NX EX seconds — restituisce true se la chiave era libera. */
  setNx(key: string, value: string, ttlS: number): Promise<boolean>;
  incr(key: string): Promise<number>;
  del(...keys: string[]): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  hset(key: string, field: string, value: string): Promise<unknown>;
  hgetall(key: string): Promise<Record<string, string>>;
  /**
   * Compare-and-set atomico: scrive lo stato solo se la versione è ancora
   * quella attesa, poi la incrementa. Restituisce la nuova versione, oppure
   * null se qualcun altro ha scritto nel frattempo.
   */
  casState(stateKey: string, versionKey: string, expected: number, value: string): Promise<number | null>;
}

const SCRIPT_CAS = `
local cur = tonumber(redis.call('GET', KEYS[2]) or '0')
if cur ~= tonumber(ARGV[1]) then return -1 end
redis.call('SET', KEYS[1], ARGV[2])
return redis.call('INCR', KEYS[2])
`;

class UpstashAdapter implements RedisLike {
  constructor(private readonly r: Redis) {}

  private static asString(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    return typeof v === 'string' ? v : JSON.stringify(v);
  }

  async get(key: string) {
    return UpstashAdapter.asString(await this.r.get(key));
  }
  async set(key: string, value: string) {
    return this.r.set(key, value);
  }
  async setNx(key: string, value: string, ttlS: number) {
    const res = await this.r.set(key, value, { nx: true, ex: ttlS });
    return res === 'OK';
  }
  async incr(key: string) {
    return this.r.incr(key);
  }
  async del(...keys: string[]) {
    if (keys.length === 0) return 0;
    return this.r.del(...keys);
  }
  async sadd(key: string, ...members: string[]) {
    if (members.length === 0) return 0;
    const [primo, ...resto] = members;
    return this.r.sadd(key, primo, ...resto);
  }
  async smembers(key: string) {
    const res = await this.r.smembers(key);
    return (res ?? []).map((m) => String(m));
  }
  async hset(key: string, field: string, value: string) {
    return this.r.hset(key, { [field]: value });
  }
  async hgetall(key: string) {
    const res = (await this.r.hgetall(key)) as Record<string, unknown> | null;
    if (!res) return {};
    return Object.fromEntries(Object.entries(res).map(([k, v]) => [k, String(v)]));
  }
  async casState(stateKey: string, versionKey: string, expected: number, value: string) {
    const res = (await this.r.eval(SCRIPT_CAS, [stateKey, versionKey], [String(expected), value])) as number;
    const n = Number(res);
    return n < 0 ? null : n;
  }
}

class MemoryAdapter implements RedisLike {
  private kv = new Map<string, { v: string; scade: number | null }>();
  private sets = new Map<string, Set<string>>();
  private hashes = new Map<string, Map<string, string>>();

  private vivo(key: string) {
    const e = this.kv.get(key);
    if (!e) return null;
    if (e.scade !== null && e.scade < Date.now()) {
      this.kv.delete(key);
      return null;
    }
    return e;
  }

  async get(key: string) {
    return this.vivo(key)?.v ?? null;
  }
  async set(key: string, value: string) {
    this.kv.set(key, { v: value, scade: null });
    return 'OK';
  }
  async setNx(key: string, value: string, ttlS: number) {
    if (this.vivo(key)) return false;
    this.kv.set(key, { v: value, scade: Date.now() + ttlS * 1000 });
    return true;
  }
  async incr(key: string) {
    const n = Number(this.vivo(key)?.v ?? '0') + 1;
    this.kv.set(key, { v: String(n), scade: null });
    return n;
  }
  async del(...keys: string[]) {
    let n = 0;
    for (const k of keys) {
      if (this.kv.delete(k)) n++;
      this.sets.delete(k);
      this.hashes.delete(k);
    }
    return n;
  }
  async sadd(key: string, ...members: string[]) {
    const s = this.sets.get(key) ?? new Set<string>();
    members.forEach((m) => s.add(m));
    this.sets.set(key, s);
    return members.length;
  }
  async smembers(key: string) {
    return [...(this.sets.get(key) ?? [])];
  }
  async hset(key: string, field: string, value: string) {
    const h = this.hashes.get(key) ?? new Map<string, string>();
    h.set(field, value);
    this.hashes.set(key, h);
    return 1;
  }
  async hgetall(key: string) {
    return Object.fromEntries(this.hashes.get(key) ?? new Map());
  }
  // Node è a thread singolo: fra la lettura e la scrittura non si intercala
  // nulla, quindi questa è davvero una CAS atomica.
  async casState(stateKey: string, versionKey: string, expected: number, value: string) {
    const cur = Number(this.vivo(versionKey)?.v ?? '0');
    if (cur !== expected) return null;
    this.kv.set(stateKey, { v: value, scade: null });
    return this.incr(versionKey);
  }
}

/**
 * Le credenziali arrivano con due nomi diversi a seconda di come è stato
 * collegato il database:
 *  - integrazione Upstash classica  -> UPSTASH_REDIS_REST_URL / _TOKEN
 *  - Upstash dal marketplace Vercel -> KV_REST_API_URL / KV_REST_API_TOKEN
 * Leggerne uno solo significa ritrovarsi in produzione sullo store in memoria
 * senza accorgersene.
 */
function credenziali(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

/** true quando giriamo su Vercel, dove lo store in memoria non è utilizzabile. */
function inProduzioneServerless(): boolean {
  return process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
}

let istanza: RedisLike | null = null;

export function redis(): RedisLike {
  if (istanza) return istanza;
  const c = credenziali();

  // Su Vercel ogni invocazione può atterrare su un'istanza diversa: lo store in
  // memoria non fallirebbe, farebbe di peggio — perderebbe commit a caso senza
  // che nessuno se ne accorga fino al reveal. Meglio un errore esplicito.
  if (!c && inProduzioneServerless()) {
    throw new Error(
      'Redis non configurato. Collega Upstash dal marketplace Vercel, oppure imposta ' +
        'UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN (o KV_REST_API_URL e ' +
        'KV_REST_API_TOKEN), poi rifai il deploy: le variabili si leggono all’avvio.',
    );
  }

  istanza = c ? new UpstashAdapter(new Redis(c)) : new MemoryAdapter();
  return istanza;
}

export function redisEffimero(): boolean {
  return credenziali() === null;
}

/** Solo per i test: riparte da uno store pulito. */
export function _resetRedis(sostituto?: RedisLike) {
  istanza = sostituto ?? new MemoryAdapter();
  return istanza;
}
