import { useGameStore } from '@store/gameStore'
import { TitoloScene } from '@scenes/TitoloScene'
import { LaboratorioScene } from '@scenes/LaboratorioScene'
import { MappaPrincipaleScene } from '@scenes/MappaPrincipaleScene'
import { BattagliaScene } from '@scenes/BattagliaScene'
import { PercorsoScene } from '@scenes/PercorsoScene'
import { CittaScene } from '@scenes/CittaScene'
import { DepositoScene } from '@scenes/DepositoScene'
import { EvoluzioneScene } from '@scenes/EvoluzioneScene'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * Router delle scene.
 * Sostituisce il sistema VBA delle slide PowerPoint identificate da ID.
 * Aggiungi qui ogni nuova scena man mano che la implementi.
 */
function App() {
  const scenaCorrente = useGameStore((s) => s.scenaCorrente)

  return (
    <div className="arka-stage">
      <AnimatePresence mode="wait">
        <motion.div
          key={scenaCorrente.scena}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0"
        >
          {renderScena(scenaCorrente.scena)}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function renderScena(scena: string) {
  switch (scena) {
    case 'titolo':
      return <TitoloScene />
    case 'laboratorio':
      return <LaboratorioScene />
    case 'mappa-principale':
      return <MappaPrincipaleScene />
    case 'battaglia':
      return <BattagliaScene />
    case 'percorso':
      return <PercorsoScene />
    case 'citta':
      return <CittaScene />
    case 'deposito':
      return <DepositoScene />
    case 'evoluzione':
      return <EvoluzioneScene />
    default:
      return (
        <div className="flex items-center justify-center h-full text-arka-text-muted">
          Scena non implementata: <span className="text-white ml-2">{scena}</span>
        </div>
      )
  }
}

export default App
