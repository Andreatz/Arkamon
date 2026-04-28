/**
 * Battle Engine - Logica pura del combattimento.
 *
 * Porting fedele di Mod_Battle_Engine.bas + Mod_Utilities.bas.
 * Senza dipendenze UI: prende stato + azione → restituisce risultato.
 */
import type {
  PokemonIstanza,
  MossaDef,
  RisultatoMossa,
  Lato,
  StatoAlterato,
} from '@/types'
import { getPokemon, getMossa, efficaciaTipo, CRESCITA_HP } from '@data/index'

// =============================================================
// STATI ALTERATI (Fase B della roadmap)
// =============================================================

/** Durata iniziale (turni) per ciascuno stato. -1 = indefinita. */
export const DURATA_STATO: Record<StatoAlterato, number> = {
  Confuso: 2,
  Addormentato: 3,
  Avvelenato: -1,
}

/**
 * Mappa effetto di mossa → stato applicato.
 * Le chiavi corrispondono a `MossaDef.effetto` (campo già presente).
 */
const EFFETTO_TO_STATO: Record<string, StatoAlterato> = {
  CONFUSIONE: 'Confuso',
  SONNO: 'Addormentato',
  VELENO: 'Avvelenato',
}

/** Applica uno stato a un'istanza (sovrascrive eventuale stato precedente). */
export function applicaStato(
  istanza: PokemonIstanza,
  tipo: StatoAlterato
): PokemonIstanza {
  return {
    ...istanza,
    stato: { tipo, turniRimanenti: DURATA_STATO[tipo] },
  }
}

/**
 * Risolve lo stato all'inizio del turno del pokemon.
 *
 * - Avvelenato: subisce 10% dell'hpMax come danno, lo stato persiste.
 * - Addormentato: 50% probabilità di svegliarsi (clear). Altrimenti
 *   turno saltato e turniRimanenti -= 1; al raggiungimento di 0 si
 *   sveglia comunque al prossimo turno.
 * - Confuso: 50% probabilità di colpirsi da solo (1d6 danno + turno
 *   perso). Altrimenti agisce normalmente. turniRimanenti -= 1 in
 *   entrambi i casi; al raggiungimento di 0 lo stato si pulisce.
 */
export function risolviStatoInizioTurno(
  istanza: PokemonIstanza,
  hpMax: number,
  rng: () => number = Math.random
): {
  istanza: PokemonIstanza
  puoAgire: boolean
  dannoSubito: number
  messaggi: string[]
} {
  if (!istanza.stato) {
    return { istanza, puoAgire: true, dannoSubito: 0, messaggi: [] }
  }

  const messaggi: string[] = []
  let stato: PokemonIstanza['stato'] = istanza.stato
  let hp = istanza.hp
  let dannoSubito = 0
  let puoAgire = true

  if (stato.tipo === 'Avvelenato') {
    dannoSubito = Math.max(1, Math.floor(hpMax * 0.1))
    hp = Math.max(0, hp - dannoSubito)
    messaggi.push(`${istanza.nome} subisce ${dannoSubito} danni dal veleno.`)
    // Veleno indefinito: nessun decremento
  } else if (stato.tipo === 'Addormentato') {
    if (rng() < 0.5) {
      messaggi.push(`${istanza.nome} si è svegliato!`)
      stato = undefined
    } else {
      messaggi.push(`${istanza.nome} sta dormendo profondamente...`)
      puoAgire = false
      const tr = stato.turniRimanenti - 1
      stato = tr > 0 ? { ...stato, turniRimanenti: tr } : undefined
    }
  } else if (stato.tipo === 'Confuso') {
    const tr = stato.turniRimanenti - 1
    if (rng() < 0.5) {
      dannoSubito = rollD6(1, rng)
      hp = Math.max(0, hp - dannoSubito)
      messaggi.push(
        `${istanza.nome} è confuso e si è colpito da solo! (${dannoSubito} danni)`
      )
      puoAgire = false
    } else {
      messaggi.push(`${istanza.nome} è confuso ma riesce ad agire.`)
    }
    stato = tr > 0 ? { ...stato, turniRimanenti: tr } : undefined
    if (!stato) messaggi.push(`${istanza.nome} non è più confuso.`)
  }

  return {
    istanza: { ...istanza, hp, stato },
    puoAgire,
    dannoSubito,
    messaggi,
  }
}

// =============================================================
// COSTANTI DI BILANCIAMENTO
// =============================================================

export const BATTLE_CONSTANTS = {
  STAB_MULTIPLIER: 1.5,
  XP_BASE_VITTORIA: 50,
} as const

// =============================================================
// HELPER PURI (porting di Mod_Utilities.bas)
// =============================================================

// Porting di: LanciaDadi da old_files/Mod_Utilities.txt
export function rollD6(n: number, rng: () => number = Math.random): number {
  const k = n <= 0 ? 1 : n
  let totale = 0
  for (let i = 0; i < k; i++) totale += Math.floor(rng() * 6) + 1
  return totale
}

// Porting di: RoundIntHalfUp da old_files/Mod_Utilities.txt
export function roundHalfUp(v: number): number {
  return v >= 0 ? Math.trunc(v + 0.5) : -Math.trunc(-v + 0.5)
}

// =============================================================
// CALCOLI DI BASE
// =============================================================

// Porting di: CalcolaHPMax da old_files/Mod_Utilities.txt
export function calcolaHPMax(istanza: PokemonIstanza): number {
  const specie = getPokemon(istanza.specieId)
  if (!specie) return 1
  if (istanza.livello <= 5) return specie.hpBase
  const crescita = CRESCITA_HP[specie.categoria] ?? 1
  return specie.hpBase + Math.trunc((istanza.livello - 5) * crescita)
}

// Porting di: OttieniParametriMossaAlLivello da old_files/Mod_Utilities.txt
export function getMossaAlLivello(
  mossa: MossaDef,
  livello: number
): { dadi: number; incremento: number } {
  const livStr = String(livello)
  let dadi = mossa.dadiPerLivello[livStr]
  let incremento = mossa.incrementoPerLivello[livStr]
  if (dadi === undefined || incremento === undefined) {
    for (let l = livello; l >= 5; l--) {
      if (dadi === undefined) dadi = mossa.dadiPerLivello[String(l)]
      if (incremento === undefined) incremento = mossa.incrementoPerLivello[String(l)]
      if (dadi !== undefined && incremento !== undefined) break
    }
  }
  return { dadi: dadi ?? 1, incremento: incremento ?? 0 }
}

// =============================================================
// CALCOLO DEL DANNO (porting di CalcolaEApplicaDanno)
// =============================================================

export function calcolaDanno(
  attaccante: PokemonIstanza,
  difensore: PokemonIstanza,
  numeroMossa: 0 | 1 | 2,
  rng: () => number = Math.random
): RisultatoMossa | null {
  const specieAtt = getPokemon(attaccante.specieId)
  const specieDif = getPokemon(difensore.specieId)
  if (!specieAtt || !specieDif) return null

  const mossaId = specieAtt.mosse[numeroMossa]
  if (!mossaId) return null
  const mossa = getMossa(mossaId)
  if (!mossa) return null

  const { dadi, incremento } = getMossaAlLivello(mossa, attaccante.livello)

  // Tiri singoli (per popolare RisultatoMossa.tiriDado, utile alla UI)
  const tiri: number[] = []
  for (let i = 0; i < dadi; i++) tiri.push(rollD6(1, rng))
  const sommaDadi = tiri.reduce((a, b) => a + b, 0)
  const dannoBase = sommaDadi + incremento

  const stab = mossa.tipo === specieAtt.tipo
  const moltStab = stab ? BATTLE_CONSTANTS.STAB_MULTIPLIER : 1
  const moltTipo = efficaciaTipo(mossa.tipo, specieDif.tipo)

  const dannoFinale = Math.max(1, roundHalfUp(dannoBase * moltStab * moltTipo))

  const messaggi: string[] = [`${attaccante.nome} usa ${mossa.nome}!`]
  if (stab) messaggi.push('(STAB)')
  if (moltTipo > 1) messaggi.push('È superefficace!')
  else if (moltTipo < 1 && moltTipo > 0) messaggi.push('Non è molto efficace...')
  else if (moltTipo === 0) messaggi.push('Non ha effetto!')
  messaggi.push(`${difensore.nome} subisce ${dannoFinale} danni.`)

  const difensoreSvenuto = difensore.hp - dannoFinale <= 0
  if (difensoreSvenuto) messaggi.push(`${difensore.nome} non può più combattere!`)

  // Trigger stato alterato (solo se la mossa ha un effetto mappato e il
  // difensore non è già afflitto e non è KO).
  let statoApplicato: StatoAlterato | undefined
  if (
    mossa.effetto &&
    EFFETTO_TO_STATO[mossa.effetto] &&
    !difensore.stato &&
    !difensoreSvenuto
  ) {
    const stato = EFFETTO_TO_STATO[mossa.effetto]
    const chance = mossa.valoreEffetto ?? 100
    if (rng() * 100 < chance) {
      statoApplicato = stato
      messaggi.push(`${difensore.nome} è ora ${stato}!`)
    }
  }

  return {
    attaccante,
    difensore,
    mossa,
    numDadi: dadi,
    incremento,
    tiriDado: tiri,
    dannoBase,
    moltiplicatoreTipo: moltTipo,
    stab,
    dannoFinale,
    difensoreSvenuto,
    messaggi,
    statoApplicato,
  }
}

// =============================================================
// CATTURA (porting di EseguiAzioneCattura)
// =============================================================

// Porting di: EseguiAzioneCattura da old_files/Mod_Battle_Engine.txt
export function tentaCattura(
  bersaglio: PokemonIstanza,
  rng: () => number = Math.random
): { riuscita: boolean; roll: number; soglia: number } {
  const specie = getPokemon(bersaglio.specieId)
  if (!specie) return { riuscita: false, roll: 0, soglia: 0 }

  const tasso = Math.max(1, specie.tassoCattura)
  const hpMax = calcolaHPMax(bersaglio)
  const roll = rollD6(1, rng) + rollD6(1, rng) + rollD6(1, rng) // 3..18
  const soglia = tasso * (2 - bersaglio.hp / hpMax)
  return { riuscita: roll <= soglia, roll, soglia }
}

// =============================================================
// AI (porting di ScegliMossaIA)
// =============================================================

export function scegliMossaIA(
  attaccante: PokemonIstanza,
  difensore: PokemonIstanza,
  rng: () => number = Math.random
): 0 | 1 | 2 {
  const specie = getPokemon(attaccante.specieId)
  if (!specie) return 0
  const specieDif = getPokemon(difensore.specieId)
  if (!specieDif) return 0

  const hpMax = calcolaHPMax(attaccante)
  const hpRatio = attaccante.hp / hpMax

  let migliore: 0 | 1 | 2 = 0
  let punteggioMax = -Infinity

  for (let i = 0; i < 3; i++) {
    const idx = i as 0 | 1 | 2
    const mossaId = specie.mosse[idx]
    if (!mossaId) continue
    const mossa = getMossa(mossaId)
    if (!mossa) continue

    const { dadi, incremento } = getMossaAlLivello(mossa, attaccante.livello)
    let punteggio = dadi * 3.5 + incremento
    if (mossa.tipo === specie.tipo) punteggio *= BATTLE_CONSTANTS.STAB_MULTIPLIER
    punteggio *= efficaciaTipo(mossa.tipo, specieDif.tipo)
    if (mossa.effetto === 'CURA') punteggio = hpRatio <= 0.2 ? 100 : -1

    if (punteggio > punteggioMax) {
      punteggioMax = punteggio
      migliore = idx
    } else if (Math.abs(punteggio - punteggioMax) < 0.0001 && rng() < 0.5) {
      migliore = idx
    }
  }

  return migliore
}

// =============================================================
// LIVELLI ED EVOLUZIONI
// Regola di gioco: 1 XP per nemico sconfitto, 1 XP = 1 livello,
// livello massimo 100. Per arrivare a lv 100 servono 99 KO.
// =============================================================

export const LIVELLO_MAX = 100

export function xpRichiestoPerLivello(_livello: number): number {
  return 1
}

export function xpGuadagnato(_nemico: PokemonIstanza): number {
  return 1
}

export function applicaXP(
  istanza: PokemonIstanza,
  xp: number
): {
  istanza: PokemonIstanza
  livelliGuadagnati: number
  evoluzionePendente: { nuovaSpecieId: number } | null
} {
  if (istanza.livello >= LIVELLO_MAX) {
    return { istanza: { ...istanza, xp: 0 }, livelliGuadagnati: 0, evoluzionePendente: null }
  }

  let nuova = { ...istanza, xp: istanza.xp + xp }
  let livelliGuadagnati = 0
  let evoluzionePendente: { nuovaSpecieId: number } | null = null

  while (nuova.xp >= xpRichiestoPerLivello(nuova.livello) && nuova.livello < LIVELLO_MAX) {
    nuova.xp -= xpRichiestoPerLivello(nuova.livello)
    nuova.livello += 1
    livelliGuadagnati += 1
    nuova.hp = calcolaHPMax(nuova)

    const specie = getPokemon(nuova.specieId)
    if (
      specie?.livelloEvoluzione &&
      specie.evoluzioneId &&
      nuova.livello >= specie.livelloEvoluzione
    ) {
      evoluzionePendente = { nuovaSpecieId: specie.evoluzioneId }
      break
    }
  }

  if (nuova.livello >= LIVELLO_MAX) nuova.xp = 0
  return { istanza: nuova, livelliGuadagnati, evoluzionePendente }
}

// =============================================================
// HELPER DI BATTAGLIA
// =============================================================

// Porting di: DeterminaPrimoTurno da old_files/Mod_Utilities.txt
export function determinaIniziativa(
  livelloA: number,
  livelloB: number,
  rng: () => number = Math.random
): Lato {
  if (livelloA > livelloB) return 'A'
  if (livelloB > livelloA) return 'B'
  return rng() < 0.5 ? 'A' : 'B'
}

export function squadraSconfitta(squadra: PokemonIstanza[] | undefined): boolean {
  if (!squadra || squadra.length === 0) return false
  return squadra.every((p) => p.hp <= 0)
}

// =============================================================
// MONETE (porting di CalcolaVariazioneMonete)
// =============================================================

export type EsitoBattaglia = 'vittoria' | 'sconfitta'
export type TipoAvversario = 'NPC' | 'Capopalestra' | 'Selvatico' | 'PVP'

// Porting di: CalcolaVariazioneMonete da old_files/Mod_Battle_Engine.txt
export function calcolaVariazioneMonete(
  esito: EsitoBattaglia,
  tipoAvversario: TipoAvversario
): number {
  if (esito === 'vittoria') {
    if (tipoAvversario === 'NPC') return 200
    if (tipoAvversario === 'Capopalestra') return 1000
    return 0 // Selvatico/PVP: niente monete
  }
  if (tipoAvversario === 'NPC' || tipoAvversario === 'Capopalestra') return -200
  return 0
}
