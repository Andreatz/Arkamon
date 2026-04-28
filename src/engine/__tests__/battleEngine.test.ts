import { describe, it, expect } from 'vitest'
import {
  calcolaHPMax,
  determinaIniziativa,
  rollD6,
  roundHalfUp,
  tentaCattura,
} from '@engine/battleEngine'
import { efficaciaTipo } from '@data/index'
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

describe('rollD6', () => {
  it('2 dadi minimi (rng=0) === 2', () => {
    expect(rollD6(2, () => 0)).toBe(2)
  })
  it('2 dadi massimi (rng=0.99) === 12', () => {
    expect(rollD6(2, () => 0.99)).toBe(12)
  })
})

describe('roundHalfUp', () => {
  it('1.5 → 2', () => expect(roundHalfUp(1.5)).toBe(2))
  it('2.4 → 2', () => expect(roundHalfUp(2.4)).toBe(2))
  it('-1.5 → -2', () => expect(roundHalfUp(-1.5)).toBe(-2))
})

describe('calcolaHPMax', () => {
  it('Vyrath (Media) lvl 5 → 12', () => {
    expect(calcolaHPMax(mkIstanza(1, 5))).toBe(12)
  })
  it('Vyrath (Media) lvl 10 → 19', () => {
    expect(calcolaHPMax(mkIstanza(1, 10))).toBe(19)
  })
  it('Vyrath (Media) lvl 100 → 154', () => {
    expect(calcolaHPMax(mkIstanza(1, 100))).toBe(154)
  })
  it('Ao-shin (Leggendaria) lvl 100 → 310', () => {
    expect(calcolaHPMax(mkIstanza(107, 100))).toBe(310)
  })
})

describe('efficaciaTipo (matrice tipi)', () => {
  // superefficace = ×1.5 (valore di bilanciamento del database originale,
  // non il classico ×2). Fonte: old_files/Database.xlsx foglio Tipi.
  it('Acqua → Fuoco === 1.5 (superefficace)', () => {
    expect(efficaciaTipo('Acqua', 'Fuoco')).toBe(1.5)
  })
  it('Fuoco → Acqua === 0.5', () => {
    expect(efficaciaTipo('Fuoco', 'Acqua')).toBe(0.5)
  })
  it('Normale → Psico === 1', () => {
    expect(efficaciaTipo('Normale', 'Psico')).toBe(1)
  })
})

describe('determinaIniziativa', () => {
  it('lv A > lv B → A', () => expect(determinaIniziativa(10, 5)).toBe('A'))
  it('lv B > lv A → B', () => expect(determinaIniziativa(5, 10)).toBe('B'))
  it('pareggio + rng < 0.5 → A', () => {
    expect(determinaIniziativa(5, 5, () => 0.3)).toBe('A')
  })
  it('pareggio + rng >= 0.5 → B', () => {
    expect(determinaIniziativa(5, 5, () => 0.7)).toBe('B')
  })
})

describe('tentaCattura', () => {
  it('rng=0 (roll=3), tasso=5, hp pieno → riuscita=true (soglia=5)', () => {
    const v = mkIstanza(1, 5) // Vyrath, tasso=5, hp=12 di 12
    const ris = tentaCattura(v, () => 0)
    expect(ris.roll).toBe(3)
    expect(ris.soglia).toBe(5)
    expect(ris.riuscita).toBe(true)
  })
  it('rng=0.99 (roll=18), tasso=5, hp pieno → riuscita=false', () => {
    const v = mkIstanza(1, 5)
    const ris = tentaCattura(v, () => 0.99)
    expect(ris.roll).toBe(18)
    expect(ris.riuscita).toBe(false)
  })
})
