import { useGameStore } from '@store/gameStore'
import { motion } from 'framer-motion'
import { assetUrl } from '@/utils/assetUrl'

/**
 * Schermata titolo.
 * Tutto è in HTML + Tailwind: per modificare l'aspetto cambia le classi
 * o le variabili CSS in src/index.css.
 */
export function TitoloScene() {
  const vaiAScena = useGameStore((s) => s.vaiAScena)
  const reset = useGameStore((s) => s.reset)
  const haGiocatori = useGameStore((s) => s.giocatore1.squadra.length > 0)

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-arka-bg via-slate-900 to-purple-950">
      <motion.img
        src={assetUrl('/ui/logo_arkamon.png')}
        alt="Arkamon"
        className="w-96 max-w-[80%] mb-4 drop-shadow-2xl"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring' }}
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
      <h1 className="sr-only">ARKAMON</h1>
      <motion.p
        className="text-arka-text-muted mb-12 text-lg italic"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        Diventa il più grande Allenatore del mondo
      </motion.p>

      <motion.div
        className="flex flex-col gap-3 w-72"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <button
          className="arka-button text-xl"
          onClick={() => {
            reset()
            vaiAScena('laboratorio')
          }}
        >
          Nuova Partita
        </button>
        {haGiocatori && (
          <button
            className="arka-button-secondary text-lg"
            onClick={() => vaiAScena('mappa-principale')}
          >
            Continua
          </button>
        )}
      </motion.div>

      <p className="absolute bottom-4 text-arka-text-muted text-xs">
        v0.1.0 · powered by React + TypeScript + Tailwind
      </p>
    </div>
  )
}
