/**
 * Test per le action overworld dello store (Fase E.2).
 * Coprono `muoviAvatar`, `interagisciCasella`, `passaTurnoOverworld` e
 * la persistenza di `caselleConsumate` come Set.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@store/gameStore'
import type { Casella, MappaGriglia, PosizioneAvatar } from '@/types'

// Mappa 4×3 con tutti i tipi di casella, identica a quella usata in
// movimento.test.ts:
//   . . . .
//   . T C #
//   . . X U
function mappaTest(): MappaGriglia {
  const T: Casella = { tipo: 'transito' }
  const C: Casella = { tipo: 'cespuglio', cespuglioId: 'A' }
  const O: Casella = { tipo: 'ostacolo' }
  const X: Casella = { tipo: 'allenatore', allenatoreId: 42 }
  const U: Casella = {
    tipo: 'uscita',
    versoMappaId: 'AltraMappa',
    spawnX: 5,
    spawnY: 6,
  }
  return {
    id: 'TestMap',
    larghezza: 4,
    altezza: 3,
    caselle: [
      [T, T, T, T],
      [T, T, C, O],
      [T, T, X, U],
    ],
    spawnDefault: { x: 1, y: 1 },
    background: '/bg.png',
  }
}

const posIn = (x: number, y: number): PosizioneAvatar => ({
  mappaId: 'TestMap',
  x,
  y,
  direzione: 'S',
})

describe('store overworld — muoviAvatar', () => {
  beforeEach(() => {
    useGameStore.setState({
      posizione1: posIn(1, 1),
      posizione2: posIn(0, 0),
      turnoOverworld: { giocatoreAttivo: 1, azioniRimaste: 2 },
    })
  })

  it('muove il giocatore attivo e decrementa le azioni di 1', () => {
    const ok = useGameStore.getState().muoviAvatar(1, posIn(1, 0), mappaTest())
    expect(ok).toBe(true)
    const s = useGameStore.getState()
    expect(s.posizione1).toEqual(posIn(1, 0))
    expect(s.turnoOverworld.azioniRimaste).toBe(1)
    expect(s.turnoOverworld.giocatoreAttivo).toBe(1)
  })

  it("dopo 2 movimenti il turno passa all'altro giocatore", () => {
    const m = mappaTest()
    useGameStore.getState().muoviAvatar(1, posIn(1, 0), m)
    useGameStore.getState().muoviAvatar(1, posIn(2, 0), m)
    const s = useGameStore.getState()
    expect(s.turnoOverworld.giocatoreAttivo).toBe(2)
    expect(s.turnoOverworld.azioniRimaste).toBe(2)
  })

  it('rifiuta movimento se non è il proprio turno', () => {
    const ok = useGameStore.getState().muoviAvatar(2, posIn(1, 0), mappaTest())
    expect(ok).toBe(false)
    expect(useGameStore.getState().posizione2).toEqual(posIn(0, 0))
  })

  it('rifiuta movimento su ostacolo', () => {
    useGameStore.setState({
      posizione1: posIn(2, 1),
      turnoOverworld: { giocatoreAttivo: 1, azioniRimaste: 2 },
    })
    const ok = useGameStore.getState().muoviAvatar(1, posIn(3, 1), mappaTest())
    expect(ok).toBe(false)
  })

  it('rifiuta movimento non adiacente', () => {
    const ok = useGameStore.getState().muoviAvatar(1, posIn(3, 1), mappaTest())
    expect(ok).toBe(false)
  })

  it('rifiuta movimento se azioniRimaste = 0', () => {
    useGameStore.setState({
      turnoOverworld: { giocatoreAttivo: 1, azioniRimaste: 0 },
    })
    const ok = useGameStore.getState().muoviAvatar(1, posIn(1, 0), mappaTest())
    expect(ok).toBe(false)
  })
})

describe('store overworld — interagisciCasella', () => {
  beforeEach(() => {
    useGameStore.setState({
      posizione1: posIn(1, 1),
      turnoOverworld: { giocatoreAttivo: 1, azioniRimaste: 2 },
      giocatore1: {
        ...useGameStore.getState().giocatore1,
        caselleConsumate: new Set(),
        allenatoriSconfitti: new Set(),
      },
    })
  })

  it('cespuglio → battaglia-selvatica + casella consumata + turno chiuso', () => {
    const r = useGameStore.getState().interagisciCasella(1, mappaTest(), 2, 1)
    expect(r.tipo).toBe('battaglia-selvatica')
    const s = useGameStore.getState()
    expect(s.giocatore1.caselleConsumate.has('TestMap:2,1:cespuglio:A')).toBe(true)
    // Turno chiuso → swap a giocatore 2 con 2 azioni
    expect(s.turnoOverworld.giocatoreAttivo).toBe(2)
    expect(s.turnoOverworld.azioniRimaste).toBe(2)
  })

  it('allenatore → battaglia-npc + consumata', () => {
    const r = useGameStore.getState().interagisciCasella(1, mappaTest(), 2, 2)
    expect(r).toMatchObject({ tipo: 'battaglia-npc', allenatoreId: 42 })
    const s = useGameStore.getState()
    expect(s.giocatore1.caselleConsumate.has('TestMap:2,2:allenatore:42')).toBe(true)
  })

  it('uscita → transizione-mappa + sposta avatar sul nuovo spawn', () => {
    const r = useGameStore.getState().interagisciCasella(1, mappaTest(), 3, 2)
    expect(r).toMatchObject({
      tipo: 'transizione-mappa',
      versoMappaId: 'AltraMappa',
      spawnX: 5,
      spawnY: 6,
    })
    const s = useGameStore.getState()
    expect(s.posizione1).toEqual({
      mappaId: 'AltraMappa',
      x: 5,
      y: 6,
      direzione: 'S',
    })
    // Le uscite non vengono marcate consumate
    expect(s.giocatore1.caselleConsumate.size).toBe(0)
    // Ma il turno si chiude lo stesso
    expect(s.turnoOverworld.giocatoreAttivo).toBe(2)
  })

  it('cespuglio già consumato → no-op (turno NON consumato)', () => {
    useGameStore.setState({
      giocatore1: {
        ...useGameStore.getState().giocatore1,
        caselleConsumate: new Set(['TestMap:2,1:cespuglio:A']),
      },
    })
    const r = useGameStore.getState().interagisciCasella(1, mappaTest(), 2, 1)
    expect(r.tipo).toBe('no-op')
    const s = useGameStore.getState()
    expect(s.turnoOverworld.giocatoreAttivo).toBe(1)
    expect(s.turnoOverworld.azioniRimaste).toBe(2)
  })

  it("transito → no-op (non interagibile)", () => {
    const r = useGameStore.getState().interagisciCasella(1, mappaTest(), 0, 0)
    expect(r.tipo).toBe('no-op')
    expect(useGameStore.getState().turnoOverworld.azioniRimaste).toBe(2)
  })

  it("se non è il proprio turno → no-op", () => {
    useGameStore.setState({
      turnoOverworld: { giocatoreAttivo: 2, azioniRimaste: 2 },
    })
    const r = useGameStore.getState().interagisciCasella(1, mappaTest(), 2, 1)
    expect(r.tipo).toBe('no-op')
  })
})

describe('store overworld — passaTurnoOverworld', () => {
  it('da giocatore 1 swappa a 2 con 2 azioni', () => {
    useGameStore.setState({
      turnoOverworld: { giocatoreAttivo: 1, azioniRimaste: 1 },
    })
    useGameStore.getState().passaTurnoOverworld()
    expect(useGameStore.getState().turnoOverworld).toEqual({
      giocatoreAttivo: 2,
      azioniRimaste: 2,
    })
  })
})

describe('store overworld — reset', () => {
  it("ripristina posizioni e turnoOverworld al default", () => {
    useGameStore.setState({
      posizione1: posIn(2, 2),
      posizione2: posIn(3, 1),
      turnoOverworld: { giocatoreAttivo: 2, azioniRimaste: 1 },
    })
    useGameStore.getState().reset()
    const s = useGameStore.getState()
    expect(s.posizione1).toEqual({
      mappaId: 'mappa-principale',
      x: 0,
      y: 0,
      direzione: 'S',
    })
    expect(s.posizione2).toEqual({
      mappaId: 'mappa-principale',
      x: 0,
      y: 0,
      direzione: 'S',
    })
    expect(s.turnoOverworld).toEqual({ giocatoreAttivo: 1, azioniRimaste: 2 })
    expect(s.giocatore1.caselleConsumate.size).toBe(0)
  })
})
