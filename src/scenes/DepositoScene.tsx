import { useGameStore } from '@store/gameStore'
import { getPokemon } from '@data/index'
import { calcolaHPMax } from '@engine/battleEngine'
import {
  BOX_COUNT,
  SLOT_PER_BOX,
  SQUADRA_MAX,
  chiaveDeposito,
  type SlotRef,
} from '@engine/deposito'
import { motion } from 'framer-motion'
import { useState } from 'react'
import type { PokemonIstanza } from '@/types'
import { DEPOSIT_BG } from '@data/backgrounds'
import { assetUrl } from '@/utils/assetUrl'

/**
 * Scena Deposito: gestione squadra ↔ deposito.
 *
 * Porting di Mod_Deposito.bas (ApriInterfacciaDeposito + GestisciClickSlot
 * + EseguiScambioDati + PopolaSlot).
 *
 * UI a due colonne:
 * - Sinistra: griglia 5×7 = 35 slot del box corrente, navigabile con ‹ ›
 * - Destra: 6 slot della squadra
 *
 * Interazione: click su slot per selezionarlo; click su un secondo slot
 * per swap/move. Click di nuovo sullo stesso slot per deselezionare.
 */
export function DepositoScene() {
  const vaiAScena = useGameStore((s) => s.vaiAScena)
  const giocatoreAttivo = useGameStore((s) => s.giocatoreAttivo)
  const giocatore = useGameStore((s) =>
    giocatoreAttivo === 1 ? s.giocatore1 : s.giocatore2
  )
  const scambiaSlot = useGameStore((s) => s.scambiaSlot)

  const [boxCorrente, setBoxCorrente] = useState(1)
  const [selezionato, setSelezionato] = useState<SlotRef | null>(null)

  const refsUguali = (a: SlotRef | null, b: SlotRef): boolean => {
    if (!a) return false
    if (a.tipo !== b.tipo) return false
    if (a.tipo === 'squadra' && b.tipo === 'squadra') return a.indice === b.indice
    if (a.tipo === 'deposito' && b.tipo === 'deposito') return a.chiave === b.chiave
    return false
  }

  const click = (ref: SlotRef, occupato: boolean) => {
    if (!selezionato) {
      // Si può selezionare solo se occupato
      if (occupato) setSelezionato(ref)
      return
    }
    if (refsUguali(selezionato, ref)) {
      setSelezionato(null)
      return
    }
    scambiaSlot(giocatoreAttivo, selezionato, ref)
    setSelezionato(null)
  }

  const isSelezionato = (ref: SlotRef) => refsUguali(selezionato, ref)

  return (
    <div
      className="w-full h-full flex flex-col bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 p-6 bg-cover bg-center"
      style={{ backgroundImage: `url(${DEPOSIT_BG})` }}
    >
      {/* HUD top */}
      <div className="flex justify-between items-center mb-4">
        <button
          className="arka-button-secondary text-sm py-2 px-4"
          onClick={() => vaiAScena('mappa-principale')}
        >
          ← Torna alla mappa
        </button>
        <h2 className="text-2xl font-bold text-arka-accent">Deposito</h2>
        <div className="arka-panel px-4 py-2">
          <span className="text-arka-text-muted text-xs">Giocatore:</span>
          <span className="text-arka-accent font-bold ml-2">{giocatoreAttivo}</span>
        </div>
      </div>

      <div className="flex-1 flex gap-6 max-w-7xl mx-auto w-full">
        {/* Box deposito */}
        <div className="flex-1 arka-panel p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              disabled={boxCorrente <= 1}
              onClick={() => setBoxCorrente((b) => Math.max(1, b - 1))}
              className="arka-button-secondary text-sm py-1 px-3 disabled:opacity-30"
            >
              ‹
            </button>
            <h3 className="text-lg font-bold">
              Box {boxCorrente} <span className="text-arka-text-muted text-sm">/ {BOX_COUNT}</span>
            </h3>
            <button
              disabled={boxCorrente >= BOX_COUNT}
              onClick={() => setBoxCorrente((b) => Math.min(BOX_COUNT, b + 1))}
              className="arka-button-secondary text-sm py-1 px-3 disabled:opacity-30"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: SLOT_PER_BOX }, (_, i) => {
              const slotN = i + 1
              const chiave = chiaveDeposito(boxCorrente, slotN)
              const istanza = giocatore.deposito[chiave]
              const ref: SlotRef = { tipo: 'deposito', chiave }
              return (
                <SlotCell
                  key={chiave}
                  istanza={istanza}
                  selezionato={isSelezionato(ref)}
                  onClick={() => click(ref, !!istanza)}
                />
              )
            })}
          </div>
        </div>

        {/* Squadra */}
        <div className="w-80 arka-panel p-4 flex flex-col">
          <h3 className="text-lg font-bold mb-3 text-center">
            Squadra <span className="text-arka-text-muted text-sm">{giocatore.squadra.length}/{SQUADRA_MAX}</span>
          </h3>
          <div className="flex flex-col gap-2 flex-1">
            {Array.from({ length: SQUADRA_MAX }, (_, i) => {
              const istanza = giocatore.squadra[i]
              const ref: SlotRef = { tipo: 'squadra', indice: i }
              return (
                <SlotCell
                  key={i}
                  istanza={istanza}
                  selezionato={isSelezionato(ref)}
                  onClick={() => click(ref, !!istanza)}
                  largo
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Info bar in basso */}
      <div className="mt-4 arka-panel px-4 py-2 text-sm text-center">
        {selezionato
          ? '✋ Slot selezionato — clicca un altro slot per scambiare/spostare, o di nuovo lo stesso per annullare'
          : '🖱️ Clicca uno slot occupato per selezionarlo'}
      </div>
    </div>
  )
}

function SlotCell({
  istanza,
  selezionato,
  onClick,
  largo = false,
}: {
  istanza?: PokemonIstanza
  selezionato: boolean
  onClick: () => void
  largo?: boolean
}) {
  const specie = istanza ? getPokemon(istanza.specieId) : null
  const hpMax = istanza ? calcolaHPMax(istanza) : 0

  const baseClass = largo
    ? 'h-14 px-3 flex items-center gap-2'
    : 'aspect-square flex flex-col items-center justify-center'

  const stateClass = selezionato
    ? 'border-yellow-300 bg-yellow-300/10 ring-2 ring-yellow-300/50'
    : istanza
    ? 'border-arka-border hover:border-arka-accent cursor-pointer'
    : 'border-dashed border-slate-700 hover:border-slate-500'

  return (
    <motion.button
      whileHover={{ scale: largo ? 1.02 : 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`border-2 rounded-md transition ${baseClass} ${stateClass}`}
    >
      {istanza && specie ? (
        largo ? (
          <>
            <SmallSprite specieId={specie.id} tipo={specie.tipo} className="w-10 h-10" />
            <div className="flex-1 text-left">
              <div className="font-bold text-sm leading-tight">{istanza.nome}</div>
              <div className="text-xs text-arka-text-muted">
                lv {istanza.livello} · {istanza.hp}/{hpMax} HP
              </div>
            </div>
          </>
        ) : (
          <>
            <SmallSprite specieId={specie.id} tipo={specie.tipo} className="w-10 h-10" />
            <span className="text-[9px] text-arka-text-muted leading-tight mt-0.5">
              lv{istanza.livello}
            </span>
          </>
        )
      ) : (
        <span className="text-arka-text-muted text-xs">·</span>
      )}
    </motion.button>
  )
}

function SmallSprite({
  specieId,
  tipo,
  className = '',
}: {
  specieId: number
  tipo: string
  className?: string
}) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <img
        src={assetUrl(`/sprites/front_sprites/${specieId}.png`)}
        alt=""
        className="w-full h-full object-contain"
        style={{ imageRendering: 'pixelated' }}
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          const sib = e.currentTarget.nextElementSibling as HTMLElement | null
          if (sib) sib.style.display = 'inline'
        }}
      />
      <span className="text-2xl leading-none" style={{ display: 'none' }}>
        {spriteFor(tipo)}
      </span>
    </span>
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
