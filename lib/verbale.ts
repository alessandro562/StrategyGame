/**
 * M9 — generazione del verbale in markdown.
 *
 * Deve funzionare con dati parziali: è scaricabile in qualsiasi momento, anche
 * a ritiro in corso e con moduli mai aperti. Nessun punteggio, nessuna
 * classifica, nessuna valutazione delle persone.
 */

import {
  controlliM8,
  daRiconvalidare,
  diagnosiPosizione,
  esitiServizio,
  flussiDistinti,
  forbice,
  pctErosione,
  storicoCappelli,
  vettoreStrategia,
} from './calc';
import {
  BASI_GLOSSA,
  BUCKET_GLOSSA,
  COLONNE_QUADRO,
  MODULI,
  ORIZZONTI_QUADRO,
  RIGHE_QUADRO,
  VINCOLI,
} from './glossario';
import type { Commit, Store } from './types';

function data(ts: number): string {
  return new Date(ts).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function num(n: number, decimali = 0): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali });
}

export function generaVerbale(state: Store, commits: Commit[], ora = Date.now()): string {
  const nome = (pid: string) => state.partecipanti.find((p) => p.id === pid)?.nome ?? pid;
  const out: string[] = [];
  const w = out.push.bind(out);

  w(`# ${state.workshop.nome}`);
  w('');
  w(`Verbale generato il ${data(ora)}.`);
  w('');
  w(
    `Partecipanti: ${state.partecipanti.map((p) => `${p.nome}${p.presente ? '' : ' (assente)'}`).join(', ')}.`,
  );
  w('');

  /* 1. Il quadro d'insieme ------------------------------------------ */
  // Apre il verbale perché è da lì che è partita la giornata: chi lo rilegge a
  // gennaio deve poter vedere da dove si era usciti prima di leggere cosa si è
  // deciso. La colonna Futuro è riportata per orizzonte, non alla rinfusa.
  w(`## 1. ${MODULI.MQ.nome}`);
  w('');
  const quadro = state.quadro ?? [];
  if (quadro.length === 0) {
    w('Il quadro è rimasto vuoto.');
    w('');
  } else {
    for (const r of RIGHE_QUADRO) {
      const dellaRiga = quadro.filter((v) => v.riga === r.chiave);
      if (dellaRiga.length === 0) continue;
      w(`### ${r.etichetta}`);
      w('');
      for (const c of COLONNE_QUADRO) {
        const voci = dellaRiga.filter((v) => v.colonna === c.chiave);
        if (voci.length === 0) continue;
        w(`**${c.etichetta}**`);
        w('');
        if (c.chiave === 'FUTURO') {
          for (const o of ORIZZONTI_QUADRO) {
            const dellOrizzonte = voci.filter((v) => v.orizzonte === o.chiave);
            if (dellOrizzonte.length === 0) continue;
            w(`- _${o.etichetta} (${o.quando})_`);
            for (const v of dellOrizzonte) w(`  - ${v.testo} — ${nome(v.autoreId)}`);
          }
          for (const v of voci.filter((v) => !v.orizzonte)) {
            w(`- ${v.testo} — ${nome(v.autoreId)}`);
          }
        } else {
          for (const v of voci) {
            // Le voci precaricate non hanno un autore da citare: erano il punto
            // di partenza, non il contributo di qualcuno.
            w(v.autoreId === 'seed' ? `- ${v.testo}` : `- ${v.testo} — ${nome(v.autoreId)}`);
          }
        }
        w('');
      }
    }
  }

  /* 2. Decisioni bloccate e dissensi -------------------------------- */
  w('## 2. Decisioni bloccate');
  w('');
  const lockOrdinati = [...state.lock].sort((a, b) => a.timestamp - b.timestamp);
  if (lockOrdinati.length === 0) {
    w('Nessuna decisione bloccata.');
  } else {
    for (const l of lockOrdinati) {
      w(`### ${l.modulo} — ${l.titolo}`);
      w('');
      w(`Bloccata il ${data(l.timestamp)}${l.riapertoA ? `, riaperta il ${data(l.riapertoA)}` : ''}.`);
      w('');
      const c = l.contenuto;
      if (typeof c === 'string') w(c);
      else if (c && typeof c === 'object') w('```json\n' + JSON.stringify(c, null, 2) + '\n```');
      w('');
      if (l.dissensi.length > 0) {
        w('Dissensi registrati:');
        w('');
        for (const d of l.dissensi) w(`- **${nome(d.partecipanteId)}** — ${d.nota}`);
      } else {
        w('Nessun dissenso registrato.');
      }
      w('');
    }
  }

  /* 3. Catalogo nei tre bucket -------------------------------------- */
  w('## 3. Il catalogo nei tre bucket');
  w('');
  const bucket = (b: string) => state.servizi.filter((s) => s.bucket === b);
  // Etichetta e glossa dal glossario: erano riscritte a mano qui, e dicevano
  // «Porta» e «Chiuso» mentre lo schermo diceva «Apriporta» e «Da dismettere».
  for (const b of ['NUCLEO', 'PORTA', 'CHIUSO'] as const) {
    const servizi = bucket(b);
    const g = BUCKET_GLOSSA[b];
    w(`### ${g.etichetta} (${g.standard}) — ${g.aiuto}`);
    w('');
    if (servizi.length === 0) {
      w('_Nessun servizio._');
      w('');
      continue;
    }
    w('| Servizio | Fatturato 12m | Residuo umano |');
    w('|---|---:|---:|');
    for (const s of servizi) {
      const sessioniM1 = new Set(
        state.sessioni.filter((x) => x.modulo === 'M1' && x.soggettoId === s.id).map((x) => x.id),
      );
      const esiti = esitiServizio(
        s,
        commits.filter((c) => sessioniM1.has(c.sessioneId)),
      );
      w(`| ${s.nome} | ${num(s.fatturato12m)} € | ${num(esiti.residuoPct, 1)}% |`);
    }
    w('');
  }
  const nonClassificati = state.servizi.filter((s) => s.bucket === null);
  if (nonClassificati.length > 0) {
    w(`Servizi non ancora classificati: ${nonClassificati.map((s) => s.nome).join(', ')}.`);
    w('');
  }

  /* 4. Basi di prezzo ------------------------------------------------ */
  w('## 4. Le basi di prezzo');
  w('');
  const conBase = state.servizi.filter((s) => s.bucket !== 'CHIUSO');
  if (conBase.length === 0) {
    w('Nessun servizio in catalogo.');
  } else {
    // Etichette dal glossario, non l'enum grezzo: il verbale stampava
    // «ACCESSO» dove lo schermo dice «Accesso (retainer)».
    const base = (b: keyof typeof BASI_GLOSSA) => `${BASI_GLOSSA[b].etichetta} (${BASI_GLOSSA[b].standard})`;
    w('| Servizio | Base principale | Seconda base | Nota |');
    w('|---|---|---|---|');
    for (const s of conBase) {
      const b = s.basePrezzo;
      const principale = b ? base(b.primaria) : `${base('GIORNATA')} — erosione attesa`;
      w(`| ${s.nome} | ${principale} | ${b?.secondaria ? base(b.secondaria) : '—'} | ${b?.nota ?? '—'} |`);
    }
  }
  w('');
  w(`**${num(pctErosione(state.servizi), 1)}% del fatturato futuro poggia su una base in erosione.**`);
  w('');

  /* 5-6. Posizione e vettore ---------------------------------------- */
  w('## 5. La posizione');
  w('');
  const distinti = flussiDistinti(state.flussi);
  w(`Flussi distinti su cui siede WDA: **${distinti}** — ${diagnosiPosizione(distinti)}.`);
  w('');
  const senzaFlusso = state.servizi.filter((s) => s.nessunFlusso);
  if (senzaFlusso.length > 0) {
    w(
      `Servizi che non generano alcun flusso (consulenza tradizionale in erosione): ${senzaFlusso
        .map((s) => s.nome)
        .join(', ')}.`,
    );
    w('');
  }

  w('## 6. Il vettore di posizionamento');
  w('');
  const asse = state.assi.find((a) => a.id === state.workshop.asseCorrenteId) ?? state.assi[0];
  const v = vettoreStrategia(state.posizionamenti);
  if (!v.oggi || !v.futuro || !asse) {
    w('Posizionamento non ancora completato.');
  } else {
    w(`Assi: **${asse.xSinistra} ↔ ${asse.xDestra}** (orizzontale), **${asse.ySotto} ↔ ${asse.ySopra}** (verticale).`);
    w('');
    w(`- Centroide oggi: ${num(v.oggi.x * 100)} / ${num(v.oggi.y * 100)}`);
    w(`- Centroide a 12 mesi: ${num(v.futuro.x * 100)} / ${num(v.futuro.y * 100)}`);
    w(`- Dispersione oggi: ${num(v.dispersioneOggi * 100, 1)}`);
    w(`- Dispersione a 12 mesi: ${num(v.dispersioneFuturo * 100, 1)}`);
    w(`- Lunghezza del vettore: ${num(v.lunghezza * 100, 1)}`);
    if (v.altaDivergenzaOggi) {
      w('');
      w(
        '> Alta divergenza su dove siete adesso. Non essere d’accordo su dove andare è normale. Non essere d’accordo su dove si è già significa che state lavorando in aziende diverse.',
      );
    }
  }
  w('');

  /* 7. Vulnerabilità ------------------------------------------------- */
  w('## 7. Vulnerabilità ancora aperte');
  w('');
  const aperte = state.vulnerabilita.filter((x) => x.chiusaA === null);
  if (aperte.length === 0) {
    w('Nessuna vulnerabilità aperta.');
  } else {
    for (const x of aperte) {
      const comp = state.competitor.find((c) => c.id === x.competitorId);
      w(`- **${x.testo}** — ${comp?.descrizione ?? ''}`);
    }
  }
  w('');

  /* 8. Soglia e spread ------------------------------------------------ */
  w(`## 8. ${MODULI.M6.nome}`);
  w('');
  const f = forbice(state.soglie);
  w(
    `Soglia condivisa: **${state.workshop.sogliaCondivisaPct !== null ? `${num(state.workshop.sogliaCondivisaPct)}%` : 'non ancora negoziata'}**.`,
  );
  w('');
  if (f.min !== null && f.max !== null) {
    w(`Spread registrato all'apertura: da ${num(f.min)}% a ${num(f.max)}% — **${num(f.ampiezza)} punti**.`);
    w('');
    w('Trigger di allarme raccolti (in ordine mescolato, non attribuiti):');
    w('');
    for (const s of state.soglie) if (s.trigger.trim()) w(`- ${s.trigger.trim()}`);
  } else {
    w('Nessuna soglia individuale raccolta.');
  }
  w('');
  if (state.traiettoria.length > 0) {
    w('Traiettoria verso gennaio 2027:');
    w('');
    w('| Trimestre | Quota servizi | R | G | B |');
    w('|---|---:|---:|---:|---:|');
    for (const t of state.traiettoria) {
      w(`| ${t.etichetta} | ${num(t.quotaServiziPct)}% | ${t.consumo.R} | ${t.consumo.G} | ${t.consumo.B} |`);
    }
    w('');
    // Senza legenda le tre colonne sono tre lettere: chi legge il verbale non
    // era in stanza quando si sono compilate in M0.
    w(`Consumo per trimestre delle tre risorse scarse: ${VINCOLI.map((v) => `**${v.chiave}** ${v.nome.toLowerCase()}`).join(', ')}.`);
    w('');
  }

  /* 9. No-regret moves ------------------------------------------------ */
  // `state.invarianti` resta il nome nel modello dati; a schermo e sul verbale
  // le due liste si chiamano «no-regret moves» e «condizionate».
  w(`## 9. ${MODULI.M7.nome}`);
  w('');
  const invarianti = state.invarianti.filter((i) => i.scenario === 'ENTRAMBI');
  if (invarianti.length === 0) w('_Nessuna no-regret move._');
  for (const i of invarianti) w(`- ${i.testo}`);
  w('');
  w('## 10. Condizionate');
  w('');
  const condizionati = state.invarianti.filter((i) => i.scenario !== 'ENTRAMBI');
  if (condizionati.length === 0) w('_Nessuna affermazione condizionata._');
  for (const i of condizionati) {
    const scenario = i.scenario === 'AUTONOMO' ? 'solo con brand autonomo' : 'solo come sub-brand';
    w(`- ${i.testo} — _${scenario}_`);
  }
  w('');

  /* 10. Action plan --------------------------------------------------- */
  w('## 11. Action plan');
  w('');
  const controlli = controlliM8(state.azioni, state.lock);
  if (state.azioni.length === 0) {
    w('Nessuna azione registrata.');
  } else {
    for (const orizzonte of ['90_GIORNI', 'A_GENNAIO_2027'] as const) {
      const azioni = state.azioni.filter((a) => a.orizzonte === orizzonte);
      w(`### ${orizzonte === '90_GIORNI' ? '90 giorni — entro fine ottobre 2026' : 'A gennaio 2027'}`);
      w('');
      if (azioni.length === 0) {
        w('_Nessuna azione._');
        w('');
        continue;
      }
      w('| Azione | Owner | Scadenza | Da quale decisione |');
      w('|---|---|---|---|');
      for (const a of azioni) {
        const l = state.lock.find((x) => x.id === a.lockOrigine);
        w(`| ${a.testo} | ${nome(a.ownerId)} | ${a.scadenza} | ${l ? `${l.modulo} — ${l.titolo}` : '—'} |`);
      }
      w('');
    }

    w('### Per owner');
    w('');
    for (const o of controlli.perOwner) {
      w(`**${nome(o.ownerId)}** — ${o.conteggio} azioni (${num(o.quota * 100)}%)${o.sovraccarico ? ' — oltre il 40% del totale' : ''}`);
      w('');
      for (const a of state.azioni.filter((x) => x.ownerId === o.ownerId)) {
        w(`- ${a.testo} — ${a.scadenza}`);
      }
      w('');
    }
  }
  if (controlli.lockSenzaAzione.length > 0) {
    const titoli = controlli.lockSenzaAzione
      .map((id) => state.lock.find((l) => l.id === id))
      .filter(Boolean)
      .map((l) => `${l!.modulo} — ${l!.titolo}`);
    w(`Decisioni senza esecuzione: ${titoli.join('; ')}.`);
    w('');
  }

  /* 11. Cappelli ------------------------------------------------------ */
  w('## 12. Mappa cappello × persona');
  w('');
  const storico = storicoCappelli(state.sessioni);
  if (Object.keys(storico).length === 0) {
    w('Nessun cappello distribuito.');
  } else {
    w('| Persona | Cappelli portati |');
    w('|---|---|');
    for (const p of state.partecipanti) {
      const c = storico[p.id];
      if (c?.length) w(`| ${p.nome} | ${c.join(', ')} |`);
    }
  }
  w('');

  /* 12. Riaperture ---------------------------------------------------- */
  w('## 13. Decisioni riaperte');
  w('');
  const { riaperti, aValle } = daRiconvalidare(state.lock);
  if (riaperti.length === 0) {
    w('Nessuna decisione riaperta.');
  } else {
    for (const l of riaperti) w(`- ${l.modulo} — ${l.titolo}, riaperta il ${data(l.riapertoA!)}`);
    w('');
    w(`Decisioni a valle da riconvalidare: **${aValle.length}**.`);
    for (const l of aValle) w(`- ${l.modulo} — ${l.titolo}`);
  }
  w('');

  /* Note di discussione ------------------------------------------------ */
  const pubbliche = state.note.filter((n) => !n.privata);
  if (pubbliche.length > 0) {
    w('## 14. Note di discussione');
    w('');
    for (const n of pubbliche.sort((a, b) => a.ts - b.ts)) {
      const s = state.sessioni.find((x) => x.id === n.sessioneId);
      w(`- [${s?.modulo ?? '—'}] **${nome(n.partecipanteId)}**: ${n.testo}`);
    }
    w('');
  }

  return out.join('\n');
}
