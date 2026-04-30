import { useGameStore, creaIstanza } from '@store/gameStore'
import { useState, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  calcolaDanno,
  calcolaHPMax,
  scegliMossaIA,
  tentaCattura,
  applicaXP,
  xpGuadagnato,
  applicaStato,
  risolviStatoInizioTurno,
  èMossaCura,
  applicaMossaCura,
} from '@engine/battleEngine'
import { getPokemon, getMossa, getAllenatore } from '@data/index'
import { calcolaVariazioneMonete, type TipoAvversario } from '@engine/battleEngine'
import type { PokemonIstanza, MossaDef, StatoAlterato } from '@/types'
import { getBackground, BATTLE_BG_DEFAULT } from '@data/backgrounds'
import { assetUrl } from '@/utils/assetUrl'

const STATO_BADGE: Record<StatoAlterato, { label: string; color: string; emoji: string }> = {
  Confuso: { label: 'CONF', color: 'bg-fuchsia-500', emoji: '💫' },
  Addormentato: { label: 'ZZZ', color: 'bg-blue-500', emoji: '😴' },
  Avvelenato: { label: 'PSN', color: 'bg-purple-600', emoji: '☠️' },
}

type PendingSwitch = {
  motivo: string
  prossimoPasso: 'continuaA' | 'passaAdA' | 'passaAB'
  pendingB?: PokemonIstanza
}

/**
 * Scena di battaglia.
 *
 * Supporta:
 * - Battaglie selvatiche (1 vs 1) con cattura
 * - Battaglie NPC/PVP multi-pokemon (scambio manuale su KO del giocatore)
 * - XP per nemico sconfitto (1 KO = 1 livello, cap 100)
 * - Evoluzioni inline al raggiungimento della soglia
 *
 * Aggiornamenti del Pokémon attivo (HP, livello, evoluzione) vengono
 * persistiti nello store all'uscita dalla scena.
 */
export function BattagliaScene() {
  const vaiAScena = useGameStore((s) => s.vaiAScena)
  const battaglia = useGameStore((s) => s.battaglia)
  const terminaBattaglia = useGameStore((s) => s.terminaBattaglia)
  const aggiungiPokemon = useGameStore((s) => s.aggiungiPokemon)
  const aggiornaPokemon = useGameStore((s) => s.aggiornaPokemon)
  const giocatoreAttivo = useGameStore((s) => s.giocatoreAttivo)
  const risolviBattagliaNPC = useGameStore((s) => s.risolviBattagliaNPC)
  const usaOggetto = useGameStore((s) => s.usaOggetto)
  const masterballRimaste = useGameStore((s) =>
    s.giocatoreAttivo === 1
      ? s.giocatore1.inventario.masterball ?? 0
      : s.giocatore2.inventario.masterball ?? 0
  )
  const [esito, setEsito] = useState<'vittoria' | 'sconfitta' | null>(null)

  const [pkmnA, setPkmnA] = useState<PokemonIstanza | null>(null)
  const [pkmnB, setPkmnB] = useState<PokemonIstanza | null>(null)
  const [squadraA, setSquadraA] = useState<PokemonIstanza[]>([])
  const [squadraB, setSquadraB] = useState<PokemonIstanza[]>([])
  const [log, setLog] = useState<string[]>([])
  const [turnoA, setTurnoA] = useState(true)
  const [shaking, setShaking] = useState<'A' | 'B' | null>(null)
  /** In PvP: vero quando si attende la scelta della mossa di B (input umano). */
  const [mostraMoseB, setMostraMoseB] = useState(false)
  const [attesaAvversario, setAttesaAvversario] = useState<PokemonIstanza | null>(null)
  const [scambioRichiesto, setScambioRichiesto] = useState<PendingSwitch | null>(null)
  /**
   * In PvP: pausa esplicita tra fine turno corrente e inizio turno successivo.
   * Mostra un pulsante "Passa il controllo a ..." che il giocatore deve cliccare
   * per evitare che chi sta passando il PC veda le mosse dell'altro.
   * - 'A→B' richiede `pendingB` (verrà passato a turnoAvversario al click)
   * - 'B→A' nessun payload: al click si limita a riassegnare il turno ad A
   */
  const [attesaPassaggio, setAttesaPassaggio] = useState<
    | { direzione: 'A→B'; pendingB: PokemonIstanza }
    | { direzione: 'B→A' }
    | null
  >(null)
  const [terminata, setTerminata] = useState(false)
  // Evoluzioni accumulate durante la battaglia: applicate dopo, in EvoluzioneScene
  const [evoluzioniInAttesa, setEvoluzioniInAttesa] = useState<
    { istanzaId: string; oldSpecieId: number; newSpecieId: number }[]
  >([])

  useEffect(() => {
    if (battaglia) {
      setPkmnA(battaglia.pokemonA)
      setPkmnB(battaglia.pokemonB)
      setSquadraA(battaglia.squadraA ?? [battaglia.pokemonA])
      setSquadraB(battaglia.squadraB ?? [battaglia.pokemonB])
      setLog(battaglia.log)
    } else {
      // Fallback demo: Vyrath vs Weedrug lvl 5
      const a = creaIstanza(1, 5)
      const b = creaIstanza(13, 5)
      setPkmnA(a)
      setPkmnB(b)
      setSquadraA(a ? [a] : [])
      setSquadraB(b ? [b] : [])
      setLog([`Appare ${b?.nome} selvatico!`])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const luogoRitorno = battaglia?.luogoRitorno ?? 'mappa-principale'
  const isNPC = !!battaglia && battaglia.tipo !== 'Selvatico' && battaglia.allenatoreId !== undefined
  const isSelvatico = !battaglia || battaglia.tipo === 'Selvatico'
  const isPvP = !!battaglia && battaglia.tipo === 'PVP'
  const isPercorso = !!luogoRitorno && /^Percorso_/.test(luogoRitorno)

  /** Aggiorna l'istanza nella squadra mantenendo l'ordine. */
  const updateInSquadra = (squadra: PokemonIstanza[], updated: PokemonIstanza) =>
    squadra.map((p) => (p.istanzaId === updated.istanzaId ? updated : p))

  const tornaIndietro = () => {
    if (isNPC && esito) risolviBattagliaNPC(esito)
    // Persiste tutte le modifiche (livello, xp). L'evoluzione vera e propria
    // (cambio di specieId) avviene dopo, nella EvoluzioneScene.
    for (const p of squadraA) aggiornaPokemon(giocatoreAttivo, p)
    terminaBattaglia(true)

    if (evoluzioniInAttesa.length > 0) {
      vaiAScena('evoluzione', {
        evoluzioni: evoluzioniInAttesa,
        luogoRitorno,
        giocatoreId: giocatoreAttivo,
      })
      return
    }

    if (isPercorso) {
      vaiAScena('percorso', { luogo: luogoRitorno })
    } else if (luogoRitorno && luogoRitorno !== 'mappa-principale') {
      vaiAScena('citta', { luogo: luogoRitorno })
    } else {
      vaiAScena('mappa-principale')
    }
  }

  if (!pkmnA || !pkmnB) return <div className="text-white p-8">Caricamento...</div>

  const specieB = getPokemon(pkmnB.specieId)!

  /** Handler PvP: il giocatore B clicca una mossa. */
  const eseguiMossaPvP_B = (numeroMossa: 0 | 1 | 2) => {
    if (terminata || turnoA || !mostraMoseB) return
    setMostraMoseB(false)
    eseguiMossaB(pkmnB, calcolaHPMax(pkmnB), numeroMossa)
  }

  /**
   * Termina il turno del giocatore A.
   * - PvP: pausa esplicita; il giocatore deve cliccare "Passa il controllo".
   * - NPC/Selvatico: mostra il pulsante "Avversario..." nell'InfoBox.
   */
  const passaTurnoAaB = (nuovoB: PokemonIstanza, delayMs = 1500) => {
    setTurnoA(false)
    if (isPvP) {
      setAttesaPassaggio({ direzione: 'A→B', pendingB: nuovoB })
      return
    }
    window.setTimeout(() => setAttesaAvversario(nuovoB), Math.min(delayMs, 250))
  }

  /**
   * Termina il turno di B.
   * - PvP: pausa esplicita prima di ridare il turno ad A.
   * - NPC: turno ad A immediato.
   */
  const passaTurnoBaA = () => {
    setAttesaAvversario(null)
    if (isPvP) {
      setAttesaPassaggio({ direzione: 'B→A' })
      return
    }
    setTurnoA(true)
  }

  /** Click sul pulsante esplicito di passaggio turno (solo PvP). */
  const confermaPassaggio = () => {
    if (!attesaPassaggio) return
    if (attesaPassaggio.direzione === 'A→B') {
      const nb = attesaPassaggio.pendingB
      setAttesaPassaggio(null)
      turnoAvversario(nb)
    } else {
      setAttesaPassaggio(null)
      setTurnoA(true)
    }
  }

  const confermaTurnoAvversario = () => {
    if (!attesaAvversario) return
    const pendingB = attesaAvversario
    setAttesaAvversario(null)
    turnoAvversario(pendingB)
  }

  const apriScambio = (richiesta: PendingSwitch) => {
    setMostraMoseB(false)
    setAttesaAvversario(null)
    setLog((l) => [...l, 'Scegli un Pokemon dalla squadra.'])
    setScambioRichiesto(richiesta)
  }

  const scegliPokemonCambio = (scelto: PokemonIstanza) => {
    if (!scambioRichiesto || scelto.hp <= 0) return
    const richiesta = scambioRichiesto
    setPkmnA(scelto)
    setScambioRichiesto(null)
    setLog((l) => [...l, `${scelto.nome} entra in campo!`])

    if (richiesta.prossimoPasso === 'passaAB') {
      passaTurnoAaB(richiesta.pendingB ?? pkmnB, 300)
      return
    }

    if (richiesta.prossimoPasso === 'passaAdA') {
      passaTurnoBaA()
      return
    }

    setTurnoA(true)
  }

  const specieA = getPokemon(pkmnA.specieId)!
  const hpMaxA = calcolaHPMax(pkmnA)
  const hpMaxB = calcolaHPMax(pkmnB)

  /**
   * Premia pokemonA con XP per il nemico sconfitto, gestisce level-up.
   * L'eventuale evoluzione viene accodata in `evoluzioniInAttesa` e
   * processata dopo la fine della battaglia nella EvoluzioneScene
   * (NON applicata inline qui, per coerenza con il flusso classico
   * "vittoria → schermata evoluzione").
   */
  const premiaConXP = (
    attivo: PokemonIstanza,
    sconfitto: PokemonIstanza
  ): PokemonIstanza => {
    const xpRes = applicaXP(attivo, xpGuadagnato(sconfitto))
    const messaggi: string[] = []
    if (xpRes.livelliGuadagnati > 0) {
      messaggi.push(`${attivo.nome} è salito al livello ${xpRes.istanza.livello}!`)
    }
    if (xpRes.evoluzionePendente) {
      // Solo log + accumulo. L'evoluzione viene applicata in EvoluzioneScene.
      messaggi.push(`${attivo.nome} sembra cambiare... (evolverà a fine battaglia)`)
      setEvoluzioniInAttesa((prev) => [
        ...prev,
        {
          istanzaId: attivo.istanzaId,
          oldSpecieId: attivo.specieId,
          newSpecieId: xpRes.evoluzionePendente!.nuovaSpecieId,
        },
      ])
    }
    if (messaggi.length > 0) setLog((l) => [...l, ...messaggi])
    return xpRes.istanza
  }

  const eseguiMossa = (numeroMossa: 0 | 1 | 2) => {
    if (terminata || !turnoA) return

    // Risoluzione stato a inizio turno (avvelenamento/sonno/confusione)
    const statoRes = risolviStatoInizioTurno(pkmnA, hpMaxA)
    if (statoRes.messaggi.length > 0) setLog((l) => [...l, ...statoRes.messaggi])
    const pkmnAEffettivo = statoRes.istanza
    setPkmnA(pkmnAEffettivo)
    setSquadraA((sq) => updateInSquadra(sq, pkmnAEffettivo))

    if (pkmnAEffettivo.hp <= 0) {
      // Avvelenamento o auto-danno confusione ha ucciso pokemonA
      const nextA = squadraA.find(
        (p) => p.istanzaId !== pkmnAEffettivo.istanzaId && p.hp > 0
      )
      if (nextA) {
        setLog((l) => [...l, `${pkmnAEffettivo.nome} e caduto!`])
        apriScambio({
          motivo: `${pkmnAEffettivo.nome} non puo continuare.`,
          prossimoPasso: 'continuaA',
        })
        return
      }
      setLog((l) => [...l, 'Hai perso la battaglia...'])
      setEsito('sconfitta')
      setTerminata(true)
      return
    }

    if (!statoRes.puoAgire) {
      // Turno saltato: passa all'avversario
      passaTurnoAaB(pkmnB, 1200)
      return
    }

    // Mossa di cura: niente danno al nemico, solo ripristino HP all'attaccante.
    const mossaScelta = specieA.mosse[numeroMossa]
      ? getMossa(specieA.mosse[numeroMossa]!)
      : null
    if (mossaScelta && èMossaCura(mossaScelta)) {
      const cura = applicaMossaCura(pkmnAEffettivo, mossaScelta, hpMaxA)
      setPkmnA(cura.istanza)
      setSquadraA((sq) => updateInSquadra(sq, cura.istanza))
      setLog((l) => [...l, ...cura.messaggi])
      passaTurnoAaB(pkmnB, 1200)
      return
    }

    const ris = calcolaDanno(pkmnAEffettivo, pkmnB, numeroMossa)
    if (!ris) return

    setShaking('B')
    let nuovoB = { ...pkmnB, hp: Math.max(0, pkmnB.hp - ris.dannoFinale) }
    if (ris.statoApplicato && nuovoB.hp > 0) {
      nuovoB = applicaStato(nuovoB, ris.statoApplicato)
    }
    setPkmnB(nuovoB)
    const nuovaSquadraB = updateInSquadra(squadraB, nuovoB)
    setSquadraB(nuovaSquadraB)
    setLog((l) => [...l, ...ris.messaggi])

    setTimeout(() => setShaking(null), 400)

    // Autodanno mossa Suprema sull'attaccante (può auto-KO)
    let aDopoAutodanno = pkmnAEffettivo
    if (ris.autodanno && ris.autodanno > 0) {
      aDopoAutodanno = {
        ...pkmnAEffettivo,
        hp: Math.max(0, pkmnAEffettivo.hp - ris.autodanno),
      }
      setPkmnA(aDopoAutodanno)
      setSquadraA((sq) => updateInSquadra(sq, aDopoAutodanno))
    }

    if (nuovoB.hp <= 0) {
      // XP a pokemonA per il KO (regola: 1 nemico = 1 xp = 1 livello)
      const aggiornatoA = premiaConXP(aDopoAutodanno, nuovoB)
      setPkmnA(aggiornatoA)
      setSquadraA((sq) => updateInSquadra(sq, aggiornatoA))

      // Cerca prossimo nemico vivo
      const nextB = nuovaSquadraB.find(
        (p) => p.istanzaId !== nuovoB.istanzaId && p.hp > 0
      )
      if (nextB && isNPC) {
        setLog((l) => [...l, `L'avversario manda in campo ${nextB.nome}!`])
        setPkmnB(nextB)
        // Il giocatore mantiene il turno dopo il KO + switch nemico
        return
      }
      // Nessun altro avversario → vittoria
      setLog((l) => [...l, 'Hai vinto la battaglia!'])
      setEsito('vittoria')
      setTerminata(true)
      return
    }

    // Auto-KO da mossa Suprema: gestisci switch o sconfitta
    if (aDopoAutodanno.hp <= 0) {
      const nextA = squadraA.find(
        (p) => p.istanzaId !== aDopoAutodanno.istanzaId && p.hp > 0
      )
      if (nextA) {
        setLog((l) => [
          ...l,
          `${aDopoAutodanno.nome} e esausto!`,
        ])
        apriScambio({
          motivo: `${aDopoAutodanno.nome} non puo continuare.`,
          prossimoPasso: 'passaAB',
          pendingB: nuovoB,
        })
        // Turno passa comunque all'avversario (la mossa è stata usata)
        return
      }
      setLog((l) => [...l, 'Hai perso la battaglia...'])
      setEsito('sconfitta')
      setTerminata(true)
      return
    }

    // Turno avversario dopo 1.5s
    passaTurnoAaB(nuovoB, 1500)
  }

  // Porting di: EseguiAzioneCattura da old_files/Mod_Battle_Engine.txt
  const eseguiCattura = () => {
    if (terminata || !turnoA) return
    const ris = tentaCattura(pkmnB)
    setLog((l) => [
      ...l,
      `Lanci una pokeball... (3d6=${ris.roll}, soglia=${ris.soglia.toFixed(1)})`,
    ])
    if (ris.riuscita) {
      setLog((l) => [...l, `${pkmnB.nome} è stato catturato!`])
      aggiungiPokemon(giocatoreAttivo, pkmnB)
      setEsito('vittoria')
      setTerminata(true)
      return
    }
    setLog((l) => [...l, `${pkmnB.nome} è scappato dalla pokeball!`])
    // Cattura fallita = il turno è perso → tocca al selvatico
    setTurnoA(false)
    setAttesaAvversario(pkmnB)
  }

  /** Cattura garantita al 100% via Masterball (consuma 1 oggetto). */
  const eseguiMasterball = () => {
    if (terminata || !turnoA) return
    if (!usaOggetto(giocatoreAttivo, 'masterball')) return
    setLog((l) => [
      ...l,
      `Lanci una Masterball... 💎`,
      `${pkmnB.nome} è stato catturato!`,
    ])
    aggiungiPokemon(giocatoreAttivo, pkmnB)
    setEsito('vittoria')
    setTerminata(true)
  }

  /**
   * Avvio del turno di B: risolve stato/HP e poi:
   * - PvP: mostra le mosse di B per input umano (stop, attende click);
   * - NPC: pesca subito la mossa via AI ed esegue.
   */
  const turnoAvversario = (statoBcorrente: PokemonIstanza) => {
    const hpMaxBcorrente = calcolaHPMax(statoBcorrente)
    const statoRes = risolviStatoInizioTurno(statoBcorrente, hpMaxBcorrente)
    if (statoRes.messaggi.length > 0) setLog((l) => [...l, ...statoRes.messaggi])
    const bEffettivo = statoRes.istanza
    setPkmnB(bEffettivo)
    setSquadraB((sq) => updateInSquadra(sq, bEffettivo))

    if (bEffettivo.hp <= 0) {
      const nextB = squadraB.find(
        (p) => p.istanzaId !== bEffettivo.istanzaId && p.hp > 0
      )
      if (nextB && isNPC) {
        setLog((l) => [...l, `${bEffettivo.nome} è caduto! L'avversario manda in campo ${nextB.nome}!`])
        setPkmnB(nextB)
        setTurnoA(true)
        return
      }
      // Vittoria del giocatore via danno da stato
      const aggiornatoA = premiaConXP(pkmnA, bEffettivo)
      setPkmnA(aggiornatoA)
      setSquadraA((sq) => updateInSquadra(sq, aggiornatoA))
      setLog((l) => [...l, 'Hai vinto la battaglia!'])
      setEsito('vittoria')
      setTerminata(true)
      return
    }

    if (!statoRes.puoAgire) {
      passaTurnoBaA()
      return
    }

    if (isPvP) {
      // Attesa input umano per B: la pulsantiera mosse di B viene mostrata.
      setMostraMoseB(true)
      return
    }

    // NPC: AI sceglie ed esegue subito
    const mossaIdx = scegliMossaIA(bEffettivo, pkmnA)
    eseguiMossaB(bEffettivo, hpMaxBcorrente, mossaIdx)
  }

  /**
   * Esecuzione della mossa di B (condivisa tra NPC e PvP umano).
   * Applica cura/suprema/autodanno e gestisce KO.
   */
  const eseguiMossaB = (
    bEffettivo: PokemonIstanza,
    hpMaxBcorrente: number,
    mossaIdx: 0 | 1 | 2
  ) => {
    const specieB = getPokemon(bEffettivo.specieId)
    const mossaIdB = specieB?.mosse[mossaIdx] ?? null
    const mossaDefB = mossaIdB ? getMossa(mossaIdB) : null

    // Cura lato B: ripristina HP, niente danno ad A.
    if (mossaDefB && èMossaCura(mossaDefB)) {
      const cura = applicaMossaCura(bEffettivo, mossaDefB, hpMaxBcorrente)
      setPkmnB(cura.istanza)
      setSquadraB((sq) => updateInSquadra(sq, cura.istanza))
      setLog((l) => [...l, ...cura.messaggi])
      passaTurnoBaA()
      return
    }

    const ris = calcolaDanno(bEffettivo, pkmnA, mossaIdx)
    if (!ris) {
      passaTurnoBaA()
      return
    }
    setShaking('A')
    let nuovoA = { ...pkmnA, hp: Math.max(0, pkmnA.hp - ris.dannoFinale) }
    if (ris.statoApplicato && nuovoA.hp > 0) {
      nuovoA = applicaStato(nuovoA, ris.statoApplicato)
    }
    setPkmnA(nuovoA)
    const nuovaSquadraA = updateInSquadra(squadraA, nuovoA)
    setSquadraA(nuovaSquadraA)
    setLog((l) => [...l, ...ris.messaggi])
    setTimeout(() => setShaking(null), 400)

    // Autodanno mossa Suprema lato AI
    let bDopoAutodanno = bEffettivo
    if (ris.autodanno && ris.autodanno > 0) {
      bDopoAutodanno = {
        ...bEffettivo,
        hp: Math.max(0, bEffettivo.hp - ris.autodanno),
      }
      setPkmnB(bDopoAutodanno)
      setSquadraB((sq) => updateInSquadra(sq, bDopoAutodanno))
    }

    if (nuovoA.hp <= 0) {
      const nextA = nuovaSquadraA.find(
        (p) => p.istanzaId !== nuovoA.istanzaId && p.hp > 0
      )
      if (nextA) {
        setLog((l) => [
          ...l,
          `${nuovoA.nome} e KO!`,
        ])
        apriScambio({
          motivo: `${nuovoA.nome} e KO.`,
          prossimoPasso: 'passaAdA',
        })
        return
      }
      setLog((l) => [...l, 'Hai perso la battaglia...'])
      setEsito('sconfitta')
      setTerminata(true)
      return
    }

    // Auto-KO lato AI da mossa Suprema
    if (bDopoAutodanno.hp <= 0) {
      const nextB = squadraB.find(
        (p) => p.istanzaId !== bDopoAutodanno.istanzaId && p.hp > 0
      )
      if (nextB && isNPC) {
        setLog((l) => [
          ...l,
          `${bDopoAutodanno.nome} è esausto! L'avversario manda in campo ${nextB.nome}!`,
        ])
        setPkmnB(nextB)
        setTurnoA(true)
        return
      }
      const aggiornatoA = premiaConXP(nuovoA, bDopoAutodanno)
      setPkmnA(aggiornatoA)
      setSquadraA((sq) => updateInSquadra(sq, aggiornatoA))
      setLog((l) => [...l, 'Hai vinto la battaglia!'])
      setEsito('vittoria')
      setTerminata(true)
      return
    }

    passaTurnoBaA()
  }

  const bgBattaglia = getBackground(luogoRitorno) ?? BATTLE_BG_DEFAULT
  const mosseA = specieA.mosse
    .map((mossaId, i) => {
      const mossa = mossaId ? getMossa(mossaId) : null
      return mossa ? { mossa, idx: i as 0 | 1 | 2 } : null
    })
    .filter((entry): entry is { mossa: MossaDef; idx: 0 | 1 | 2 } => entry !== null)
  const mosseB = specieB.mosse
    .map((mossaId, i) => {
      const mossa = mossaId ? getMossa(mossaId) : null
      return mossa ? { mossa, idx: i as 0 | 1 | 2 } : null
    })
    .filter((entry): entry is { mossa: MossaDef; idx: 0 | 1 | 2 } => entry !== null)

  return (
    <div
      className="w-full h-full relative bg-cover bg-center"
      style={{ backgroundImage: `url(${bgBattaglia})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-transparent to-slate-950/60 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none" />

      {/* Indicatore squadra (solo NPC) */}
      {isNPC && (
        <>
          <SquadIndicator squadra={squadraB} position="top-left" />
          <SquadIndicator squadra={squadraA} position="bottom-right" />
        </>
      )}

      {/* Pokémon avversario (alto a destra) — chiave su istanzaId per riattivare slide-in al cambio */}
      <AnimatePresence mode="popLayout">
        <PokemonBattleSlot
          key={pkmnB.istanzaId}
          istanza={pkmnB}
          position="top-right"
          shaking={shaking === 'B'}
          lunging={shaking === 'A'}
        />
      </AnimatePresence>

      {/* Pokémon giocatore (basso a sinistra) */}
      <AnimatePresence mode="popLayout">
        <PokemonBattleSlot
          key={pkmnA.istanzaId}
          istanza={pkmnA}
          position="bottom-left"
          shaking={shaking === 'A'}
          lunging={shaking === 'B'}
        />
      </AnimatePresence>

      <HpBar
        nome={pkmnB.nome}
        livello={pkmnB.livello}
        hp={pkmnB.hp}
        hpMax={hpMaxB}
        stato={pkmnB.stato?.tipo}
        side="enemy"
        className="top-[17%] right-[24%]"
      />

      <HpBar
        nome={pkmnA.nome}
        livello={pkmnA.livello}
        hp={pkmnA.hp}
        hpMax={hpMaxA}
        stato={pkmnA.stato?.tipo}
        side="player"
        className="top-[55%] left-[33%]"
      />

      {/* InfoBox eventi */}
      <InfoBox
        messaggi={log}
        showOpponentButton={!!attesaAvversario && !terminata}
        onOpponentTurn={confermaTurnoAvversario}
      />

      {/* Pulsanti mosse di A — nascosti in PvP quando aspetta B o passaggio turno */}
      {!terminata && !mostraMoseB && !attesaPassaggio && !attesaAvversario && !scambioRichiesto && (
        <div className="absolute bottom-5 right-6 z-30 w-[min(52vw,760px)] rounded-lg border border-white/15 bg-slate-950/80 p-3 shadow-2xl backdrop-blur-sm">
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.max(1, mosseA.length)}, minmax(0, 1fr))` }}
          >
            {mosseA.map(({ mossa, idx }) => (
              <MoveButton
                key={idx}
                mossa={mossa}
                livello={pkmnA.livello}
                disabled={!turnoA}
                onClick={() => eseguiMossa(idx)}
              />
            ))}
          </div>

          {isSelvatico && battaglia && (
            <div className="mt-3 flex justify-end gap-2">
              <ActionButton disabled={!turnoA} onClick={eseguiCattura}>
                Cattura
              </ActionButton>
              {masterballRimaste > 0 && (
                <ActionButton disabled={!turnoA} onClick={eseguiMasterball}>
                  Masterball x{masterballRimaste}
                </ActionButton>
              )}
            </div>
          )}
        </div>
      )}

      {/* PvP: pulsanti mosse di B (input umano) */}
      {isPvP && mostraMoseB && !terminata && !scambioRichiesto && (
        <div className="absolute top-28 left-6 z-30 w-[min(52vw,760px)] rounded-lg border border-white/15 bg-slate-950/80 p-3 shadow-2xl backdrop-blur-sm">
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.max(1, mosseB.length)}, minmax(0, 1fr))` }}
          >
            {mosseB.map(({ mossa, idx }) => (
              <MoveButton
                key={`B-${idx}`}
                mossa={mossa}
                livello={pkmnB.livello}
                disabled={false}
                onClick={() => eseguiMossaPvP_B(idx)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pulsante esplicito di passaggio turno (solo PvP) */}
      {isPvP && attesaPassaggio && !terminata && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={confermaPassaggio}
            className="arka-button text-base px-6 py-3 shadow-lg"
          >
            ▶ Passa il controllo al{' '}
            {attesaPassaggio.direzione === 'A→B' ? 'Rivale' : 'Giocatore'}
          </motion.button>
        </div>
      )}

      {/* Esito + monete (solo battaglie NPC/Capopalestra) */}
      {terminata && isNPC && esito && (() => {
        const allenatore = battaglia?.allenatoreId !== undefined
          ? getAllenatore(battaglia.allenatoreId)
          : null
        const tipoAvv: TipoAvversario =
          allenatore?.tipo === 'Capopalestra'
            ? 'Capopalestra'
            : allenatore?.tipo === 'PVP'
            ? 'PVP'
            : 'NPC'
        const delta = calcolaVariazioneMonete(esito, tipoAvv)
        if (delta === 0) return null
        return (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 arka-panel px-6 py-3 z-20">
            <p className="text-yellow-300 font-bold text-center">
              {delta > 0 ? `+${delta}₳ guadagnati` : `${delta}₳ persi`}
              {tipoAvv === 'Capopalestra' && delta > 0 && ' 👑'}
            </p>
          </div>
        )
      })()}

      {/* Pulsante exit */}
      {terminata && (
        <button
          className="arka-button absolute bottom-4 left-4 z-20"
          onClick={tornaIndietro}
        >
          {isPercorso
            ? 'Torna al percorso'
            : luogoRitorno !== 'mappa-principale'
            ? 'Torna in città'
            : 'Torna alla mappa'}
        </button>
      )}

      {/* Indicatore turno */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 arka-panel px-4 py-1">
        <span className="text-sm">
          {terminata
            ? 'Battaglia finita'
            : attesaAvversario
            ? 'Premi Avversario... per continuare'
            : isPvP && attesaPassaggio
            ? attesaPassaggio.direzione === 'A→B'
              ? 'Pronto per passare il controllo al Rivale'
              : 'Pronto per passare il controllo al Giocatore'
            : isPvP && mostraMoseB
            ? 'Turno del Rivale — scegli una mossa'
            : isPvP && turnoA
            ? 'Turno del Giocatore — scegli una mossa'
            : turnoA
            ? 'Il tuo turno'
            : 'Turno avversario...'}
        </span>
      </div>

      {scambioRichiesto && (
        <ScambioModal
          squadra={squadraA}
          attivoId={pkmnA.istanzaId}
          motivo={scambioRichiesto.motivo}
          onSelect={scegliPokemonCambio}
        />
      )}
    </div>
  )
}

// =============================================================
// SOTTOCOMPONENTI
// =============================================================

function InfoBox({
  messaggi,
  showOpponentButton,
  onOpponentTurn,
}: {
  messaggi: string[]
  showOpponentButton: boolean
  onOpponentTurn: () => void
}) {
  const righe = messaggi.slice(-4)

  return (
    <div
      className="absolute top-[38%] left-1/2 -translate-x-1/2 z-20 w-[min(44vw,560px)] min-h-[124px] rounded-lg border border-amber-200/35 bg-slate-950/78 px-6 py-5 text-white shadow-2xl backdrop-blur-sm"
    >
      <div className="space-y-1.5 pr-4 text-[15px] font-semibold leading-snug">
        {righe.map((msg, idx) => (
          <p key={`${idx}-${msg}`} className="truncate">
            {msg}
          </p>
        ))}
      </div>

      {showOpponentButton && (
        <button
          className="absolute bottom-4 right-5 rounded-md bg-amber-400 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-lg hover:bg-amber-300 active:scale-95"
          onClick={onOpponentTurn}
        >
          Avversario...
        </button>
      )}
    </div>
  )
}

function ScambioModal({
  squadra,
  attivoId,
  motivo,
  onSelect,
}: {
  squadra: PokemonIstanza[]
  attivoId: string
  motivo: string
  onSelect: (pokemon: PokemonIstanza) => void
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/62 px-6 backdrop-blur-sm">
      <div className="w-[min(760px,92vw)] rounded-lg border border-white/15 bg-slate-950/92 p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold">Scegli un Pokemon</h2>
            <p className="mt-1 text-sm font-semibold text-slate-300">{motivo}</p>
          </div>
          <span className="text-xs font-bold uppercase tracking-wide text-amber-300">
            Cambio squadra
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {squadra.slice(0, 6).map((pokemon) => {
            const specie = getPokemon(pokemon.specieId)
            const hpMax = calcolaHPMax(pokemon)
            const pct = Math.max(0, Math.min(100, (pokemon.hp / hpMax) * 100))
            const disabled = pokemon.hp <= 0 || pokemon.istanzaId === attivoId

            return (
              <button
                key={pokemon.istanzaId}
                disabled={disabled}
                onClick={() => onSelect(pokemon)}
                className="flex min-h-[116px] items-center gap-3 rounded-md border border-white/10 bg-slate-900/86 p-3 text-left shadow-lg transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <img
                  src={assetUrl(`/sprites/front_sprites/${pokemon.specieId}.png`)}
                  alt=""
                  className="h-20 w-20 shrink-0 object-contain"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-extrabold">
                      {pokemon.nome}
                    </span>
                    <span className="text-xs font-bold text-slate-300">
                      LV. {pokemon.livello}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/60">
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-xs font-bold text-slate-300">
                    <span>{pokemon.hp}/{hpMax}</span>
                    <span>{pokemon.hp <= 0 ? 'KO' : specie?.tipo}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SquadIndicator({
  squadra,
  position,
}: {
  squadra: PokemonIstanza[]
  position: 'top-left' | 'bottom-right'
}) {
  const posClass = position === 'top-left' ? 'top-16 left-4' : 'bottom-44 right-4'
  return (
    <div className={`absolute ${posClass} flex gap-1 z-10`}>
      {squadra.map((p) => (
        <div
          key={p.istanzaId}
          className={`w-3 h-3 rounded-full border border-white/60 ${
            p.hp > 0 ? 'bg-emerald-400' : 'bg-slate-600'
          }`}
          title={`${p.nome} lv${p.livello} (${p.hp} HP)`}
        />
      ))}
    </div>
  )
}

function PokemonBattleSlot({
  istanza,
  position,
  shaking,
  lunging,
}: {
  istanza: PokemonIstanza
  position: 'top-right' | 'bottom-left'
  shaking: boolean
  lunging: boolean
}) {
  const isPlayer = position === 'bottom-left'
  const posClass = isPlayer
    ? 'bottom-[13%] left-[6%]'
    : 'top-[14%] right-[7%]'
  const spriteSizeClass = isPlayer
    ? 'w-[clamp(250px,23vw,370px)] h-[clamp(250px,23vw,370px)]'
    : 'w-[clamp(210px,19vw,320px)] h-[clamp(210px,19vw,320px)]'
  // Vista posteriore per il giocatore (visto da dietro), frontale per l'avversario.
  const spriteFolder = isPlayer ? 'back_sprites' : 'front_sprites'
  const spriteSrc = assetUrl(`/sprites/${spriteFolder}/${istanza.specieId}.png`)
  const isKO = istanza.hp <= 0

  // shaking = sto subendo un colpo; lunging = sto attaccando (slancio verso il bersaglio).
  const innerAnim = shaking
    ? { x: [0, -8, 8, -8, 8, 0] }
    : lunging
    ? { x: isPlayer ? [0, 30, 0] : [0, -30, 0] }
    : {}

  return (
    <motion.div
      className={`absolute ${posClass} z-10`}
      initial={{ x: isPlayer ? -400 : 400, opacity: 0 }}
      animate={{
        x: 0,
        opacity: isKO ? 0.45 : 1,
        filter: isKO ? 'grayscale(100%)' : 'grayscale(0%)',
      }}
      exit={{ y: 180, opacity: 0, rotate: isPlayer ? -15 : 15, filter: 'grayscale(100%)' }}
      transition={{ type: 'spring', stiffness: 110, damping: 16 }}
    >
      <motion.div
        animate={innerAnim}
        transition={{ duration: 0.4 }}
        className={`${spriteSizeClass} flex items-center justify-center drop-shadow-2xl`}
      >
        <img
          src={spriteSrc}
          alt={istanza.nome}
          className="w-full h-full object-contain"
          onError={(e) => {
            // Fallback emoji se lo sprite non esiste
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            const sib = e.currentTarget.nextElementSibling as HTMLElement | null
            if (sib) sib.style.display = 'flex'
          }}
        />
        <span
          className="text-5xl items-center justify-center w-full h-full rounded-full bg-arka-surface border-4 border-white"
          style={{ display: 'none' }}
        >
          {isPlayer ? '🐺' : '🦈'}
        </span>
      </motion.div>

    </motion.div>
  )
}

function HpBar({
  nome,
  livello,
  hp,
  hpMax,
  stato,
  side,
  className = '',
}: {
  nome: string
  livello: number
  hp: number
  hpMax: number
  stato?: StatoAlterato
  side: 'player' | 'enemy'
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, (hp / hpMax) * 100))
  const colore = pct > 60 ? 'var(--hp-high)' : pct > 25 ? 'var(--hp-mid)' : 'var(--hp-low)'
  const badge = stato ? STATO_BADGE[stato] : null
  const accent = side === 'player' ? '#60a5fa' : '#ef4444'

  return (
    <div
      className={`absolute z-20 w-[min(28vw,390px)] rounded-lg border border-white/15 bg-slate-950/82 px-4 py-3 text-white shadow-2xl backdrop-blur-sm ${className}`}
      style={{ borderLeft: `5px solid ${accent}` }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[15px] font-extrabold leading-none">
          {nome}
          {badge && (
            <span
              className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.color} text-white`}
              title={stato}
            >
              {badge.emoji} {badge.label}
            </span>
          )}
        </span>
        <span className="shrink-0 text-[12px] font-extrabold text-slate-200">LV. {livello}</span>
      </div>
      <div className="mt-3 h-[9px] overflow-hidden rounded-full bg-black/60 ring-1 ring-white/15">
        <motion.div
          className="h-full"
          style={{ backgroundColor: colore }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-1 text-right text-[11px] font-bold text-slate-300">
        {hp}/{hpMax}
      </div>
    </div>
  )
}

function typeColor(tipo: string): string {
  const key = tipo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return `var(--tw-color-tipo-${key})`
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      whileHover={!disabled ? { y: -1, scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.96 } : {}}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md bg-amber-400 px-5 py-2.5 text-sm font-extrabold text-slate-950 shadow-lg transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </motion.button>
  )
}

function MoveButton({
  mossa,
  livello,
  disabled,
  onClick,
}: {
  mossa: MossaDef
  livello: number
  disabled: boolean
  onClick: () => void
}) {
  const dadi = mossa.dadiPerLivello[String(livello)] ?? 1
  const incremento = mossa.incrementoPerLivello[String(livello)] ?? 0
  const coloreTipo = typeColor(mossa.tipo)

  return (
    <motion.button
      whileHover={!disabled ? { y: -2, scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      disabled={disabled}
      onClick={onClick}
      className="relative min-h-[92px] overflow-hidden rounded-md border border-white/15 bg-slate-900/88 px-4 py-3 text-left text-white shadow-lg transition-colors hover:bg-slate-800/95 disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        borderLeft: `6px solid ${coloreTipo}`,
      }}
    >
      <div className="truncate pr-2 text-[15px] font-extrabold leading-tight">{mossa.nome}</div>
      <div className="mt-3 flex items-center justify-between gap-2 text-[12px] font-bold text-slate-100">
        <span className="rounded bg-black/35 px-2 py-1">
          D6 {dadi} +{incremento}
        </span>
        <span
          className="rounded px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-950"
          style={{ backgroundColor: coloreTipo }}
        >
          {mossa.tipo}
        </span>
      </div>
    </motion.button>
  )
}
