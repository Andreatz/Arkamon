import { useGameStore } from '@store/gameStore'
import { MAPPE } from '@data/index'
import { motion } from 'framer-motion'
import { assetUrl } from '@/utils/assetUrl'

/**
 * Mappa principale: 28 luoghi disposti sopra un'Italia stilizzata.
 * I percorsi (Percorso_N) portano alla scena Percorso, le città/isole
 * portano alla scena Citta (placeholder finché non implementata).
 *
 * Coordinate: x/y in percentuale (0-100). Sono qui inline per facilità
 * di tuning visivo: una volta consolidate, possono essere promosse in
 * mappe.json.
 */
type Tipo = 'citta' | 'percorso' | 'isola'

const COORDS: Record<string, { x: number; y: number; tipo: Tipo }> = {
  // Nord
  Torino:         { x: 22, y: 26, tipo: 'citta' },
  Percorso_6:     { x: 24, y: 28, tipo: 'percorso' },
  Percorso_5:     { x: 22, y: 32, tipo: 'percorso' },
  Percorso_4:     { x: 26, y: 30, tipo: 'percorso' },
  Percorso_3:     { x: 28, y: 24, tipo: 'percorso' },
  Milano:         { x: 32, y: 22, tipo: 'citta' },
  Percorso_2:     { x: 36, y: 24, tipo: 'percorso' },
  Piacenza:       { x: 40, y: 28, tipo: 'citta' },
  Percorso_1:     { x: 48, y: 26, tipo: 'percorso' },
  Venezia:        { x: 56, y: 24, tipo: 'citta' },

  // Centro
  Grosseto:       { x: 38, y: 44, tipo: 'citta' },
  Civitavecchia:  { x: 42, y: 52, tipo: 'citta' },
  Roma:           { x: 48, y: 56, tipo: 'citta' },
  Percorso_14:    { x: 54, y: 54, tipo: 'percorso' },
  Pescara:        { x: 60, y: 52, tipo: 'citta' },
  Percorso_13:    { x: 60, y: 56, tipo: 'percorso' },
  Molisnt:        { x: 62, y: 60, tipo: 'citta' },
  Napoli:         { x: 56, y: 64, tipo: 'citta' },
  Percorso_12:    { x: 62, y: 64, tipo: 'percorso' },
  Percorso_11:    { x: 66, y: 62, tipo: 'percorso' },
  Foggia:         { x: 72, y: 62, tipo: 'citta' },

  // Sud
  Percorso_10:    { x: 64, y: 72, tipo: 'percorso' },
  ReggioCalabria: { x: 58, y: 82, tipo: 'citta' },
  Percorso_9:     { x: 52, y: 88, tipo: 'percorso' },
  Palermo:        { x: 44, y: 90, tipo: 'isola' },

  // Sardegna
  Percorso_7:     { x: 32, y: 64, tipo: 'percorso' },
  Cagliari:       { x: 24, y: 78, tipo: 'isola' },
  Percorso_8:     { x: 32, y: 86, tipo: 'percorso' },
}

const COLORI_TIPO: Record<Tipo, string> = {
  citta: 'bg-pink-500',
  percorso: 'bg-emerald-400',
  isola: 'bg-amber-400',
}

export function MappaPrincipaleScene() {
  const vaiAScena = useGameStore((s) => s.vaiAScena)
  const giocatoreAttivo = useGameStore((s) => s.giocatoreAttivo)
  const cambiaGiocatoreAttivo = useGameStore((s) => s.cambiaGiocatoreAttivo)
  const giocatore = useGameStore((s) =>
    giocatoreAttivo === 1 ? s.giocatore1 : s.giocatore2
  )

  const click = (nome: string, tipo: Tipo) => {
    if (tipo === 'percorso') {
      vaiAScena('percorso', { luogo: nome })
    } else {
      vaiAScena('citta', { luogo: nome })
    }
  }

  return (
    <div
      className="relative w-full h-full bg-cover bg-center overflow-hidden"
      style={{ backgroundImage: `url(${assetUrl('/maps/Mappa-Finale.jpg')})` }}
    >
      <div className="absolute inset-0 bg-black/20" />

      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-30">
        <div className="flex gap-2">
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
          <div className="arka-panel px-4 py-2">
            <span className="text-arka-text-muted text-xs">Squadra:</span>
            <span className="text-white font-bold ml-2">
              {giocatore.squadra.length}/6
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={cambiaGiocatoreAttivo}
            className="arka-button-secondary text-sm py-2 px-4"
          >
            Passa al G{giocatoreAttivo === 1 ? 2 : 1}
          </button>
          <button
            onClick={() => vaiAScena('deposito')}
            className="arka-button-secondary text-sm py-2 px-4"
          >
            Deposito
          </button>
        </div>
      </div>

      {MAPPE.map((luogo) => {
        const coord = COORDS[luogo.nome]
        if (!coord) return null
        return (
          <motion.button
            key={luogo.nome}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
            style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
            whileHover={{ scale: 1.25 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => click(luogo.nome, coord.tipo)}
          >
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`w-5 h-5 rounded-full border-2 border-white shadow-lg ${COLORI_TIPO[coord.tipo]}`}
              />
              <span className="text-white text-[10px] font-bold drop-shadow-lg whitespace-nowrap leading-tight">
                {luogo.nome.replace('_', ' ')}
              </span>
            </div>
          </motion.button>
        )
      })}

      <div className="absolute bottom-4 left-4 arka-panel px-3 py-2 z-30 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-pink-500" /> Città
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-emerald-400" /> Percorso
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-400" /> Isola
        </div>
      </div>

      <p className="absolute bottom-4 right-4 text-arka-text-muted text-xs z-30">
        Mappa Arkamon · {MAPPE.length} luoghi
      </p>
    </div>
  )
}
