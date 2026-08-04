/**
 * Accessi. La registrazione è volutamente leggera, ma due proprietà non sono
 * negoziabili: la password non esiste mai in chiaro, e una sessione non è
 * falsificabile senza il segreto di server.
 */

import { describe, expect, it } from 'vitest';
import {
  cifraPassword,
  emailValida,
  firmaSessione,
  leggiSessione,
  normalizzaEmail,
  validaRegistrazione,
  verificaPassword,
} from '@/lib/auth';

describe('password', () => {
  it('non compaiono mai in chiaro nel valore memorizzato', () => {
    const memorizzata = cifraPassword('gatto');
    expect(memorizzata).not.toContain('gatto');
    expect(memorizzata.startsWith('scrypt:')).toBe(true);
  });

  it('la stessa password dà hash diversi (sale per utente)', () => {
    expect(cifraPassword('gatto')).not.toBe(cifraPassword('gatto'));
  });

  it('la verifica accetta quella giusta e rifiuta le altre', () => {
    const m = cifraPassword('gatto');
    expect(verificaPassword('gatto', m)).toBe(true);
    expect(verificaPassword('Gatto', m)).toBe(false);
    expect(verificaPassword('', m)).toBe(false);
  });

  it('un valore memorizzato corrotto non fa passare nessuno', () => {
    expect(verificaPassword('gatto', 'spazzatura')).toBe(false);
    expect(verificaPassword('gatto', 'scrypt:abc')).toBe(false);
    expect(verificaPassword('gatto', 'scrypt:abc:00')).toBe(false);
  });
});

describe('sessione', () => {
  const SEGRETO = 'segreto-di-server';

  it('firma e rilegge lo stesso pid', () => {
    const t = firmaSessione('u-123', SEGRETO);
    expect(leggiSessione(t, SEGRETO)).toBe('u-123');
  });

  it('un token con firma alterata non passa', () => {
    const t = firmaSessione('u-123', SEGRETO);
    expect(leggiSessione(`${t}x`, SEGRETO)).toBeNull();
  });

  it('non si può cambiare il pid senza il segreto', () => {
    const t = firmaSessione('u-123', SEGRETO);
    const [, scadenza, firma] = t.split('.');
    const contraffatto = `u-vittima.${scadenza}.${firma}`;
    expect(leggiSessione(contraffatto, SEGRETO)).toBeNull();
  });

  it('un altro segreto non valida il token', () => {
    const t = firmaSessione('u-123', SEGRETO);
    expect(leggiSessione(t, 'altro-segreto')).toBeNull();
  });

  it('un token scaduto non passa', () => {
    const t = firmaSessione('u-123', SEGRETO, 0);
    expect(leggiSessione(t, SEGRETO, Date.now())).toBeNull();
  });

  it('token assente o malformato non passa', () => {
    expect(leggiSessione(undefined, SEGRETO)).toBeNull();
    expect(leggiSessione('', SEGRETO)).toBeNull();
    expect(leggiSessione('boh', SEGRETO)).toBeNull();
  });
});

describe('validazione, volutamente permissiva', () => {
  it('normalizza le email', () => {
    expect(normalizzaEmail('  Mario.Rossi@WDA.IT ')).toBe('mario.rossi@wda.it');
  });

  it('scarta solo gli errori evidenti', () => {
    expect(emailValida('a@b.it')).toBe(true);
    expect(emailValida('mario')).toBe(false);
    expect(emailValida('mario@wda')).toBe(false);
  });

  it('accetta password corte ma non vuote', () => {
    expect(validaRegistrazione('Grazia', 'g@wda.it', '1234').ok).toBe(true);
    expect(validaRegistrazione('Grazia', 'g@wda.it', '123').ok).toBe(false);
  });

  it('il nome è obbligatorio', () => {
    expect(validaRegistrazione('  ', 'g@wda.it', '1234').ok).toBe(false);
  });
});
