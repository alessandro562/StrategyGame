import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { CODICE_STANZA_DEFAULT } from '@/lib/seed';
import { redisEffimero } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const variabiliAttese = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
];

export default function Home() {
  const effimero = redisEffimero();
  const presenti = variabiliAttese.filter((v) => !!process.env[v]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-deep)' }}>
      <div className="pannello p-8 flex flex-col gap-6" style={{ width: 'min(520px, 100%)' }}>
        <div className="flex flex-col gap-2">
          <Logo altezza={34} />
          <span className="etichetta">strategy room — ritiro 5/6 agosto 2026</span>
        </div>

        <div className="flex flex-col gap-2">
          <Link className="bottone bottone-primario text-center" href={`/tavolo?r=${CODICE_STANZA_DEFAULT}`}>
            Tavolo — proiettato in sala
          </Link>
          <Link className="bottone text-center" href={`/mano?r=${CODICE_STANZA_DEFAULT}`}>
            Mano — dispositivo partecipante
          </Link>
        </div>

        <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
          I partecipanti entrano scansionando il QR mostrato in permanenza sul Tavolo. Al primo ingresso si
          registrano con email e password, e scelgono il proprio nome dalla lista.
        </p>

        {effimero && (
          <div className="pannello p-3" style={{ borderColor: 'var(--tension)' }}>
            <div className="etichetta mb-1" style={{ color: 'var(--tension)' }}>
              redis non configurato
            </div>
            <p className="m-0 text-[12px]" style={{ color: 'var(--ink-dim)' }}>
              Lo stato vive in memoria: sparisce al riavvio e non è condiviso. Va bene per sviluppare, non per il
              ritiro. Collega Upstash dal marketplace Vercel e <strong>rifai il deploy</strong> — le variabili si
              leggono all’avvio.
            </p>

            {/* Quali nomi il server vede davvero. Solo i nomi, mai i valori:
                serve a distinguere "database non collegato" da "collegato al
                progetto sbagliato" o "variabile solo su Preview", che dalla
                dashboard si confondono facilmente. */}
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
              <div className="etichetta mb-1">variabili viste dal server</div>
              <div className="flex flex-col gap-1">
                {variabiliAttese.map((v) => {
                  const c = presenti.includes(v);
                  return (
                    <span key={v} className="mono text-[11px]" style={{ color: c ? 'var(--live)' : 'var(--ink-faint)' }}>
                      {c ? '●' : '○'} {v}
                    </span>
                  );
                })}
              </div>
              <p className="m-0 mt-2 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                Tutte spente: il database non è collegato a questo progetto, oppure le variabili esistono solo su
                Preview e non su Production.
              </p>
            </div>
          </div>
        )}

        {!effimero && (
          <span className="flex items-center gap-2 etichetta">
            <span className="inline-block w-2 h-2" style={{ background: 'var(--live)' }} />
            redis collegato
          </span>
        )}
      </div>
    </main>
  );
}
