import { useGameStore, creaIstanza } from '@store/gameStore'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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

const STATO_BADGE: Record<StatoAlterato, { label: string; color: string; emoji: string }> = {
  Confuso: { label: 'CONF', color: 'bg-fuchsia-500', emoji: '💫' },
  Addormentato: { label: 'ZZZ', color: 'bg-blue-500', emoji: '😴' },
  Avvelenato: { label: 'PSN', color: 'bg-purple-600', emoji: '☠️' },
}

/**
 * Scena di battaglia.
 *
 * Supporta:
 * - Battaglie selvatiche (1 vs 1) con cattura
 * - Battaglie NPC/PVP multi-pokemon (switch automatico su KO)
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
        setLog((l) => [...l, `${pkmnAEffettivo.nome} è caduto! Mandi in campo ${nextA.nome}!`])
        setPkmnA(nextA)
        return
      }
      setLog((l) => [...l, 'Hai perso la battaglia...'])
      setEsito('sconfitta')
      setTerminata(true)
      return
    }

    if (!statoRes.puoAgire) {
      // Turno saltato: passa all'avversario
      setTurnoA(false)
      setTimeout(() => turnoAvversario(pkmnB), 1200)
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
      setTurnoA(false)
      setTimeout(() => turnoAvversario(pkmnB), 1200)
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
          `${aDopoAutodanno.nome} è esausto! Mandi in campo ${nextA.nome}!`,
        ])
        setPkmnA(nextA)
        // Turno passa comunque all'avversario (la mossa è stata usata)
        setTurnoA(false)
        setTimeout(() => turnoAvversario(nuovoB), 1500)
        return
      }
      setLog((l) => [...l, 'Hai perso la battaglia...'])
      setEsito('sconfitta')
      setTerminata(true)
      return
    }

    // Turno avversario dopo 1.5s
    setTurnoA(false)
    setTimeout(() => turnoAvversario(nuovoB), 1500)
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
    setTimeout(() => turnoAvversario(pkmnB), 1500)
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
      setTurnoA(true)
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
      setTurnoA(true)
      return
    }

    const ris = calcolaDanno(bEffettivo, pkmnA, mossaIdx)
    if (!ris) {
      setTurnoA(true)
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
          `${nuovoA.nome} è KO! Mandi in campo ${nextA.nome}!`,
        ])
        setPkmnA(nextA)
        setTurnoA(true)
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

    setTurnoA(true)
  }

  return (
    <div className="w-full h-full relative bg-gradient-to-b from-emerald-900 via-emerald-700 to-emerald-500">
      {/* Indicatore squadra (solo NPC) */}
      {isNPC && (
        <>
          <SquadIndicator squadra={squadraB} position="top-left" />
          <SquadIndicator squadra={squadraA} position="bottom-right" />
        </>
      )}

      {/* Pokémon avversario (alto a destra) */}
      <PokemonBattleSlot
        istanza={pkmnB}
        hpMax={hpMaxB}
        position="top-right"
        shaking={shaking === 'B'}
      />

      {/* Pokémon giocatore (basso a sinistra) */}
      <PokemonBattleSlot
        istanza={pkmnA}
        hpMax={hpMaxA}
        position="bottom-left"
        shaking={shaking === 'A'}
      />

      {/* Box log eventi */}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 arka-panel px-6 py-3 max-w-md">
        <p className="text-white text-sm">{log[log.length - 1]}</p>
      </div>

      {/* Pulsanti mosse di A — nascosti in PvP quando aspetta B */}
      {!mostraMoseB && (
        <div className="absolute bottom-4 right-4 grid grid-cols-3 gap-2 z-20">
          {specieA.mosse.map((mossaId, i) => {
            const mossa = mossaId ? getMossa(mossaId) : null
            if (!mossa) return null
            return (
              <MoveButton
                key={i}
                mossa={mossa}
                livello={pkmnA.livello}
                disabled={!turnoA || terminata}
                onClick={() => eseguiMossa(i as 0 | 1 | 2)}
              />
            )
          })}
        </div>
      )}

      {/* PvP: pulsanti mosse di B (input umano) */}
      {isPvP && mostraMoseB && !terminata && (
        <div className="absolute top-32 left-4 grid grid-cols-3 gap-2 z-20">
          {specieB.mosse.map((mossaId, i) => {
            const mossa = mossaId ? getMossa(mossaId) : null
            if (!mossa) return null
            return (
              <MoveButton
                key={`B-${i}`}
                mossa={mossa}
                livello={pkmnB.livello}
                disabled={terminata}
                onClick={() => eseguiMossaPvP_B(i as 0 | 1 | 2)}
              />
            )
          })}
        </div>
      )}

      {/* Pulsanti cattura (solo battaglie selvatiche) */}
      {isSelvatico && !terminata && battaglia && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          <motion.button
            whileHover={turnoA ? { scale: 1.05 } : {}}
            whileTap={turnoA ? { scale: 0.95 } : {}}
            disabled={!turnoA}
            onClick={eseguiCattura}
            className="arka-button disabled:opacity-50"
          >
            🟡 Cattura
          </motion.button>
          {masterballRimaste > 0 && (
            <motion.button
              whileHover={turnoA ? { scale: 1.05 } : {}}
              whileTap={turnoA ? { scale: 0.95 } : {}}
              disabled={!turnoA}
              onClick={eseguiMasterball}
              className="arka-button disabled:opacity-50"
              title="Cattura garantita al 100%"
            >
              💎 Masterball ×{masterballRimaste}
            </motion.button>
          )}
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
            : isPvP && mostraMoseB
            ? 'Turno del Rivale — scegli una mossa'
            : isPvP && turnoA
            ? 'Turno del Giocatore — scegli una mossa'
            : turnoA
            ? 'Il tuo turno'
            : 'Turno avversario...'}
        </span>
      </div>
    </div>
  )
}

// =============================================================
// SOTTOCOMPONENTI
// =============================================================

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
  hpMax,
  position,
  shaking,
}: {
  istanza: PokemonIstanza
  hpMax: number
  position: 'top-right' | 'bottom-left'
  shaking: boolean
}) {
  const isPlayer = position === 'bottom-left'
  const posClass = isPlayer ? 'bottom-32 left-12 flex-row' : 'top-12 right-12 flex-row-reverse'

  return (
    <div className={`absolute ${posClass} flex items-center gap-4 z-10`}>
      <motion.div
        animate={shaking ? { x: [0, -8, 8, -8, 8, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-32 h-32 rounded-full bg-arka-surface border-4 border-white shadow-2xl flex items-center justify-center"
      >
        <span className="text-5xl">{isPlayer ? '🐺' : '🦈'}</span>
      </motion.div>

      <HpBar
        nome={istanza.nome}
        livello={istanza.livello}
        hp={istanza.hp}
        hpMax={hpMax}
        stato={istanza.stato?.tipo}
      />
    </div>
  )
}

function HpBar({
  nome,
  livello,
  hp,
  hpMax,
  stato,
}: {
  nome: string
  livello: number
  hp: number
  hpMax: number
  stato?: StatoAlterato
}) {
  const pct = (hp / hpMax) * 100
  const colore = pct > 60 ? 'var(--hp-high)' : pct > 25 ? 'var(--hp-mid)' : 'var(--hp-low)'
  const badge = stato ? STATO_BADGE[stato] : null

  return (
    <div className="arka-panel min-w-[200px] px-3 py-2">
      <div className="flex justify-between items-baseline mb-1">
        <span className="font-bold text-sm flex items-center gap-1.5">
          {nome}
          {badge && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.color} text-white uppercase tracking-wider`}
              title={stato}
            >
              {badge.emoji} {badge.label}
            </span>
          )}
        </span>
        <span className="text-xs text-arka-text-muted">LV. {livello}</span>
      </div>
      <div className="h-3 bg-slate-900 rounded-full overflow-hidden">
        <motion.div
          className="h-full"
          style={{ backgroundColor: colore }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <div className="text-xs text-right mt-1 text-arka-text-muted">
        {hp}/{hpMax}
      </div>
    </div>
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
  const coloreTipo = `var(--tw-color-tipo-${mossa.tipo.toLowerCase()})`

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      disabled={disabled}
      onClick={onClick}
      className="arka-panel px-3 py-2 text-left disabled:opacity-50"
      style={{ borderTop: `3px solid ${coloreTipo}` }}
    >
      <div className="font-bold text-sm">{mossa.nome}</div>
      <div className="text-xs text-arka-text-muted flex items-center gap-2 mt-1">
        <span>
          🎲 {dadi}d6 +{incremento}
        </span>
        <span className="text-xs">{mossa.tipo}</span>
      </div>
    </motion.button>
  )
}
