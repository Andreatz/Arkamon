import { useGameStore } from '@store/gameStore'
import { getAllenatoriInLuogo, getPokemon } from '@data/index'
import { motion } from 'framer-motion'
import type { AllenatoreDef } from '@/types'

/**
 * Scena Città: lista degli allenatori sfidabili (NPC + Capopalestra)
 * + Centro Pokémon (cura completa della squadra) + ritorno alla mappa.
 *
 * Il Rivale (tipo PVP) NON appare qui — viene gestito altrove.
 *
 * Capopalestra hanno UI distinta (icona corona, ricompensa +1000) e
 * appaiono dopo gli NPC nella griglia.
 */
const RICOMPENSA: Record<AllenatoreDef['tipo'], number> = {
  NPC: 200,
  Capopalestra: 1000,
  PVP: 0,
}

export function CittaScene() {
  const scenaCorrente = useGameStore((s) => s.scenaCorrente)
  const giocatoreAttivo = useGameStore((s) => s.giocatoreAttivo)
  const giocatore = useGameStore((s) =>
    giocatoreAttivo === 1 ? s.giocatore1 : s.giocatore2
  )
  const vaiAScena = useGameStore((s) => s.vaiAScena)
  const iniziaBattagliaNPC = useGameStore((s) => s.iniziaBattagliaNPC)
  const curaSquadra = useGameStore((s) => s.curaSquadra)

  const luogo = (scenaCorrente.payload?.luogo as string) || 'Venezia'
  const tutti = getAllenatoriInLuogo(luogo).filter((a) => a.tipo !== 'PVP')
  // NPC prima, Capopalestra dopo (per progressione visiva)
  const allenatoriOrdinati = [...tutti].sort((a, b) => {
    if (a.tipo === b.tipo) return a.id - b.id
    return a.tipo === 'NPC' ? -1 : 1
  })

  const sfida = (allenatoreId: number) => {
    if (giocatore.allenatoriSconfitti.has(allenatoreId)) return
    const ok = iniziaBattagliaNPC(allenatoreId, luogo)
    if (ok) vaiAScena('battaglia')
  }

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-rose-900 via-rose-700 to-amber-700 p-6">
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

      <h2 className="text-4xl font-bold text-white text-center mb-1 drop-shadow-lg">
        {luogo}
      </h2>
      <p className="text-arka-text-muted text-center mb-6 italic">
        Sfida gli allenatori o cura la tua squadra al Centro Pokémon
      </p>

      <div className="flex-1 grid grid-cols-3 gap-4 max-w-4xl mx-auto w-full">
        {/* Centro Pokémon */}
        <motion.button
          whileHover={{ scale: 1.05, y: -4 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => curaSquadra(giocatoreAttivo)}
          className="arka-panel p-6 flex flex-col items-center justify-center cursor-pointer hover:border-arka-accent col-span-1"
        >
          <span className="text-6xl mb-2">🏥</span>
          <h3 className="text-xl font-bold">Centro Pokémon</h3>
          <p className="text-xs text-arka-text-muted text-center mt-1">
            Cura tutta la squadra
          </p>
        </motion.button>

        {/* Allenatori (NPC + Capopalestra) */}
        {allenatoriOrdinati.map((a) => {
          const sconfitto = giocatore.allenatoriSconfitti.has(a.id)
          const primoPkmn = getPokemon(a.squadra[0]?.pokemonId)
          const isCapo = a.tipo === 'Capopalestra'
          const ricompensa = RICOMPENSA[a.tipo]
          return (
            <motion.button
              key={a.id}
              whileHover={!sconfitto ? { scale: 1.05, y: -4 } : {}}
              whileTap={!sconfitto ? { scale: 0.95 } : {}}
              disabled={sconfitto}
              onClick={() => sfida(a.id)}
              className={`arka-panel p-6 flex flex-col items-center justify-center
                ${sconfitto ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-arka-accent'}
                ${isCapo && !sconfitto ? 'border-yellow-400 shadow-lg shadow-yellow-500/20' : ''}
              `}
            >
              <span className="text-6xl mb-2">
                {sconfitto ? '✅' : isCapo ? '👑' : '🥋'}
              </span>
              <h3 className={`text-xl font-bold ${isCapo && !sconfitto ? 'text-yellow-300' : ''}`}>
                {a.nome}
              </h3>
              {isCapo && !sconfitto && (
                <span className="text-[10px] uppercase tracking-wider text-yellow-300 mt-0.5">
                  Capopalestra
                </span>
              )}
              <p className="text-xs text-arka-text-muted text-center mt-1">
                {sconfitto
                  ? 'Già sconfitto'
                  : primoPkmn
                  ? `Squadra: ${a.squadra.length}× (lv ${a.squadra[0].livello})`
                  : 'Allenatore'}
              </p>
              {!sconfitto && (
                <span
                  className={`text-xs mt-2 ${isCapo ? 'text-yellow-300 font-bold' : 'text-yellow-400/80'}`}
                >
                  +{ricompensa}₳ se vinci
                </span>
              )}
            </motion.button>
          )
        })}

        {allenatoriOrdinati.length === 0 && (
          <div className="col-span-2 arka-panel p-6 flex items-center justify-center">
            <p className="text-arka-text-muted italic">
              Nessun allenatore in questa città
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
