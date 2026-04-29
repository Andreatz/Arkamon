/**
 * Mapping: nome del luogo (chiave dei MAPPE) → path del background asset.
 * I file vivono in public/backgrounds/ e si servono via percorso assoluto "/backgrounds/...".
 */
const MAP_BG: Record<string, string> = {
  // Città principali
  Venezia: '/backgrounds/venezia.png',
  Piacenza: '/backgrounds/padova.png', // Piacenza non disponibile → padova come fallback tematico nord
  Milano: '/backgrounds/milano.jpg',
  Torino: '/backgrounds/torino.png',
  Grosseto: '/backgrounds/grosseto.png',
  Civitavecchia: '/backgrounds/civitavecchia.png',
  Cagliari: '/backgrounds/cagliari.png',
  Palermo: '/backgrounds/palermo.png',
  ReggioCalabria: '/backgrounds/reggio_calabria.png',
  Foggia: '/backgrounds/foggia.png',
  Napoli: '/backgrounds/napoli.png',
  Molisnt: '/backgrounds/molise.png',
  Pescara: '/backgrounds/pescara.png',
  Roma: '/backgrounds/roma.png',

  // Percorsi
  Percorso_1: '/backgrounds/route_1.jpg',
  Percorso_2: '/backgrounds/route_2.jpg',
  Percorso_3: '/backgrounds/route_3.jpg',
  Percorso_4: '/backgrounds/route_4.png',
  Percorso_5: '/backgrounds/route_5.png',
  Percorso_6: '/backgrounds/route_6.jpg',
  Percorso_7: '/backgrounds/route_7.jpg',
  Percorso_8: '/backgrounds/route_8.jpg',
  Percorso_9: '/backgrounds/route_9.png',
  Percorso_10: '/backgrounds/route_10.png',
  Percorso_11: '/backgrounds/route_11.png',
  Percorso_12: '/backgrounds/route_12.png',
  Percorso_13: '/backgrounds/route_13.jpg',
  Percorso_14: '/backgrounds/route_14.jpg',
}

/** Background di battaglia di default (foresta). */
export const BATTLE_BG_DEFAULT = '/backgrounds/battle_forest.jpg'

/** Background della scena Laboratorio. */
export const LABORATORY_BG = '/backgrounds/laboratory.png'

/** Background della scena Deposito. */
export const DEPOSIT_BG = '/backgrounds/deposit.png'

/** Background della scena Evoluzione. */
export const EVOLUTION_BG = '/backgrounds/evolution.png'

/** Restituisce il background per il luogo, o null se non mappato. */
export function getBackground(nomeLuogo: string): string | null {
  return MAP_BG[nomeLuogo] ?? null
}
