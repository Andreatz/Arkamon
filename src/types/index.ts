/**
 * Tipi del dominio Arkamon.
 * Questi tipi rappresentano l'intero modello di gioco e sono condivisi
 * tra engine, store e componenti UI.
 */

// =============================================================
// TIPI BASE
// =============================================================

export type TipoPokemon =
  | 'Normale'
  | 'Elettro'
  | 'Fuoco'
  | 'Terra'
  | 'Acqua'
  | 'Erba'
  | 'Oscurità'
  | 'Psico'

export type CategoriaHP = 'Lenta' | 'Media' | 'Veloce' | 'Leggendaria'

export type Probabilita = 'Comune' | 'Medio' | 'Difficile'

export type TipoAllenatore = 'PVP' | 'NPC'

export type TipoBattaglia = 'Selvatico' | 'NPC' | 'PVP'

export type Lato = 'A' | 'B'

/** Stati alterati di un pokemon in battaglia (porting roadmap Fase B). */
export type StatoAlterato = 'Confuso' | 'Addormentato' | 'Avvelenato'

/** Stato attivo su un pokemon. turniRimanenti = -1 → indefinito (es. veleno). */
export interface Stato {
  tipo: StatoAlterato
  turniRimanenti: number
}

// =============================================================
// DATI STATICI (JSON)
// =============================================================

/** Definizione di una specie di Pokémon (dal foglio Pokemon_Base) */
export interface PokemonSpecie {
  id: number
  nome: string
  categoria: CategoriaHP
  tipo: TipoPokemon
  hpBase: number
  /** ID delle 3 mosse possedute. 0 = nessuna */
  mosse: [number, number, number]
  /** Livello di evoluzione, null se non evolve */
  livelloEvoluzione: number | null
  /** ID della specie evoluta, null se non evolve */
  evoluzioneId: number | null
  /** Tasso base di cattura (0-5, più alto = più facile) */
  tassoCattura: number
}

/** Definizione di una mossa (dal foglio Mosse) */
export interface MossaDef {
  id: number
  nome: string
  tipo: TipoPokemon
  /** Effetto speciale (es. "CURA", "RIDUZIONE"), null se nessuno */
  effetto: string | null
  /** Valore numerico associato all'effetto */
  valoreEffetto: number | null
  /** Numero di dadi D6 per livello {"5": 1, "6": 1, ...} */
  dadiPerLivello: Record<string, number>
  /** Incremento fisso per livello {"5": 0, "6": 0, ...} */
  incrementoPerLivello: Record<string, number>
}

/** Tabella di efficacia dei tipi */
export interface TabellaTipi {
  tipi: TipoPokemon[]
  /** efficacia[attaccante][difensore] = moltiplicatore (es. 1.5, 0.5, 1) */
  efficacia: Record<TipoPokemon, Record<TipoPokemon, number>>
}

/** Configurazione di un luogo della mappa */
export interface Mappa {
  nome: string
  idDiapositiva: number | null
}

/** Un possibile incontro selvatico in un cespuglio */
export interface IncontroSelvatico {
  luogo: string
  cespuglio: string // 'A', 'B', 'C', 'D'
  pokemonId: number
  probabilita: Probabilita
  livelloMin: number
  livelloMax: number
}

/** Un allenatore (NPC, capopalestra o rivale) */
export interface AllenatoreDef {
  id: number
  nome: string
  luogo: string
  tipo: TipoAllenatore
  squadra: { pokemonId: number; livello: number }[]
}

// =============================================================
// STATO RUNTIME (cosa cambia durante una partita)
// =============================================================

/** Istanza viva di un Pokémon (uno dei 6 in squadra o nel deposito) */
export interface PokemonIstanza {
  /** ID univoco dell'istanza, per distinguere due Vyrath con stessa specie */
  istanzaId: string
  /** ID della specie corrente (cambia se si evolve) */
  specieId: number
  /** Nome custom o nome della specie */
  nome: string
  livello: number
  /** HP correnti */
  hp: number
  /** XP guadagnati al livello attuale */
  xp: number
  /** Stato alterato attivo (se presente). Pulito a fine battaglia. */
  stato?: Stato
}

/** Stato di un singolo giocatore */
export interface StatoGiocatore {
  id: 1 | 2
  nome: string
  squadra: PokemonIstanza[] // max 6
  /** 30 box × 35 slot (impostazione classica). Sparse: solo gli slot occupati */
  deposito: Record<string, PokemonIstanza> // chiave: "box:slot" es. "1:5"
  /** Cespugli già visitati (formato: "Percorso_1:A") */
  cespugliVisitati: Set<string>
  /** Allenatori già sconfitti */
  allenatoriSconfitti: Set<number>
  /** Monete possedute (porting di Stato_Giocatore.Monete del VBA) */
  monete: number
}

/** Stato della battaglia in corso (analogo del foglio Battaglia_Corrente VBA) */
export interface StatoBattaglia {
  tipo: TipoBattaglia
  /** Lato A = giocatore principale, lato B = avversario */
  pokemonA: PokemonIstanza
  pokemonB: PokemonIstanza
  hpMaxA: number
  hpMaxB: number
  turnoCorrente: Lato
  /** Per battaglie NPC/PVP: squadre intere */
  squadraA?: PokemonIstanza[]
  squadraB?: PokemonIstanza[]
  /** Luogo di ritorno dopo la battaglia */
  luogoRitorno: string
  /** ID dell'allenatore avversario (se NPC/PVP) */
  allenatoreId?: number
  /** Log degli eventi della battaglia (per UI) */
  log: string[]
  /** Flag per evoluzione in attesa post-battaglia */
  evoluzioneInAttesa: { istanzaId: string; nuovaSpecieId: number } | null
}

/** Risultato del calcolo di danno (per UI: HP barre, animazioni) */
export interface RisultatoMossa {
  attaccante: PokemonIstanza
  difensore: PokemonIstanza
  mossa: MossaDef
  numDadi: number
  incremento: number
  tiriDado: number[]
  dannoBase: number
  moltiplicatoreTipo: number
  stab: boolean
  dannoFinale: number
  difensoreSvenuto: boolean
  messaggi: string[]
  /** Stato alterato innescato sul difensore (se la mossa ha effetto e il roll è passato) */
  statoApplicato?: StatoAlterato
}

// =============================================================
// SCENE / NAVIGAZIONE
// =============================================================

export type SceneId =
  | 'titolo'
  | 'laboratorio'
  | 'mappa-principale'
  | 'percorso'
  | 'citta'
  | 'palestra'
  | 'centro-pokemon'
  | 'battaglia'
  | 'deposito'
  | 'squadra'

export interface NavigazioneScena {
  scena: SceneId
  /** Parametri opzionali (es. nome luogo per percorso/città) */
  payload?: Record<string, unknown>
}
