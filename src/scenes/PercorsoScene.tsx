import { useGameStore } from '@store/gameStore'
import { getIncontri } from '@data/index'
import { generaIncontroDaCespuglio } from '@engine/encounters'
import { calcolaHPMax } from '@engine/battleEngine'
import { motion } from 'framer-motion'
import type { StatoBattaglia } from '@/types'
import { getBackground } from '@data/backgrounds'

const CESPUGLI = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

/**
 * Scena percorso: 7 cespugli A-G visitabili 1-time per giocatore.
 * Click su cespuglio non visitato → genera incontro selvatico pesato 60/30/10
 * → segna visitato → avvia battaglia.
 *
 * Porting di IniziaBattagliaSelvatica + ApriCespuglio del VBA.
 */
export function PercorsoScene() {
  const scenaCorrente = useGameStore((s) => s.scenaCorrente)
  const giocatoreAttivo = useGameStore((s) => s.giocatoreAttivo)
  const cespuglioVisitato = useGameStore((s) => s.cespuglioVisitato)
  const segnaCespuglioVisitato = useGameStore((s) => s.segnaCespuglioVisitato)
  const iniziaBattaglia = useGameStore((s) => s.iniziaBattaglia)
  const vaiAScena = useGameStore((s) => s.vaiAScena)
  const giocatore = useGameStore((s) =>
    giocatoreAttivo === 1 ? s.giocatore1 : s.giocatore2
  )

  const luogo = (scenaCorrente.payload?.luogo as string) || 'Percorso_1'

  const apriCespuglio = (cespuglio: string) => {
    if (cespuglioVisitato(giocatoreAttivo, luogo, cespuglio)) return
    const incontri = getIncontri(luogo, cespuglio)
    const selvatico = generaIncontroDaCespuglio(incontri)
    if (!selvatico) return

    const primoDellaSquadra = giocatore.squadra[0]
    if (!primoDellaSquadra) return

    segnaCespuglioVisitato(giocatoreAttivo, luogo, cespuglio)

    const battaglia: StatoBattaglia = {
      tipo: 'Selvatico',
      pokemonA: primoDellaSquadra,
      pokemonB: selvatico,
      hpMaxA: calcolaHPMax(primoDellaSquadra),
      hpMaxB: calcolaHPMax(selvatico),
      turnoCorrente: 'A',
      luogoRitorno: luogo,
      log: [`Appare ${selvatico.nome} selvatico!`],
      evoluzioneInAttesa: null,
    }
    iniziaBattaglia(battaglia)
    vaiAScena('battaglia')
  }

  const bg = getBackground(luogo)

  return (
    <div
      className="w-full h-full flex flex-col bg-gradient-to-b from-emerald-900 via-emerald-700 to-amber-700 p-6 bg-cover bg-center"
      style={bg ? { backgroundImage: `url(${bg})` } : undefined}
    >
      <div className="flex justify-between items-center mb-4">
        <button
          className="arka-button-secondary text-sm py-2 px-4"
          onClick={() => vaiAScena('mappa-principale')}
        >
          ← Torna alla mappa
        </button>
        <div className="flex gap-3">
          <div className="arka-panel px-4 py-2">
            <span className="text-arka-text-muted text-xs">Turno di:</span>
            <span className="text-arka-accent font-bold ml-2">
              Giocatore {giocatoreAttivo}
            </span>
          </div>
          <div className="arka-panel px-4 py-2">
            <span className="text-arka-text-muted text-xs">Monete:</span>
            <span className="text-yellow-300 font-bold ml-2">
              ₳ {giocatore.monete}
            </span>
          </div>
        </div>
      </div>

      <h2 className="text-3xl font-bold text-white text-center mb-2 drop-shadow-lg">
        {luogo.replace('_', ' ')}
      </h2>
      <p className="text-arka-text-muted text-center mb-8 italic">
        Esplora i cespugli — ogni cespuglio è esplorabile UNA sola volta
      </p>

      <div className="flex-1 grid grid-cols-7 gap-3 max-w-5xl mx-auto w-full">
        {CESPUGLI.map((c) => {
          const visited = cespuglioVisitato(giocatoreAttivo, luogo, c)
          const haIncontri = getIncontri(luogo, c).length > 0
          const disabled = visited || !haIncontri
          return (
            <motion.button
              key={c}
              whileHover={!disabled ? { scale: 1.05, y: -4 } : {}}
              whileTap={!disabled ? { scale: 0.95 } : {}}
              disabled={disabled}
              onClick={() => apriCespuglio(c)}
              className={`arka-panel aspect-square flex flex-col items-center justify-center
                ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:border-arka-accent'}
              `}
            >
              <span className="text-5xl mb-2">{visited ? '🌾' : '🌳'}</span>
              <span className="font-bold text-lg">{c}</span>
              <span className="text-xs text-arka-text-muted">
                {visited ? 'esplorato' : haIncontri ? 'cespuglio' : '—'}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
