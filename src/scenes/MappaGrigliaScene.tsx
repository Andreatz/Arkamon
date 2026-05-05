/**
 * Scena overworld a griglia (Fasi E.3 → E.5).
 *
 * Registry di mappe dummy hardcoded: la scena legge la mappa corrente da
 * `posizione[N].mappaId` (giocatore attivo). Le caselle `uscita` con
 * `versoMappaId` corrispondente a un'altra mappa del registry triggerano una
 * transizione interna alla scena (con fade); le uscite verso
 * `mappa-principale` vanno alla vecchia scena 2D.
 *
 * Controlli:
 *   - click su casella adiacente calpestabile → muove
 *   - click su casella interagibile adiacente → interagisce
 *   - WASD / frecce → muovono nella direzione corrispondente
 *   - barra spaziatrice → tenta interazione sulla casella di fronte
 *   - tasto "Passa il turno" forza lo swap
 */
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '@store/gameStore'
import {
  caselleAdiacenti,
  puòInteragire,
  puòMuoversi,
} from '@engine/movimento'
import type { RisultatoInterazione } from '@engine/movimento'
import { calcolaHPMax } from '@engine/battleEngine'
import { generaIncontroDaCespuglio } from '@engine/encounters'
import { getIncontri } from '@data/index'
import { MAPPE_GRIGLIA, PERCORSO_1 } from '@data/mappe-griglia'
import { assetUrl } from '@/utils/assetUrl'
import type {
  Casella,
  MappaGriglia,
  PosizioneAvatar,
  StatoBattaglia,
} from '@/types'

// ----------------------------------------------------------------
// DUMMY MAP 10x10
// ----------------------------------------------------------------

/** Registry delle mappe-griglia disponibili (Fase E.6 → src/data/mappe-griglia). */
const REGISTRY: Record<string, MappaGriglia> = MAPPE_GRIGLIA

/** Mappa di partenza se l'avatar è su una mappa non registrata. */
const MAPPA_DI_DEFAULT = PERCORSO_1

// Etichette breve per overlay nelle celle
function etichettaCasella(c: Casella): string {
  switch (c.tipo) {
    case 'cespuglio':
      return '🌿'
    case 'allenatore':
      return '🧑‍🎤'
    case 'edificio':
      return c.edificioId === 'centro'
        ? '⛑️'
        : c.edificioId === 'deposito'
        ? '📦'
        : c.edificioId === 'palestra'
        ? '🏟️'
        : '🔬'
    case 'uscita':
      return '🚪'
    case 'ostacolo':
      return ''
    default:
      return ''
  }
}

function coloreCasella(c: Casella): string {
  switch (c.tipo) {
    case 'ostacolo':
      return 'bg-slate-900'
    case 'cespuglio':
      return 'bg-emerald-700/40'
    case 'allenatore':
      return 'bg-rose-700/40'
    case 'edificio':
      return 'bg-amber-700/40'
    case 'uscita':
      return 'bg-indigo-700/40'
    default:
      return 'bg-emerald-900/30'
  }
}

// ----------------------------------------------------------------
// SCENA
// ----------------------------------------------------------------

export function MappaGrigliaScene() {
  const vaiAScena = useGameStore((s) => s.vaiAScena)
  const posizione1 = useGameStore((s) => s.posizione1)
  const posizione2 = useGameStore((s) => s.posizione2)
  const turno = useGameStore((s) => s.turnoOverworld)
  const giocatore1 = useGameStore((s) => s.giocatore1)
  const giocatore2 = useGameStore((s) => s.giocatore2)
  const muoviAvatar = useGameStore((s) => s.muoviAvatar)
  const interagisciCasella = useGameStore((s) => s.interagisciCasella)
  const passaTurnoOverworld = useGameStore((s) => s.passaTurnoOverworld)
  const iniziaBattaglia = useGameStore((s) => s.iniziaBattaglia)
  const iniziaBattagliaNPC = useGameStore((s) => s.iniziaBattagliaNPC)
  const curaSquadra = useGameStore((s) => s.curaSquadra)

  const [log, setLog] = useState<string[]>([
    "Benvenuto nell'overworld a griglia.",
    'Movimento: WASD/frecce o click. Spazio per interagire.',
  ])

  // La mappa visualizzata segue il giocatore attivo. In assenza di una mappa
  // valida nel registry (es. avatar ancora su `mappa-principale`), usa il
  // default e allinea le posizioni nel useEffect sotto.
  const posAttivo = turno.giocatoreAttivo === 1 ? posizione1 : posizione2
  const mappa = REGISTRY[posAttivo.mappaId] ?? MAPPA_DI_DEFAULT
  const giocatoreAttivo =
    turno.giocatoreAttivo === 1 ? giocatore1 : giocatore2

  // Allinea le posizioni degli avatar al registry al primo mount: se uno dei
  // due avatar è su una mappa non disponibile (es. `mappa-principale`),
  // viene riportato sullo spawn della mappa di default.
  useEffect(() => {
    if (!REGISTRY[posizione1.mappaId]) {
      useGameStore.setState({
        posizione1: {
          mappaId: MAPPA_DI_DEFAULT.id,
          ...MAPPA_DI_DEFAULT.spawnDefault,
          direzione: 'S',
        },
      })
    }
    if (!REGISTRY[posizione2.mappaId]) {
      useGameStore.setState({
        posizione2: {
          mappaId: MAPPA_DI_DEFAULT.id,
          x: MAPPA_DI_DEFAULT.larghezza - 1,
          y: MAPPA_DI_DEFAULT.altezza - 1,
          direzione: 'N',
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Caselle adiacenti che il giocatore attivo può raggiungere/interagire
  const adiacenti = useMemo(
    () => caselleAdiacenti(posAttivo, mappa),
    [posAttivo, mappa]
  )
  const movibili = useMemo(
    () =>
      adiacenti.filter((a) =>
        puòMuoversi(posAttivo, a, mappa)
      ),
    [adiacenti, posAttivo, mappa]
  )
  const interagibili = useMemo(
    () =>
      adiacenti.filter((a) => {
        const c = mappa.caselle[a.y]?.[a.x]
        if (!c) return false
        return puòInteragire(mappa.id, a.x, a.y, c, {
          caselleConsumate: giocatoreAttivo.caselleConsumate,
          allenatoriSconfitti: giocatoreAttivo.allenatoriSconfitti,
        })
      }),
    [adiacenti, mappa, giocatoreAttivo.caselleConsumate, giocatoreAttivo.allenatoriSconfitti]
  )

  const isMovibile = (x: number, y: number) =>
    movibili.some((m) => m.x === x && m.y === y)
  const isInteragibile = (x: number, y: number) =>
    interagibili.some((m) => m.x === x && m.y === y)

  const aggiungiLog = (msg: string) =>
    setLog((l) => [...l.slice(-4), msg])

  const direzioneVerso = (
    dx: number,
    dy: number
  ): PosizioneAvatar['direzione'] => {
    if (dy < 0) return 'N'
    if (dy > 0) return 'S'
    if (dx > 0) return 'E'
    return 'O'
  }

  const tentaMovimento = (dx: number, dy: number) => {
    const nuova: PosizioneAvatar = {
      mappaId: mappa.id,
      x: posAttivo.x + dx,
      y: posAttivo.y + dy,
      direzione: direzioneVerso(dx, dy),
    }
    const ok = muoviAvatar(turno.giocatoreAttivo, nuova, mappa)
    if (!ok) aggiungiLog('Non puoi muoverti lì.')
  }

  const cellaClick = (x: number, y: number) => {
    if (isMovibile(x, y)) {
      tentaMovimento(x - posAttivo.x, y - posAttivo.y)
      return
    }
    if (isInteragibile(x, y)) {
      eseguiInterazione(x, y)
    }
  }

  /**
   * Sequenza interazione (E.4):
   *   1. Pre-check: se è una battaglia, il giocatore attivo deve avere
   *      almeno un Pokémon vivo (altrimenti niente, log d'errore).
   *   2. Allinea `giocatoreAttivo` al `turnoOverworld.giocatoreAttivo`
   *      (lo store delle battaglie ne ha bisogno per attribuire la squadra).
   *   3. Chiama `interagisciCasella` (consuma casella, chiude turno overworld).
   *   4. In base al risultato, scatena la scena vera o l'effetto.
   */
  const eseguiInterazione = (x: number, y: number) => {
    const giocatoreId = turno.giocatoreAttivo
    const casella = mappa.caselle[y]?.[x]
    if (!casella) return

    // Pre-check: niente battaglia senza un Pokémon vivo
    if (
      (casella.tipo === 'cespuglio' || casella.tipo === 'allenatore') &&
      !giocatoreAttivo.squadra.some((p) => p.hp > 0)
    ) {
      aggiungiLog(
        `Giocatore ${giocatoreId} non ha Pokémon vivi: impossibile combattere.`
      )
      return
    }

    // Allinea il giocatoreAttivo "di battaglia" al turno overworld
    useGameStore.setState({ giocatoreAttivo: giocatoreId })

    const r = interagisciCasella(giocatoreId, mappa, x, y)
    handleRisultato(r)
  }

  const handleRisultato = (r: RisultatoInterazione) => {
    switch (r.tipo) {
      case 'battaglia-selvatica': {
        const incontri = getIncontri(mappa.id, r.cespuglioId)
        const selvatico = generaIncontroDaCespuglio(incontri)
        const giocId = useGameStore.getState().giocatoreAttivo
        const g =
          giocId === 1
            ? useGameStore.getState().giocatore1
            : useGameStore.getState().giocatore2
        const primo = g.squadra.find((p) => p.hp > 0)
        if (!selvatico || !primo) {
          aggiungiLog('Nessun Pokémon nel cespuglio.')
          return
        }
        const battaglia: StatoBattaglia = {
          tipo: 'Selvatico',
          pokemonA: primo,
          pokemonB: selvatico,
          hpMaxA: calcolaHPMax(primo),
          hpMaxB: calcolaHPMax(selvatico),
          turnoCorrente: 'A',
          luogoRitorno: 'mappa-griglia',
          log: [`Appare ${selvatico.nome} selvatico!`],
          evoluzioneInAttesa: null,
        }
        iniziaBattaglia(battaglia)
        vaiAScena('battaglia')
        break
      }
      case 'battaglia-npc': {
        const ok = iniziaBattagliaNPC(r.allenatoreId, 'mappa-griglia')
        if (!ok) {
          aggiungiLog(`Impossibile sfidare l'allenatore #${r.allenatoreId}.`)
          return
        }
        vaiAScena('battaglia')
        break
      }
      case 'edificio': {
        const giocId = useGameStore.getState().giocatoreAttivo
        if (r.edificioId === 'centro') {
          curaSquadra(giocId)
          aggiungiLog(
            `Centro Pokémon: la squadra di Giocatore ${giocId} è stata curata.`
          )
        } else if (r.edificioId === 'deposito') {
          vaiAScena('deposito')
        } else {
          aggiungiLog(`Edificio ${r.edificioId}: non ancora implementato.`)
        }
        break
      }
      case 'transizione-mappa':
        if (r.versoMappaId === 'mappa-principale') {
          aggiungiLog('Uscita verso la mappa principale.')
          vaiAScena('mappa-principale')
        } else if (REGISTRY[r.versoMappaId]) {
          // Transizione interna alla scena: lo store ha già spostato l'avatar
          // sullo spawn della mappa di destinazione. La scena reagisce al
          // cambio di `mappa.id` con un fade automatico.
          aggiungiLog(`Sei entrato in: ${r.versoMappaId}.`)
        } else {
          aggiungiLog(`Mappa "${r.versoMappaId}" non disponibile.`)
        }
        break
      case 'dialogo':
        aggiungiLog(`Dialogo: ${r.dialogoId}.`)
        break
      default:
        aggiungiLog('Niente da fare qui.')
    }
  }

  const tentaInterazioneFronte = () => {
    const dx =
      posAttivo.direzione === 'E' ? 1 : posAttivo.direzione === 'O' ? -1 : 0
    const dy =
      posAttivo.direzione === 'S' ? 1 : posAttivo.direzione === 'N' ? -1 : 0
    const tx = posAttivo.x + dx
    const ty = posAttivo.y + dy
    if (!isInteragibile(tx, ty)) {
      aggiungiLog("Niente da interagire di fronte a te.")
      return
    }
    eseguiInterazione(tx, ty)
  }

  // Tastiera
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'w' || k === 'arrowup') {
        e.preventDefault()
        tentaMovimento(0, -1)
      } else if (k === 's' || k === 'arrowdown') {
        e.preventDefault()
        tentaMovimento(0, 1)
      } else if (k === 'a' || k === 'arrowleft') {
        e.preventDefault()
        tentaMovimento(-1, 0)
      } else if (k === 'd' || k === 'arrowright') {
        e.preventDefault()
        tentaMovimento(1, 0)
      } else if (k === ' ' || k === 'spacebar') {
        e.preventDefault()
        tentaInterazioneFronte()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posAttivo, turno, mappa])

  // Layout: griglia 10x10 con celle 40x40 → 400x400
  const CELLA = 40

  return (
    <div
      className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col bg-cover bg-center"
      style={
        mappa.background
          ? { backgroundImage: `url(${assetUrl(mappa.background)})` }
          : undefined
      }
    >
      {mappa.background && <div className="absolute inset-0 bg-black/55 z-0" />}
      {/* HUD */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-30">
        <div className="flex gap-2">
          <div className="arka-panel px-4 py-2">
            <span className="text-arka-text-muted text-xs">Turno di:</span>
            <span
              className={`font-bold ml-2 ${
                turno.giocatoreAttivo === 1 ? 'text-rose-300' : 'text-sky-300'
              }`}
            >
              Giocatore {turno.giocatoreAttivo}
            </span>
          </div>
          <div className="arka-panel px-4 py-2">
            <span className="text-arka-text-muted text-xs">Azioni:</span>
            <span className="text-arka-accent font-bold ml-2">
              {turno.azioniRimaste} / 2
            </span>
          </div>
          <div className="arka-panel px-4 py-2">
            <span className="text-arka-text-muted text-xs">Mappa:</span>
            <span className="text-white font-bold ml-2">{mappa.id}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => passaTurnoOverworld()}
            className="arka-button-secondary text-xs py-1 px-3"
          >
            Passa turno
          </button>
          <button
            onClick={() => vaiAScena('mappa-principale')}
            className="arka-button-secondary text-xs py-1 px-3"
          >
            ← Mappa principale
          </button>
        </div>
      </div>

      {/* Griglia centrata, con fade su cambio mappa (E.5) */}
      <div className="flex-1 flex items-center justify-center pt-16 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={mappa.id}
            className="relative"
            style={{
              width: mappa.larghezza * CELLA,
              height: mappa.altezza * CELLA,
            }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
          >
            {/* Caselle */}
            {mappa.caselle.map((riga, y) =>
              riga.map((c, x) => {
                const movibile = isMovibile(x, y)
                const interagibile = isInteragibile(x, y)
                const cliccabile = movibile || interagibile
                return (
                  <button
                    key={`${x}-${y}`}
                    onClick={() => cellaClick(x, y)}
                    disabled={!cliccabile}
                    className={[
                      'absolute border border-slate-700/60 flex items-center justify-center text-base',
                      coloreCasella(c),
                      cliccabile ? 'cursor-pointer' : 'cursor-default',
                      movibile ? 'ring-2 ring-sky-400 ring-inset' : '',
                      interagibile ? 'ring-2 ring-amber-300 ring-inset' : '',
                    ].join(' ')}
                    style={{
                      left: x * CELLA,
                      top: y * CELLA,
                      width: CELLA,
                      height: CELLA,
                    }}
                  >
                    <span className="opacity-80">{etichettaCasella(c)}</span>
                  </button>
                )
              })
            )}

            {/* Avatar G2 (sotto, così G1 è sopra in caso di sovrapposizione) */}
            {posizione2.mappaId === mappa.id && (
              <motion.div
                className="absolute pointer-events-none flex items-center justify-center text-2xl"
                style={{ width: CELLA, height: CELLA }}
                animate={{ x: posizione2.x * CELLA, y: posizione2.y * CELLA }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              >
                <div className="w-7 h-7 rounded-full bg-sky-500 border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold text-white">
                  2
                </div>
              </motion.div>
            )}

            {/* Avatar G1 */}
            {posizione1.mappaId === mappa.id && (
              <motion.div
                className="absolute pointer-events-none flex items-center justify-center text-2xl"
                style={{ width: CELLA, height: CELLA }}
                animate={{ x: posizione1.x * CELLA, y: posizione1.y * CELLA }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              >
                <div className="w-7 h-7 rounded-full bg-rose-500 border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold text-white">
                  1
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Log + leggenda */}
      <div className="absolute bottom-3 left-3 right-3 flex gap-3 z-30 items-end">
        <div className="arka-panel px-3 py-2 flex-1 max-h-32 overflow-hidden">
          <div className="text-arka-text-muted text-[10px] uppercase mb-1">
            Log
          </div>
          <div className="text-xs space-y-0.5">
            {log.slice(-4).map((m, i) => (
              <div key={i} className="text-white/90">
                {m}
              </div>
            ))}
          </div>
        </div>
        <div className="arka-panel px-3 py-2 text-[10px] flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm ring-2 ring-sky-400" />
            Movibile
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm ring-2 ring-amber-300" />
            Interagibile
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-emerald-700/60" />
            🌿 Cespuglio
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-rose-700/60" />
            🧑‍🎤 Allenatore
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-amber-700/60" />
            ⛑️/📦 Edificio
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-indigo-700/60" />
            🚪 Uscita
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-slate-900" />
            Ostacolo
          </div>
        </div>
      </div>
    </div>
  )
}
