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

/**
 * Pastiglia di stato: quadrata come tutte le altre dell'interfaccia
 * (ConnectionBanner, indicatori). Piena quando la cosa c'è, vuota col contorno
 * dei controlli quando manca — su fondo bianco un cerchietto in grigio tenue
 * spariva, e "acceso" e "spento" si distinguevano solo dal colore.
 */
function Pastiglia({ acceso }: { acceso: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block w-2 h-2 shrink-0"
      style={
        acceso
          ? { background: 'var(--live)' }
          : { border: '1px solid var(--line-strong)' }
      }
    />
  );
}

export default function Home() {
  const effimero = redisEffimero();
  const presenti = variabiliAttese.filter((v) => !!process.env[v]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-deep)' }}>
      <div className="pannello p-8 flex flex-col gap-6" style={{ width: 'min(520px, 100%)' }}>
        <header className="flex flex-col gap-2">
          {/* Su fondo chiaro il marchio va nella variante blu: la bianca è
              invisibile. */}
          <Logo altezza={34} variante="blu" />
          <span className="etichetta mono">strategy room — ritiro 5/6 agosto 2026</span>
        </header>

        <nav className="flex flex-col gap-2">
          <Link
            className="bottone bottone-primario flex items-center justify-center text-[15px]"
            style={{ minHeight: 48 }}
            href={`/tavolo?r=${CODICE_STANZA_DEFAULT}`}
          >
            Tavolo — proiettato in sala
          </Link>
          <Link
            className="bottone flex items-center justify-center text-[15px]"
            style={{ minHeight: 48 }}
            href={`/mano?r=${CODICE_STANZA_DEFAULT}`}
          >
            Mano — dispositivo partecipante
          </Link>
        </nav>

        <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
          I partecipanti entrano scansionando il QR mostrato in permanenza sul Tavolo. Al primo ingresso si
          registrano con email e password, e scelgono il proprio nome dalla lista.
        </p>

        {effimero && (
          <section className="pannello p-4 flex flex-col gap-3" style={{ borderLeft: '3px solid var(--tension)' }}>
            <div className="etichetta" style={{ color: 'var(--tension)' }}>
              redis non configurato
            </div>
            <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Lo stato vive in memoria: sparisce al riavvio e non è condiviso. Va bene per sviluppare, non per il
              ritiro. Collega Upstash dal marketplace Vercel e{' '}
              <strong style={{ color: 'var(--ink)' }}>rifai il deploy</strong> — le variabili si leggono all’avvio.
            </p>

            {/* Quali nomi il server vede davvero. Solo i nomi, mai i valori:
                serve a distinguere "database non collegato" da "collegato al
                progetto sbagliato" o "variabile solo su Preview", che dalla
                dashboard si confondono facilmente. */}
            <div className="pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--line)' }}>
              <div className="etichetta">variabili viste dal server</div>
              <ul className="m-0 p-0 list-none flex flex-col gap-1">
                {variabiliAttese.map((v) => {
                  const c = presenti.includes(v);
                  return (
                    <li
                      key={v}
                      className="flex items-center gap-2 mono text-[13px]"
                      style={{ color: c ? 'var(--live)' : 'var(--ink-dim)' }}
                    >
                      <Pastiglia acceso={c} />
                      {v}
                    </li>
                  );
                })}
              </ul>
              <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                Tutte spente: il database non è collegato a questo progetto, oppure le variabili esistono solo su
                Preview e non su Production.
              </p>
            </div>
          </section>
        )}

        {!effimero && (
          <span className="flex items-center gap-2 etichetta">
            <Pastiglia acceso />
            redis collegato
          </span>
        )}
      </div>
    </main>
  );
}
