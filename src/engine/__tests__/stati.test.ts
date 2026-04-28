import { describe, it, expect } from 'vitest'
import {
  applicaStato,
  risolviStatoInizioTurno,
  calcolaHPMax,
  DURATA_STATO,
} from '@engine/battleEngine'
import type { PokemonIstanza } from '@/types'

function mkIstanza(specieId: number, livello: number, hp?: number): PokemonIstanza {
  const istanza: PokemonIstanza = {
    istanzaId: `test-${specieId}-${livello}`,
    specieId,
    nome: 'Test',
    livello,
    hp: 0,
    xp: 0,
  }
  istanza.hp = hp ?? calcolaHPMax(istanza)
  return istanza
}

describe('applicaStato', () => {
  it('Confuso → durata 2 turni', () => {
    const i = applicaStato(mkIstanza(1, 5), 'Confuso')
    expect(i.stato?.tipo).toBe('Confuso')
    expect(i.stato?.turniRimanenti).toBe(2)
  })
  it('Addormentato → durata 3 turni', () => {
    const i = applicaStato(mkIstanza(1, 5), 'Addormentato')
    expect(i.stato?.turniRimanenti).toBe(3)
  })
  it('Avvelenato → durata indefinita (-1)', () => {
    const i = applicaStato(mkIstanza(1, 5), 'Avvelenato')
    expect(i.stato?.turniRimanenti).toBe(-1)
    expect(DURATA_STATO.Avvelenato).toBe(-1)
  })
})

describe('risolviStatoInizioTurno - nessuno stato', () => {
  it('puoAgire=true, niente messaggi, niente danno', () => {
    const i = mkIstanza(1, 50) // hp 79 max (Media: 12 + trunc(45*1.5)=79)
    const r = risolviStatoInizioTurno(i, calcolaHPMax(i))
    expect(r.puoAgire).toBe(true)
    expect(r.dannoSubito).toBe(0)
    expect(r.messaggi).toHaveLength(0)
    expect(r.istanza).toEqual(i)
  })
})

describe('risolviStatoInizioTurno - Avvelenato', () => {
  it('subisce 10% di hpMax (min 1), stato persiste', () => {
    const base = mkIstanza(1, 50) // hpMax 79, hp 79
    const i = applicaStato(base, 'Avvelenato')
    const hpMax = calcolaHPMax(base)
    const r = risolviStatoInizioTurno(i, hpMax)
    expect(r.dannoSubito).toBe(Math.floor(hpMax * 0.1)) // 7
    expect(r.istanza.hp).toBe(hpMax - 7)
    expect(r.istanza.stato?.tipo).toBe('Avvelenato')
    expect(r.puoAgire).toBe(true) // veleno NON salta turno
  })
  it('hpMax basso → almeno 1 danno (clamp)', () => {
    const base = mkIstanza(1, 5, 12) // hpMax 12 → 10% = 1.2 → trunc 1
    const i = applicaStato(base, 'Avvelenato')
    const r = risolviStatoInizioTurno(i, 12)
    expect(r.dannoSubito).toBeGreaterThanOrEqual(1)
  })
})

describe('risolviStatoInizioTurno - Addormentato', () => {
  it('rng < 0.5 → svegliato (stato pulito), puoAgire=true', () => {
    const i = applicaStato(mkIstanza(1, 5), 'Addormentato')
    const r = risolviStatoInizioTurno(i, 12, () => 0.3)
    expect(r.istanza.stato).toBeUndefined()
    expect(r.puoAgire).toBe(true)
  })
  it('rng >= 0.5 → resta addormentato, turno saltato, durata -1', () => {
    const i = applicaStato(mkIstanza(1, 5), 'Addormentato') // dur 3
    const r = risolviStatoInizioTurno(i, 12, () => 0.7)
    expect(r.puoAgire).toBe(false)
    expect(r.istanza.stato?.turniRimanenti).toBe(2)
  })
  it('durata 1 + rng >= 0.5 → cleared dopo turno saltato', () => {
    const base = mkIstanza(1, 5)
    const i: PokemonIstanza = {
      ...base,
      stato: { tipo: 'Addormentato', turniRimanenti: 1 },
    }
    const r = risolviStatoInizioTurno(i, 12, () => 0.7)
    expect(r.puoAgire).toBe(false)
    expect(r.istanza.stato).toBeUndefined()
  })
})

describe('risolviStatoInizioTurno - Confuso', () => {
  it('rng < 0.5 → self-hit (1d6 danno), turno perso, durata -1', () => {
    const base = mkIstanza(1, 5) // hpMax 12
    const i = applicaStato(base, 'Confuso') // dur 2
    // rng=0 → primo Math.random < 0.5 (self-hit), poi rollD6(1) con rng=0 → 1
    const r = risolviStatoInizioTurno(i, 12, () => 0)
    expect(r.puoAgire).toBe(false)
    expect(r.dannoSubito).toBeGreaterThanOrEqual(1)
    expect(r.dannoSubito).toBeLessThanOrEqual(6)
    expect(r.istanza.hp).toBe(12 - r.dannoSubito)
    expect(r.istanza.stato?.turniRimanenti).toBe(1)
  })
  it('rng >= 0.5 → agisce normalmente, durata -1', () => {
    const i = applicaStato(mkIstanza(1, 5), 'Confuso') // dur 2
    const r = risolviStatoInizioTurno(i, 12, () => 0.7)
    expect(r.puoAgire).toBe(true)
    expect(r.dannoSubito).toBe(0)
    expect(r.istanza.stato?.turniRimanenti).toBe(1)
  })
  it('durata 1 → cleared dopo questo turno', () => {
    const base = mkIstanza(1, 5)
    const i: PokemonIstanza = {
      ...base,
      stato: { tipo: 'Confuso', turniRimanenti: 1 },
    }
    const r = risolviStatoInizioTurno(i, 12, () => 0.7) // no self-hit
    expect(r.istanza.stato).toBeUndefined()
  })
})
