import { useGameStore } from '@store/gameStore'
import { getPokemon } from '@data/index'
import { calcolaHPMax } from '@engine/battleEngine'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { EVOLUTION_BG } from '@data/backgrounds'

/**
 * Scena Evoluzione: animazione per ogni Pokémon che ha raggiunto la
 * soglia di evoluzione durante l'ultima battaglia.
 *
 * Porting di:
 * - Mod_Game_Events.AvviaScenaEvoluzione
 * - Mod_Game_Events.PreparaScenaEvoluzione
 * - Mod_Game_Events.ConcludiEvoluzione
 *
 * Payload atteso:
 *   {
 *     evoluzioni: { istanzaId: string, oldSpecieId: number, newSpecieId: number }[],
 *     luogoRitorno: string,
 *     giocatoreId: 1 | 2,
 *   }
 *
 * Processa una evoluzione alla volta. Ad ogni "Continua":
 * - applica la nuova specie all'istanza nello store (specieId + nome + HP ricalcolato)
 * - avanza all'evoluzione successiva
 * - quando tutte sono fatte, naviga al luogoRitorno
 */
type EvoluzioneSpec = {
  istanzaId: string
  oldSpecieId: number
  newSpecieId: number
}

export function EvoluzioneScene() {
  const scenaCorrente = useGameStore((s) => s.scenaCorrente)
  const aggiornaPokemon = useGameStore((s) => s.aggiornaPokemon)
  const vaiAScena = useGameStore((s) => s.vaiAScena)
  const giocatore1 = useGameStore((s) => s.giocatore1)
  const giocatore2 = useGameStore((s) => s.giocatore2)

  const evoluzioni = (scenaCorrente.payload?.evoluzioni as EvoluzioneSpec[]) ?? []
  const luogoRitorno = (scenaCorrente.payload?.luogoRitorno as string) ?? 'mappa-principale'
  const giocatoreId = (scenaCorrente.payload?.giocatoreId as 1 | 2) ?? 1

  const [indice, setIndice] = useState(0)
  const [fase, setFase] = useState<'pre' | 'morphing' | 'post'>('pre')

  const corrente = evoluzioni[indice]

  const tornaIndietro = () => {
    const isPercorso = /^Percorso_/.test(luogoRitorno)
    if (isPercorso) {
      vaiAScena('percorso', { luogo: luogoRitorno })
    } else if (luogoRitorno && luogoRitorno !== 'mappa-principale') {
      vaiAScena('citta', { luogo: luogoRitorno })
    } else {
      vaiAScena('mappa-principale')
    }
  }

  if (!corrente) {
    // Nessuna evoluzione (edge case: payload vuoto) → torna direttamente
    tornaIndietro()
    return null
  }

  const oldSpec = getPokemon(corrente.oldSpecieId)
  const newSpec = getPokemon(corrente.newSpecieId)
  const giocatore = giocatoreId === 1 ? giocatore1 : giocatore2
  const istanza = giocatore.squadra.find((p) => p.istanzaId === corrente.istanzaId)

  if (!oldSpec || !newSpec || !istanza) {
    // Dati mancanti → skippa silenziosamente
    setIndice((i) => i + 1)
    setFase('pre')
    return null
  }

  const avvia = () => {
    setFase('morphing')
    setTimeout(() => {
      // Applica l'evoluzione allo store
      const evoluto = {
        ...istanza,
        specieId: newSpec.id,
        nome: newSpec.nome,
      }
      evoluto.hp = calcolaHPMax(evoluto)
      aggiornaPokemon(giocatoreId, evoluto)
      setFase('post')
    }, 1800)
  }

  const continua = () => {
    if (indice + 1 < evoluzioni.length) {
      setIndice((i) => i + 1)
      setFase('pre')
    } else {
      tornaIndietro()
    }
  }

  return (
    <div
      className="w-full h-full relative bg-gradient-to-br from-violet-950 via-fuchsia-900 to-indigo-950 flex flex-col items-center justify-center overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${EVOLUTION_BG})` }}
    >
      {/* Sfondo a stelline animate */}
      <div className="absolute inset-0 opacity-30">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
            }}
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [0.5, 1.5, 0.5],
            }}
            transition={{
              duration: 2 + (i % 3),
              repeat: Infinity,
              delay: (i % 5) * 0.3,
            }}
          />
        ))}
      </div>

      {/* Contatore */}
      <div className="absolute top-4 right-4 arka-panel px-3 py-1 z-20">
        <span className="text-xs text-arka-text-muted">
          Evoluzione {indice + 1} di {evoluzioni.length}
        </span>
      </div>

      {/* Sprite centrale */}
      <div className="relative w-64 h-64 flex items-center justify-center mb-8">
        <AnimatePresence mode="wait">
          {fase === 'pre' && (
            <motion.div
              key="pre"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-48 h-48 rounded-full bg-arka-surface border-4 border-white shadow-2xl flex items-center justify-center overflow-hidden"
            >
              <SpriteOrEmoji specieId={oldSpec.id} fallback={spriteFor(oldSpec.tipo)} />
            </motion.div>
          )}
          {fase === 'morphing' && (
            <motion.div
              key="morphing"
              animate={{
                scale: [1, 1.2, 0.9, 1.3, 1],
                rotate: [0, 90, 180, 270, 360],
                filter: [
                  'brightness(1)',
                  'brightness(2)',
                  'brightness(3)',
                  'brightness(2)',
                  'brightness(1)',
                ],
              }}
              transition={{ duration: 1.8, ease: 'easeInOut' }}
              className="w-48 h-48 rounded-full bg-white shadow-2xl flex items-center justify-center"
            >
              <span className="text-8xl">✨</span>
            </motion.div>
          )}
          {fase === 'post' && (
            <motion.div
              key="post"
              initial={{ opacity: 0, scale: 1.5 }}
              animate={{
                opacity: 1,
                scale: 1,
                boxShadow: [
                  '0 0 0px rgba(250, 204, 21, 0)',
                  '0 0 60px rgba(250, 204, 21, 0.9)',
                  '0 0 30px rgba(250, 204, 21, 0.6)',
                ],
              }}
              transition={{ duration: 0.6, type: 'spring' }}
              className="w-48 h-48 rounded-full bg-arka-surface border-4 border-yellow-400 shadow-2xl flex items-center justify-center overflow-hidden"
            >
              <SpriteOrEmoji specieId={newSpec.id} fallback={spriteFor(newSpec.tipo)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Particelle che esplodono dal centro all'apparizione del nuovo sprite */}
        {fase === 'post' && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 14 }).map((_, i) => {
              const angle = (i / 14) * Math.PI * 2
              const dist = 180 + (i % 3) * 30
              return (
                <motion.div
                  key={i}
                  className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-yellow-300"
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: Math.cos(angle) * dist,
                    y: Math.sin(angle) * dist,
                    opacity: 0,
                    scale: 0.3,
                  }}
                  transition={{ duration: 1.1, ease: 'easeOut', delay: 0.1 }}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Testo + pulsante */}
      <div className="z-20 flex flex-col items-center gap-4 px-6">
        {fase === 'pre' && (
          <>
            <h2 className="text-3xl font-bold text-white drop-shadow-lg">
              {istanza.nome} sta per evolversi!
            </h2>
            <p className="text-arka-text-muted text-center max-w-md">
              {oldSpec.nome} (livello {istanza.livello}) ha raggiunto la soglia
              di evoluzione.
            </p>
            <button onClick={avvia} className="arka-button mt-4">
              ✨ Evolvi!
            </button>
          </>
        )}
        {fase === 'morphing' && (
          <h2 className="text-2xl font-bold text-white drop-shadow-lg animate-pulse">
            ???
          </h2>
        )}
        {fase === 'post' && (
          <>
            <h2 className="text-4xl font-black text-yellow-300 drop-shadow-lg">
              {oldSpec.nome} si è evoluto in {newSpec.nome}!
            </h2>
            <p className="text-arka-text-muted text-sm">
              Tipo: {newSpec.tipo} · HP base: {newSpec.hpBase}
            </p>
            <button onClick={continua} className="arka-button mt-4">
              {indice + 1 < evoluzioni.length ? 'Continua' : 'Fine'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function SpriteOrEmoji({
  specieId,
  fallback,
}: {
  specieId: number
  fallback: string
}) {
  return (
    <>
      <img
        src={`/sprites/front_sprites/${specieId}.png`}
        alt=""
        className="w-full h-full object-contain"
        style={{ imageRendering: 'pixelated' }}
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          const sib = e.currentTarget.nextElementSibling as HTMLElement | null
          if (sib) sib.style.display = 'inline'
        }}
      />
      <span className="text-8xl" style={{ display: 'none' }}>
        {fallback}
      </span>
    </>
  )
}

function spriteFor(tipo: string): string {
  switch (tipo) {
    case 'Fuoco':
      return '🔥'
    case 'Acqua':
      return '💧'
    case 'Erba':
      return '🌿'
    case 'Elettro':
      return '⚡'
    case 'Terra':
      return '⛰️'
    case 'Oscurità':
      return '🌑'
    case 'Psico':
      return '🔮'
    default:
      return '⭐'
  }
}
