# Roadmap & stato attuale — Arkamon

> Documento di pianificazione consolidato. Aggiornato: 29 aprile 2026.
> Per il contesto di codebase e regole vedi [CLAUDE.md](./CLAUDE.md).

## Stato sintetico

| Indicatore | Valore |
| --- | --- |
| Branch principale | `main` (tutte le PR Fase A + stati alterati mergiate) |
| Ultimo commit | `7673233` fix(battaglia): import StatoAlterato/STATO_BADGE |
| Test (`npm test`) | **63/63 verdi** |
| Type check (`tsc --noEmit`) | clean |
| Build (`npm run build`) | clean (566 KB / 115 KB gzip; warning chunk > 500 KB non bloccante) |
| Loop end-to-end giocabile | ✅ titolo → laboratorio → mappa (28 luoghi) → percorso/città → battaglia (NPC/Capo/selvatica multi-pokemon con cattura/XP/evoluzione) → ritorno · deposito accessibile dalla mappa |

## Stack & vincoli

- React 18 + TypeScript + Vite 5 + Tailwind 3 + Zustand + framer-motion
- Vitest 2 (Vite 5 non è compatibile con Vitest ≥3 — pin a `^2`)
- Vite **bloccato a 5.x** (vedi CLAUDE.md "non aggiornare oltre")

---

## ✅ Fase A — Parità con VBA: COMPLETA

Tutte le voci della roadmap originale "Fase A" sono portate in TS, testate e giocabili end-to-end.

### Engine puro (`src/engine/*`)

- ✅ **`battleEngine.ts`** (calcoli core)
  - HP max allineato al VBA: `liv ≤ 5 ? hpBase : hpBase + trunc((liv-5)*crescita)`
  - `rollD6(n, rng?)` con RNG iniettabile, `roundHalfUp` (porting di `RoundIntHalfUp`)
  - `calcolaDanno` con STAB×1.5 + efficacia tipo (matrice 0.5/1/**1.5** dal Database.xlsx, non ×2)
  - `tentaCattura` 3d6 vs `tasso × (2 - hp/hpMax)` (porting di `EseguiAzioneCattura`)
  - `scegliMossaIA` con STAB virtuale + tie-break 50/50 (porting di `ScegliMossaIA`)
  - `determinaIniziativa(lvA, lvB, rng?)` con tie-break a livelli pari
  - `applicaXP` regola di gioco custom: 1 KO = 1 livello, cap 100, evoluzione triggerata al livello soglia
  - `calcolaVariazioneMonete(esito, tipoAvversario)`: +200 NPC, +1000 Capopalestra, −200 sconfitta
  - **Stati alterati** (Fase B anticipata): `applicaStato`, `risolviStatoInizioTurno` per Confuso/Addormentato/Avvelenato
- ✅ **`encounters.ts`** — `pesoCategoria` (60/30/10), `scegliIncontroPesato`, `generaIncontroDaCespuglio`
- ✅ **`deposito.ts`** — `SlotRef` discriminato, `scambia()` pure: 4 casi (squadra↔deposito, deposito↔deposito, squadra↔squadra, move su vuoto)

### Stato globale (`src/store/gameStore.ts`)

- ✅ Persistenza `localStorage` con serializzazione `Set` custom
- ✅ `StatoGiocatore.monete` + `aggiornaMonete`
- ✅ `rivaleStarterId` globale + `assegnaRivaleStarter` (porting di `AssegnaRivaleEVaiAllaMappa`)
- ✅ `iniziaBattagliaNPC` popola `squadraA` + `squadraB` complete; usa `rivaleStarterId` per il primo slot del Rivale (tipo PVP)
- ✅ `risolviBattagliaNPC` deriva `tipoAvv` da `allenatore.tipo` (Capopalestra → +1000, NPC → +200)
- ✅ `curaSquadra(giocatoreId)` per Centro Pokémon
- ✅ `terminaBattaglia(true)` cura HP **e** pulisce stati alterati
- ✅ `aggiornaPokemon` per persistere modifiche di livello/xp/evoluzione
- ✅ `scambiaSlot(giocatoreId, source, target)` thin-wrapper su `scambia()` (porting di `EseguiScambioDati`)

### Scene (`src/scenes/`)

- ✅ `TitoloScene` — Nuova partita / Continua
- ✅ `LaboratorioScene` — scelta starter ID 1/5/9 a turni; lo starter scartato → Rivale
- ✅ `MappaPrincipaleScene` — **28 luoghi reali** disposti a forma d'Italia (coord. inline tunabili)
- ✅ `PercorsoScene` — 7 cespugli A-G visitabili una sola volta per giocatore
- ✅ `CittaScene` — lista NPC + Capopalestra (icona 👑, bordo dorato) + Centro Pokémon
- ✅ `BattagliaScene` — multi-pokemon, cattura, XP, indicatore squadra a pallini, badge stati alterati
- ✅ `EvoluzioneScene` — animazione 3-fasi (pre → morphing → post), un Pokémon alla volta, contatore N/M
- ✅ `DepositoScene` — griglia 5×7 box corrente + squadra 6 slot, click-to-select + click-to-swap, nav box 1-30

### Battaglia (in dettaglio)

- ✅ Selvatica con cattura (pulsante "🟡 Cattura" solo se `tipo === 'Selvatico'`)
- ✅ NPC (+200₳ vittoria / −200₳ sconfitta) + flag persistente `allenatoriSconfitti`
- ✅ **Capopalestra** (+1000₳) con UI dedicata + 8 capi popolati nel JSON (Venezia → Roma)
- ✅ **Multi-pokemon**: switch automatico su KO finché un lato ha pokemon vivi
- ✅ **XP**: 1 KO = 1 livello, cap 100, evoluzione queue → `EvoluzioneScene` post-battaglia
- ✅ **Stati alterati end-to-end**: avvelenamento (10% hpMax/turno), sonno (3t, 50% sveglia), confusione (2t, 50% self-hit). Trigger via `mossa.effetto` + `valoreEffetto` (% chance). Badge UI nella HpBar.

### Dati popolati (`src/data/allenatori.json`)

| Allenatore | Luogo | Tipo | Livello |
| --- | --- | --- | --- |
| Rivale | Percorso_1 | PVP | 5 |
| Gennaro Bullo | Percorso_1 | NPC | 5 |
| Luca | Piacenza | NPC | 8 |
| Marco il Marinaio | Venezia | Capopalestra | 10 |
| Anna Voltaggio | Milano | Capopalestra | 16-17 |
| Bruno Roccia | Torino | Capopalestra | 22-23 |
| Gianni il Pescatore | Grosseto | NPC | 24-25 |
| Selene Marea | Civitavecchia | Capopalestra | 28-30 |
| Vulcano Igneo | Cagliari | Capopalestra | 34-36 |
| Aurora Mente | Palermo | Capopalestra | 40-42 |
| Erika Foresta | Foggia | NPC | 42-43 |
| Giada Vesuvio | Napoli | Capopalestra | 46-48 |
| Ettore Tempesta | Pescara | NPC | 50-51 |
| **Imperatore Notturno** | **Roma** | **Capopalestra** | **56-58 (boss finale)** |

---

## 🚧 Fase A — voci rimaste in coda

### Trigger stati alterati nei dati (S, ~10 minuti)

L'engine degli stati funziona (12 test verdi) ma **nessuna mossa in `mosse.json` ha `effetto`/`valoreEffetto` valorizzati**, quindi gli stati non si attivano in giocato. Per attivarli:

```jsonc
// es. in mosse.json
{ "id": 99, ..., "effetto": "VELENO", "valoreEffetto": 30 }    // 30% chance
{ "id": 100, ..., "effetto": "SONNO", "valoreEffetto": 50 }    // 50% chance
{ "id": 101, ..., "effetto": "CONFUSIONE", "valoreEffetto": 25 } // 25%
```

Le chiavi accettate sono `'CONFUSIONE'`, `'SONNO'`, `'VELENO'` (vedi `EFFETTO_TO_STATO` in `battleEngine.ts`).

### Battaglia PvP esplicita (M)

Il tipo `'PVP'` è già nei tipi/store ma non c'è UX dedicata: oggi l'allenatore PVP (il Rivale) viene gestito dall'AI come un NPC normale. Per un PvP "vero" serve una scena con due pulsantiere mosse alternate, porting di `Mod_Battle_Engine` per il flusso a 2 giocatori umani.

### Allenatori per le città vuote (M, data-entry)

Le 14 città principali hanno almeno 1 allenatore (NPC o Capopalestra), ma alcuni percorsi e città secondarie sono vuoti. Aggiungere 1-2 NPC per ogni luogo non popolato dà materiale per allenamento e rende il mondo più vivo.

---

## 🆕 Fase B — Estensioni nuove (mai in VBA)

- ✅ **Stati alterati**: Confusione / Sonno / Avvelenamento — engine + UI completi (manca solo data-trigger)
- ⏭️ **Mosse di cura HP** a percentuale (l'AI ha già la priorità "CURA" in `scegliMossaIA`, manca l'esecuzione lato player)
- ⏭️ **Mossa Suprema**: ×2 danno + autodanno 50% HP max
- ⏭️ **Oggetti**: Masterball (cattura 100%), pozioni, etc.
- ⏭️ **Pulsante switch turno A↔B esplicito** (oggi auto)

---

## 💅 Fase C — Polish

- ⏭️ Sound effects (mosse, KO, evoluzione, cattura)
- ⏭️ Musica di sottofondo per scena
- ⏭️ Animazioni (entrata Pokémon, evoluzione più ricca, KO)
- ⏭️ Bilanciamento contenuti (livelli allenatori, distribuzione cespugli, economia monete)
- ⏭️ Sostituire emoji 🐺/🦈/🔥/💧 con sprite reali (immagini da `public/sprites/`)
- ⏭️ Sfondo Italia stilizzata in `MappaPrincipaleScene` (immagine vera, non gradiente)
- ⏭️ Code-splitting del bundle (chunk attuale > 500 KB; framer-motion separabile via `manualChunks`)

---

## 📦 Fase D — Distribuzione

- ⏭️ Deploy `gh-pages` (lo script `npm run deploy` esiste già)
- ⏭️ Build desktop con Tauri

---

## 🧪 Suite di test

| File | Test | Cosa copre |
| --- | --- | --- |
| `src/engine/__tests__/battleEngine.test.ts` | 24 | rollD6, roundHalfUp, calcolaHPMax, efficaciaTipo, determinaIniziativa, tentaCattura, applicaXP (1 KO = 1 lvl + cap 100 + evoluzione) |
| `src/engine/__tests__/monete.test.ts` | 7 | calcolaVariazioneMonete su tutti i match-up (NPC/Capopalestra/Selvatico/PVP × vittoria/sconfitta) |
| `src/engine/__tests__/encounters.test.ts` | 8 | pesoCategoria + scegliIncontroPesato (deterministico via RNG iniettabile) |
| `src/engine/__tests__/stati.test.ts` | 12 | applicaStato (durate) + risolviStatoInizioTurno (no-stato, veleno con clamp, sonno sveglia/saltato/cleared, confusione self-hit/agisce/cleared) |
| `src/engine/__tests__/deposito.test.ts` | 12 | scambia() (no-op, swap squadra↔dep + dep↔dep + squadra↔squadra, move con compattazione/append, squadra piena, immutabilità) |
| **Totale** | **63** | tutto verde |

I test coprono solo l'engine puro. Le scene React non hanno test automatici — verifica manuale via `npm run dev`.

---

## 🗂️ Diario commit (ultime feature merge)

| SHA | Descrizione |
| --- | --- |
| `7673233` | fix(battaglia): import StatoAlterato/STATO_BADGE persi nel merge |
| `a485c29` | Merge PR #7 — feat(deposito): scena Deposito + scambio squadra↔box |
| `984254f` | Merge PR #6 — feat(allenatori): tipo Capopalestra +1000 + popolamento città |
| `939710c` | Merge PR #5 — feat(rivale,evoluzione): starter scartato + scena Evoluzione |
| `1382efb` | Merge PR #4 — feat(stati): Confusione/Sonno/Avvelenamento (Fase B) |
| `3015cd5` | Merge PR #3 — engine VBA-aligned + percorso + cattura + mappa + città |

---

## 🎯 Prossimi candidati (in ordine di valore decrescente)

1. **Trigger stati nelle mosse** (S) — popola 3-5 mosse in `mosse.json` con `effetto`/`valoreEffetto`. Sblocca Fase B già in piedi e aggiunge profondità tattica immediata.
2. **Mosse di cura HP** (S-M) — completa il pattern degli "effetti" speciali: nuovi `effetto: 'CURA'`/`'CURA_PCT'` con applicazione a inizio turno. L'AI ha già la priorità.
3. **Allenatori nelle città vuote** (M, data-entry) — 1-2 NPC per ciascun luogo non popolato. Riempie il mondo.
4. **Bilanciamento + polish** (variabile) — playthrough completo, tuning di livelli/monete/cespugli.
5. **PvP esplicito** (M) — utile solo se vuoi un'esperienza locale a 2 giocatori reali.
6. **Mossa Suprema + Oggetti** (M) — Fase B residua.
7. **Sprite reali + sfondo mappa** (variabile, asset-pesante) — Fase C polish visivo.
8. **Deploy GitHub Pages + Tauri** (S+M) — Fase D, solo quando il gameplay è solido.

---

## 📌 Promemoria di metodo

- Per ogni nuova feature: aggiorna **dati** → **engine puro** → **store** → **scena**, mai il contrario.
- L'engine deve restare **senza dipendenze React / DOM**.
- Tutte le funzioni con randomness accettano un parametro `rng?: () => number` (default `Math.random`) per essere testabili.
- I tiri di dadi passano sempre per `rollD6` (mai `Math.random` diretto).
- Quando aggiungi una funzione che ha un equivalente VBA, scrivi `// Porting di: <NomeOriginale> da old_files/<File>.txt` come commento sopra.
- Non toccare `tipi.json` per "sistemarlo" alla canonica Pokémon ×2 — è intenzionalmente ×1.5 per il sistema d6.
- Quando si aggiungono effetti di mossa, usa le chiavi already-mapped: `'CONFUSIONE'`, `'SONNO'`, `'VELENO'`, `'CURA'`. Aggiungere chiavi nuove richiede di estendere `EFFETTO_TO_STATO` in `battleEngine.ts`.
