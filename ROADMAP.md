# Roadmap & stato attuale — Arkamon

> Documento di pianificazione consolidato. Aggiornato: 30 aprile 2026.
> Per il contesto di codebase e regole vedi [CLAUDE.md](./CLAUDE.md).

> ⚠️ **Stato attuale**: la Fase E (overworld a griglia) è **congelata** in attesa che la nuova **Fase BR — Battle Refresh** sia completata. La motivazione: senza una battaglia coerente con il prototipo PowerPoint (UI, InfoBox, schermata di scambio, allineamento engine VBA) il nuovo sistema di movimento non porterebbe abbastanza valore percepito.

## Stato sintetico

| Indicatore | Valore |
| --- | --- |
| Branch attivo | `claude/fix-merge-stati-badge` |
| Ultimo commit | `5a5f73e` Large update |
| Test (`npm test`) | **80/80 verdi** |
| Type check (`tsc --noEmit`) | clean |
| Build (`npm run build`) | clean — split in 4 chunk: app 316 KB / 33 KB gzip + react 134 KB / 43 KB + motion 115 KB / 38 KB + zustand 10 KB / 4 KB; nessun warning |
| Loop end-to-end giocabile | ✅ titolo → laboratorio → mappa (28 luoghi) → percorso/città → battaglia (NPC/Capo/selvatica multi-pokemon con cattura/XP/evoluzione) → ritorno · deposito accessibile dalla mappa |
| Prossima fase | 🚧 **Fase BR — Battle Refresh** (riallineamento UI battaglia al prototipo PowerPoint + reintegrazione funzioni VBA mancanti). Dettagli in fondo al documento. |

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

### ✅ Trigger stati alterati nei dati — FATTO

6 mosse popolate con `effetto`/`valoreEffetto` per dare profondità tattica subito:

| Mossa | Tipo | Effetto | Chance |
| --- | --- | --- | ---: |
| Predigestione | Erba | VELENO | 30% |
| Soffocaterra | Terra | VELENO | 30% |
| Canto del Crepuscolo | Oscurità | SONNO | 40% |
| Rugiada Mattutina | Acqua | SONNO | 35% |
| Ronzio Psichico | Psico | CONFUSIONE | 40% |
| Jumpscare | Oscurità | CONFUSIONE | 30% |

Chiavi accettate (mappa in `EFFETTO_TO_STATO` in `battleEngine.ts`): `'CONFUSIONE'`, `'SONNO'`, `'VELENO'`. Per ampliare in futuro basta aggiungere altre voci con queste chiavi.

### ✅ Battaglia PvP esplicita — FATTO

Il tipo `'PVP'` (oggi assegnato al Rivale del Percorso_1) attiva una pulsantiera mosse alternata controllata da input umano per entrambi i lati: niente AI sul Rivale.

Implementazione:
- Refactor di `BattagliaScene.turnoAvversario`: risolve stato di B, poi se PvP attende input umano (`mostraMoseB`); se NPC continua come prima con `scegliMossaIA`.
- Nuova `eseguiMossaB(bEffettivo, hpMaxB, idx)` condivisa tra PvP umano e NPC AI: gestisce cura/danno/suprema/autodanno e KO sia su A che su B.
- UI: pulsantiera mosse di B in alto a sinistra (visibile solo in PvP quando `mostraMoseB`), pulsanti A nascosti durante l'attesa di B. Indicatore turno tematizzato ("Turno del Rivale" / "Turno del Giocatore").

### ✅ Popolamento allenatori percorsi/città — FATTO

Tutti i 28 luoghi della mappa hanno ora almeno un allenatore. Aggiunti 17 NPC (ID 250-266) con livelli interpolati tra le tappe esistenti:

- 13 NPC sui percorsi vuoti (Percorso_2..14): Pendolare Lia (P2 lvl 12), Camionista Tito (P3 lvl 18), Studente Bilo (P4 lvl 19), Naturista Selva (P5 lvl 20), Operaio Bruno (P6 lvl 21), Esploratore Tom (P7 lvl 32), Pescatrice Rina (P8 lvl 38), Geologo Pietro (P9 lvl 43), Vagabondo Gino (P10 lvl 44), Cantante Lola (P11 lvl 44), Botanico Aldo (P12 lvl 45), Custode Filo (P13 lvl 49), Pellegrina Sara (P14 lvl 53).
- 4 NPC nelle 2 città vuote: Cuoca Rosa + Pescatore Calò (ReggioCalabria lvl 44-45), Tassista Mira + Cacciatore Olmo (Molisnt lvl 49).

Tutti NPC `tipo: "NPC"` (+200₳/-200₳, niente capipalestra fuori dal pool ufficiale degli 8).

---

## 🆕 Fase B — Estensioni nuove (mai in VBA)

- ✅ **Stati alterati**: Confusione / Sonno / Avvelenamento — engine + UI + 6 mosse trigger nei dati (Fase B chiusa)
- ✅ **Mosse di cura HP**: helper `applicaMossaCura` + integrazione `BattagliaScene` (player+AI) + 4 mosse `CURA_PCT` popolate (Tocco di pace 50%, Risveglio verde 40%, Respiro profondo 30%, Assorbilinfa 25%). AI ricorre alla cura se HP ≤ 30%.
- ✅ **Mossa Suprema**: `èMossaSuprema` + `autodannoSuprema` + ×2 al danno + autodanno % di hpMax. Integrato in `BattagliaScene` (gestisce auto-KO con switch o sconfitta, lato player+AI). 3 mosse `SUPREMA` popolate (Cannone Infernale, Ordine sovrano, Vortice divino — tutte autodanno 50%). AI evita la suprema se HP < pct + 5%.
- ✅ **Oggetti / Masterball**: nuovo tipo `OggettoId`, campo `inventario` in `StatoGiocatore`, action store `usaOggetto`/`aggiungiOggetto`, default 1 Masterball per giocatore. Pulsante "💎 Masterball ×N" in `BattagliaScene` (solo selvatica) con cattura garantita 100%. Migrazione safe per save preesistenti via `merge` con fallback.
- ✅ **Pulsante switch turno A↔B esplicito** (PvP): pausa esplicita tra turno corrente e successivo via pulsante "Passa il controllo al Rivale/Giocatore". Helper `passaTurnoAaB`/`passaTurnoBaA`/`confermaPassaggio` in `BattagliaScene`. Solo in PvP — battaglie NPC e selvatiche restano automatiche. Indicatore turno in alto si aggiorna ("Pronto per passare il controllo a..."). Le pulsantiere mosse sono nascoste durante l'attesa per impedire all'altro giocatore di sbirciare.

---

## 💅 Fase C — Polish

- ⏭️ Sound effects (mosse, KO, evoluzione, cattura)
- ⏭️ Musica di sottofondo per scena
- ✅ **Animazioni**: entrata Pokémon (slide-in da fuori schermo, spring), KO (exit con fall + rotate + grayscale), lunge attaccante (push verso il bersaglio sincronizzato col shaking del difensore). `BattagliaScene` avvolge `PokemonBattleSlot` in `AnimatePresence` keyed su `istanzaId` → switch su KO triggera exit/enter automatico. Evoluzione: glow giallo pulsato sul nuovo sprite + 14 particelle radiali che esplodono dal centro al "post".
- ⏭️ Bilanciamento contenuti (livelli allenatori, distribuzione cespugli, economia monete)
- ✅ **Sprite reali**: sostituite le emoji 🐺/🦈/🔥/💧 con sprite veri da `public/sprites/{front,back}_sprites/{id}.png`. Battaglia (back per giocatore, front per avversario), Laboratorio (selezione starter), Evoluzione (pre/post), Deposito (slot squadra + box). Fallback emoji su `onError` se uno sprite manca.
- ✅ **Sfondi reali**: nuovo `src/data/backgrounds.ts` con mapping luogo→file. Mappa principale (`Mappa-Finale.jpg`), Percorso/Città (28 luoghi mappati), Battaglia (sfondo del luogo di provenienza, fallback `battle_forest.jpg`), Laboratorio, Deposito, Evoluzione. Logo `logo_arkamon.png` nel TitoloScene.
- ✅ **Code-splitting del bundle**: `vite.config.ts` con `manualChunks` per `react`/`react-dom`, `framer-motion`, `zustand`. Chunk principale sceso da 566 KB → 315 KB (33 KB gzip), nessun warning > 500 KB, vendor cacheabili separatamente.

---

## 📦 Fase D — Distribuzione

- ✅ **Deploy GitHub Pages**: workflow `.github/workflows/deploy.yml` (build + upload-pages-artifact + deploy-pages) attivo su push a `main` e via `workflow_dispatch`. Vite `base` corretto a `/Arkamon-Beta/` (era `/Arkamon/`). Nuovo helper `src/utils/assetUrl.ts` (usa `import.meta.env.BASE_URL`) applicato a tutti i path runtime di asset (`/sprites/...`, `/backgrounds/...`, `/ui/...`, `/maps/...`) — Vite riscrive solo asset importati staticamente, gli altri vanno prefissati a mano. `src/vite-env.d.ts` aggiunto per i tipi di `import.meta.env`. Su `Andreatz/Arkamon-Beta`: attiva GitHub Pages dalle Settings → Pages → Source: "GitHub Actions"; il primo push (o "Run workflow" manuale) pubblicherà su `https://andreatz.github.io/Arkamon-Beta/`.
- ⏭️ Build desktop con Tauri

---

## 🧪 Suite di test

| File | Test | Cosa copre |
| --- | --- | --- |
| `src/engine/__tests__/battleEngine.test.ts` | 24 | rollD6, roundHalfUp, calcolaHPMax, efficaciaTipo, determinaIniziativa, tentaCattura, applicaXP (1 KO = 1 lvl + cap 100 + evoluzione) |
| `src/engine/__tests__/monete.test.ts` | 7 | calcolaVariazioneMonete su tutti i match-up (NPC/Capopalestra/Selvatico/PVP × vittoria/sconfitta) |
| `src/engine/__tests__/encounters.test.ts` | 8 | pesoCategoria + scegliIncontroPesato (deterministico via RNG iniettabile) |
| `src/engine/__tests__/stati.test.ts` | 12 | applicaStato (durate) + risolviStatoInizioTurno (no-stato, veleno con clamp, sonno sveglia/saltato/cleared, confusione self-hit/agisce/cleared) |
| `src/engine/__tests__/cura.test.ts` | 10 | èMossaCura + applicaMossaCura (CURA piatta, CURA_PCT, clamp hpMax, HP pieni, no-op, AI smoke) |
| `src/engine/__tests__/suprema.test.ts` | 7 | èMossaSuprema, autodannoSuprema (default 50%, % custom, clamp min 1, no-op), AI smoke |
| `src/engine/__tests__/deposito.test.ts` | 12 | scambia() (no-op, swap squadra↔dep + dep↔dep + squadra↔squadra, move con compattazione/append, squadra piena, immutabilità) |
| **Totale** | **80** | tutto verde |

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

1. **Fase BR — Battle Refresh** (vedi sezione dettagliata sotto): riallineamento UI battaglia al prototipo PowerPoint + reintegrazione delle funzioni VBA mancanti (InfoBox, schermata scambio, immunità incrociate stati, formula cattura, turno post-KO NPC). **Priorità #1 dichiarata dall'utente.**
2. **Fase E — Overworld a griglia** (congelata, vedi sezione dettagliata): cambio strutturale del modo di muoversi sulla mappa. Riprende dopo Fase BR.
3. **Bilanciamento + polish** (variabile) — playthrough completo, tuning di livelli/monete/cespugli.
4. **Build desktop con Tauri** — l'unica voce residua di Fase D. Richiede setup Rust + binari per piattaforma.
5. **Sound effects + musica** — Fase C residua (richiede asset audio esterni).

Nota: Fase B chiusa. Fase C polish: code-splitting + animazioni chiuse. Fase D: deploy gh-pages chiuso (workflow attivo su push a main).

---

## ⚔️ Fase BR — Battle Refresh (riallineamento al prototipo PowerPoint)

> **Decisione di design**: la battaglia attuale ha tre problemi documentati dall'utente: (1) **mancano funzioni VBA core** (InfoBox multi-step, schermata di scambio manuale post-KO, pulsante "turno avversario" anche in NPC, immunità incrociate stati, cura che rimuove veleno); (2) **UI grafica troppo distante** dallo screenshot del prototipo PowerPoint (HP bar a forma di bandiera con asset PNG, pulsanti mosse a 2 cards larghe in basso a destra invece di griglia 3 colonne, tipografia diversa); (3) **sprite Pokémon troppo piccoli** (`w-40 h-40` = 160px) e **sgranati** per via di `imageRendering: pixelated` applicato a sprite illustrati non pixel-art.
>
> **Output atteso**: la `BattagliaScene` ricalca fedelmente lo screenshot del prototipo PowerPoint (Darklaw vs Weedrug nella foresta) e tutte le funzioni VBA del modulo `Mod_Battle_Engine` sono coperte 1:1.

### Decisioni concordate con l'utente (sessione del 30 aprile 2026)

| # | Domanda | Risposta |
| --- | --- | --- |
| 1 | Ordine di esecuzione: BR.1 (UI) + BR.2 (InfoBox) + BR.3 (engine VBA-align) prima della Fase E? | **Sì.** Fase E congelata. |
| 2 | Modello stati: tenere % chance attuale o riallineare a VBA? | **Riallinea a VBA**: `valoreEffetto` = durata in turni, applicazione sempre 100% (salvo immunità incrociate). |
| 3 | Formula cattura: tenere `2 - hp/hpMax` (React) o `3 - hp/hpMax` (VBA, più generosa)? | **Riallinea a VBA**: `tassoCattura * (3 - hp/hpMax)`. |
| 4 | Schermata di scambio post-KO: scena dedicata o modal pop-up sopra la battaglia? | **Modal pop-up.** |
| 5 | Dimensioni sprite: confermo 280×280 giocatore / 240×240 avversario? | **Confermato.** |
| 6 | Asset HP bar: ricostruita in CSS+SVG o PNG dal PowerPoint? | **PNG dal PowerPoint**: `public/ui/hp_bar_player.png` (esistente, da usare come asset di sfondo). |

### Gap analysis VBA→React (da `old_files/Mod_Battle_Engine.txt`, `Mod_UI_Manager.txt`, `Mod_Game_Events.txt`, `Mod_Utilities.txt`)

#### Funzioni mancanti o degradate

| Voce | VBA originale | React attuale | Severità |
| --- | --- | --- | --- |
| **InfoBox multi-step** | `MostraInfoBox` con `Join(msgParts, vbCrLf)` accumula tutti gli eventi del turno e li mostra come blocco sequenziale ("X usa Soffio. Danno: 8 (Superefficace!). Avversario è ora avvelenato!") | `setLog([...l, msg])` mostra solo `log[log.length - 1]` come stringa singola | 🔴 Alto — si perde la sequenza di eventi |
| **Pulsante "Turno Avversario" in NPC** | `Pulsante_Turno_Avversario` blocca il flow dopo l'azione di A; il giocatore clicca per "vedere" il turno B (anche contro AI) | `setTimeout(1500)` automatico | 🟠 Medio — meno interattivo del prototipo |
| **Schermata di scambio Pokémon attivo** | `MostraSchermataScambio` apre `Box_Squadra` con 6 slot + sprite, click per scegliere chi mandare in campo dopo KO | Switch automatico al primo Pokémon vivo | 🔴 Alto — il giocatore non può scegliere |
| **Pulsante "Prosegui" fine battaglia** | `Pulsante_Prosegui` separato dal pulsante "Turno Avversario" | Tasto generico "Torna al percorso/città" | 🟡 Basso — solo cosmetico |
| **Cura rimuove veleno** | Dentro `Case "CURA"`: se attaccante è AVVELENATO chiama `PulisciStato` + msg "guarito dal veleno" | La cura ripristina HP ma non rimuove gli stati | 🟠 Medio |
| **Immunità incrociate sonno↔confusione** | `ApplicaStato`: se già `ADDORMENTATO` e si tenta `CONFUSO` → fallisce; e viceversa | Lo stato si sovrascrive sempre | 🟠 Medio |
| **Stati: applicazione sempre 100%** | `ApplicaStato` non ha % chance; il `mossaValore` è la **durata in turni** | `EFFETTO_TO_STATO` con `valoreEffetto` come % chance (30-40%) | 🟠 Medio — diversità autentica del codice |
| **Formula cattura più generosa** | `tassoCattura * (3 - hp/hpMax)` → moltiplicatore 2x→3x | `tassoCattura * (2 - hp/hpMax)` → moltiplicatore 1x→2x | 🟡 Basso |
| **Turno post-KO NPC passa a B** | Dopo KO + switch nemico, `Cells(12, 2).value = "B"` → il nuovo Pokémon nemico attacca subito | Il giocatore A mantiene il turno dopo lo switch | 🟠 Medio — gameplay diverso |
| **Squadra completa allenatori (6 slot)** | `ScegliProssimoPokemonAllenatore` legge 6 coppie `ID_Base/Livello` dal foglio Allenatori | Solo il primo Pokémon è migrato in `allenatori.json` per la maggior parte degli NPC | 🟠 Medio — battaglie meno lunghe |
| **Messaggio "Cosa? X si sta evolvendo!"** | `PreparaScenaEvoluzione("Cosa? " & nomePre & " si sta evolvendo!")` mostrato in InfoBox **prima** della transizione a scena Evo | Transizione diretta da `BattagliaScene` a `EvoluzioneScene` senza messaggio intermedio | 🟡 Basso — solo cosmetico |

#### Funzioni già correttamente portate (no-op, lascio com'è)

- `CalcolaHPMax`, `LanciaDadi`, `RoundIntHalfUp`, `DeterminaPrimoTurno`, `TipoMultiplier`, `ScegliMossaIA` (con STAB virtuale + tie-break), `OttieniParametriMossaAlLivello`, `CSVAppendUnique`, `PesoCategoria`, `ScegliIndicePesato`, `GestisciLevelUp`, `ControllaSeEvolve`, `CalcolaVariazioneMonete`, `ControllaSquadraRimanente`.

#### Differenze ID Capopalestra

- VBA usa threshold magico `idAvversario >= 203` per applicare +1000₳.
- React usa `allenatore.tipo === 'Capopalestra'` (modello esplicito, più robusto).
- **Decisione**: tengo modello React. Non riallineo.

### Style guide (estratta dallo screenshot reference del prototipo)

#### Sprite Pokémon

- **Giocatore (back)**: 280×280 px, posizionato in basso-sinistra, vista da dietro, **niente** `imageRendering: pixelated` (sprite illustrati, non pixel-art).
- **Avversario (front)**: 240×240 px, posizionato in alto-destra, vista frontale.
- Drop shadow morbida ellittica sotto i piedi (post-MVP, opzionale).

#### HP Bar (asset PNG `public/ui/hp_bar_player.png`)

- Forma a "bandiera" con punta a destra, sfondo rosso/marrone gradient + bordo bianco.
- Cerchio bianco a sinistra con scritta **"HP"** in font bold.
- Nome Pokémon a sinistra-centro (`Darklaw`, font bold).
- Livello a destra (`LV. 14`).
- Barra interna verde gradient (giallo se < 60%, rosso se < 25%) con margine bianco.
- Contatore numerico `25/25` sotto la barra (solo per il giocatore? Da verificare nello screenshot — il nemico non lo mostra).
- Posizione:
  - HP avversario: alto-centro/sinistra (sopra/accanto allo sprite avversario)
  - HP giocatore: appena sopra i pulsanti mosse, sotto-destra (accanto allo sprite giocatore)
- Implementazione: `<div style={{ backgroundImage: url(hp_bar_player.png) }}>` con elementi figli posizionati assolutamente per nome/livello/barra/contatore. La barra interna è un `<div>` colorato con `width: pct%` animato via framer-motion.

#### Pulsanti mosse

- 2 cards affiancate (non grid 3 colonne stretta) in basso al centro/destra.
- Sfondo grigio chiaro con bordo bianco arrotondato, ombra netta.
- Layout interno:
  - Riga 1: **nome mossa** in font bold (es. "Zampata", "Dardo di Fiamma")
  - Riga 2: `2` numero dadi · 🎲 icona dado · `+2` incremento · 🌑 icona tipo a destra
- 3 mosse → 3 cards (lo screenshot ne mostra 2 perché è una battaglia early-game con Pokémon a 2 mosse).

#### Sfondo battaglia

- Già presente: `public/backgrounds/battle_forest.jpg` e mappato via `getBackground(luogoRitorno)` in `BattagliaScene`. **Niente da fare.**

#### InfoBox messaggi

- Pannello in basso al centro, sopra/sotto i pulsanti mosse.
- Sfondo blu scuro o marrone (TBD, ricavare dal PowerPoint), bordo bianco arrotondato.
- Testo bianco multi-riga, font sans bold.
- Click sul pannello per avanzare al prossimo step (se presente) o nascondere e mostrare i pulsanti.

### Piano di lavoro a fasi (BR.1 → BR.3)

> Le 3 fasi sono **indipendenti** ma da fare nell'ordine indicato (UI prima, perché stabilisce dove vivono gli elementi; InfoBox dopo, perché si infila nell'UI esistente; engine align ultimo, perché può essere fatto a freddo senza toccare la UI).

#### **BR.1 — UI battaglia in stile PowerPoint** (Sforzo: M)

1. **Sprite più grandi e non sgranati**:
   - `BattagliaScene.tsx` → `PokemonBattleSlot`: cambia `w-40 h-40` (160px) in `w-72 h-72` (288px) per giocatore (back) e `w-60 h-60` (240px) per avversario (front).
   - **Rimuovi** `style={{ imageRendering: 'pixelated' }}` (sprite sono illustrati).
   - Riposiziona `posClass`: giocatore `bottom-12 left-8`, avversario `top-8 right-8` (più aderente allo screenshot).

2. **HP Bar redesign con asset PNG**:
   - Nuovo componente `<HpBarPanel>` (sostituisce `<HpBar>` attuale dentro `BattagliaScene`).
   - `backgroundImage: url(assetUrl('/ui/hp_bar_player.png'))`, `backgroundSize: contain`, `backgroundRepeat: no-repeat`.
   - Layout interno con position absolute: nome (left), livello (right), barra (middle), contatore (sotto).
   - Larghezza/altezza calibrata sull'asset PNG (probabile ~320×80 px, da verificare a runtime).
   - HP avversario: stesso asset speculato (mirror) o asset alternativo se esiste `hp_bar_enemy.png`.

3. **Pulsanti mosse redesign**:
   - Nuovo componente `<MoveCard>` (sostituisce `<MoveButton>` attuale).
   - Card larga ~240×120 px con bordo bianco, sfondo grigio chiaro (`#d4d4d8` o simile, calibrato sullo screenshot).
   - Layout interno: nome mossa in alto bold, sotto riga con numero dadi + icona dado SVG/PNG + `+N` incremento + icona tipo a destra.
   - Posizionamento: `bottom-8 right-8`, flex row gap-3 (le 3 mosse affiancate, non a griglia).

4. **Layout generale**:
   - Indicatore turno (oggi `top-4 left-1/2`) → spostato in basso al centro come parte dell'InfoBox (vedi BR.2).
   - Squad indicator (i 6 puntini) → resta in alto-sinistra/basso-destra, riposizionato per non sovrapporsi alle HP bar.

#### **BR.2 — InfoBox e flusso messaggi** (Sforzo: M)

1. **Nuovo componente `<InfoBox>`**:
   - Pannello centrato in basso (sopra i pulsanti mosse).
   - Stile: bordo bianco, sfondo blu scuro semitrasparente, testo bianco bold sans, padding generoso.
   - Multi-riga: accetta `messaggi: string[]` e li mostra tutti in sequenza con `\n` o uno alla volta su click (TBD: scelgo "tutti in sequenza" per semplicità, fedele al `Join(msgParts, vbCrLf)` VBA).

2. **Refactor messaging in `BattagliaScene`**:
   - State: invece di `log: string[]` flat, introduco `infoBoxMessaggi: string[] | null` che rappresenta i messaggi del **turno corrente**.
   - Ogni azione (mossa A, mossa B, danno stato, level up, evoluzione) accumula in `infoBoxMessaggi`.
   - A fine azione, mostro l'InfoBox con tutti i messaggi accumulati.
   - Click sull'InfoBox → nasconde l'InfoBox e abilita il prossimo step (mosse di B se NPC, o prossimo turno se PvP).

3. **Pulsante "Turno Avversario" in NPC** (riattivazione):
   - Dopo l'azione del giocatore A in NPC, mostra l'InfoBox con i messaggi della mossa A.
   - L'InfoBox ha un pulsante "▶ Avversario..." (visibile solo in NPC, non in PvP).
   - Click → InfoBox si aggiorna con messaggi dell'AI, poi pulsante diventa "▶ Continua" per chiudere il turno.
   - In selvatica: stesso meccanismo (l'avversario è AI casuale).

4. **Schermata di scambio Pokémon (modal)**:
   - Nuovo componente `<ScambioModal>` overlay sopra `BattagliaScene` quando un Pokémon va KO e ce ne sono altri vivi.
   - Layout: 6 slot con sprite small, nome, livello, HP bar mini, click per selezionare.
   - Slot KO disabilitato (grigio + "KO").
   - Conferma → l'istanza scelta diventa l'attivo, il modal si chiude, il turno passa all'avversario (come da VBA: il giocatore "perde" il turno per fare lo scambio? o no? Da verificare nel VBA — probabilmente sì, lo scambio consuma il turno).
   - Sostituisce lo switch automatico attuale.

5. **Pulsante "Prosegui" fine battaglia**:
   - Già esiste come "Torna al percorso/città" — rinomino in "Prosegui" per coerenza VBA.

6. **Messaggio "Cosa? X si sta evolvendo!"**:
   - Aggiungo un messaggio nell'InfoBox prima della transizione a `EvoluzioneScene`.
   - Sequence: KO nemico → InfoBox "Hai vinto. X ha guadagnato 1 EXP. X è salito al livello Y. Cosa? X si sta evolvendo..." → Click → `EvoluzioneScene`.

#### **BR.3 — Riallineamento engine al VBA** (Sforzo: S+M)

1. **Cattura: formula VBA**:
   - `src/engine/battleEngine.ts` → `tentaCattura`: cambia `(2 - hp/hpMax)` in `(3 - hp/hpMax)`.
   - Aggiorna test in `battleEngine.test.ts` (i 3-4 test su `tentaCattura` cambiano i valori attesi).
   - Aggiorna anche `CLAUDE.md` (sezione "Cattura") perché documentava `2 -`.

2. **Stati: modello "durata + applicazione sicura"**:
   - `valoreEffetto` ora è la **durata in turni**, non % chance.
   - `applicaStato` (in `battleEngine.ts`): rimuove il roll di probabilità, applica sempre **se non ci sono immunità incrociate**.
   - **Immunità incrociate**:
     - `Addormentato` ↔ `Confuso`: se uno è attivo, l'altro fallisce (come VBA `ApplicaStato`).
     - Stesso stato già attivo: fallisce.
   - Aggiorna le 6 mosse in `mosse.json` con `valoreEffetto` come durata (es. Sonno 3 turni, Confusione 2 turni, Veleno 5 turni).
   - Aggiungi messaggi di fallimento: "Ma non ha funzionato!" se l'immunità impedisce l'applicazione.
   - Aggiorna `stati.test.ts` (12 test → ~16 test con immunità incrociate).

3. **Cura rimuove veleno**:
   - `applicaMossaCura` (in `battleEngine.ts`): se l'istanza è `Avvelenato`, rimuove lo stato e aggiunge messaggio "guarito dal veleno!".
   - Aggiorna `cura.test.ts` (10 test → 11 test).

4. **Turno post-KO NPC passa a B**:
   - `BattagliaScene.tsx` → branch "KO nemico con switch in NPC": dopo `setPkmnB(nextB)`, **non** mantenere il turno A. Passa subito a B con un setTimeout.
   - Logica: il nuovo Pokémon nemico attacca immediatamente nel turno corrente (gameplay più aggressivo, fedele al VBA).

5. **Squadre allenatori complete (6 slot)**:
   - `src/data/allenatori.json`: estendi ogni allenatore da 1 Pokémon a fino a 6 (campi `pokemon: { specieId, livello }[]`).
   - `iniziaBattagliaNPC` nello store: usa l'array completo per popolare `squadraB`.
   - **Scope**: iniziale solo per gli 8 Capipalestra (priorità) e il Rivale; gli NPC minori restano a 1 Pokémon (sono "battaglie veloci"). Documentare in commento.

6. **Messaggio "Cosa? X si sta evolvendo!"**:
   - Già coperto in BR.2 punto 6 (è UI, non engine).

7. **Test suite**:
   - 80 test attuali → ~95 test dopo BR.3.
   - Type-check + build devono restare clean.

### Cosa NON viene fatto in Fase BR (rimandato)

- **Mossa Suprema "carica + lancia" su 2 turni** (variabile globale `g_MossaSupremaAttiva` nel VBA): troppo invasivo. Rimane come single-turn con autodanno (modello attuale React). Documentato come futura **Fase B.4**.
- **Threshold ID 203 per Capopalestra**: il modello React `tipo: 'Capopalestra'` è migliore. Non si tocca.
- **Sound effects per messaggi InfoBox**: rimanda a Fase C audio.

### Output verificabile per fase

| Fase | Verifica |
| --- | --- |
| BR.1 | Aprendo la BattagliaScene su `npm run dev`, gli sprite sono grandi come nello screenshot, le HP bar usano l'asset PNG, i pulsanti mosse sono 3 cards larghe in basso. |
| BR.2 | Ogni azione mostra un InfoBox multi-riga con tutti i messaggi del turno; pulsante "▶ Avversario..." in NPC; modal di scambio appare quando un Pokémon va KO con altri vivi in squadra. |
| BR.3 | `npm test` ~95/95 verdi; cattura più generosa (formula `3 -`); stati con immunità incrociate; cura rimuove veleno; nuovo Pokémon NPC attacca subito al cambio. |

### Asset richiesti

- ✅ **`public/ui/hp_bar_player.png`** (esistente, fornito dall'utente)
- ⏳ **`public/ui/hp_bar_enemy.png`** (opzionale, se l'asset HP del nemico è diverso — altrimenti riuso quello del player con flip)
- ⏳ **`public/ui/move_card_bg.png`** (opzionale, se preferisci card mosse con asset PNG anziché CSS — il CSS bastará per partire)
- ⏳ **`public/ui/dado_icon.png`** (opzionale, oggi è emoji 🎲)
- ⏳ **`public/ui/tipo_<nome>.png`** per gli 8 tipi (opzionale, oggi colorazione CSS via `--tw-color-tipo-<nome>`)

Per gli asset mancanti procedo con CSS+SVG/emoji come fallback. Se in seguito li produci, sostituisco l'implementazione CSS con `<img>`.

---

## 🗺️ Fase E — Overworld a griglia (nuovo sistema di movimento)

> ⚠️ **Stato: CONGELATA fino al completamento di Fase BR.** La motivazione è che senza una battaglia coerente con il prototipo PowerPoint il nuovo sistema di movimento non porterebbe abbastanza valore percepito.
>
> **Decisione di design**: il sistema attuale a "nodi cliccabili" (clic su Percorso_1 → entri → clicchi un cespuglio) viene sostituito da un **mondo a griglia di caselle con avatar**, in stile top-down isometrico tipo l'immagine reference di Venezia (mappa generata illustrata, non tile-set pixel-art classico). Le scene attuali (`PercorsoScene`, `CittaScene`, `MappaPrincipaleScene`) restano come **fallback** finché le mappe non sono tutte migrate.

### Regole di gioco (decise con l'utente)

1. **Movimento sequenziale a turni**: A muove + interagisce, poi tocca a B. Niente real-time.
2. **2 azioni per turno**, due modi di spenderle:
   - 1 movimento + 1 interazione (cespuglio / allenatore / edificio / NPC)
   - 2 movimenti senza interazione
   - L'interazione consuma **2 azioni** in totale (cioè chiude il turno, anche se il giocatore non ha ancora speso il primo movimento). In pratica: chi interagisce non si muove più in quel turno.
3. **Stessa mappa fisica per entrambi i giocatori**: A e B vedono e occupano la stessa griglia. Possono **stare sulla stessa casella**. **Non possono interagire tra loro** (no PvP via overworld; PvP resta innescato come oggi dal Rivale di Percorso_1).
4. **Cespugli e battaglie sono one-shot per giocatore** (regola già esistente, da preservare): la casella conserva un flag `visitato/sconfitto` per giocatore, non globale.
5. **Ritorno post-battaglia**: l'avatar torna sulla casella da cui è partita la battaglia, con la casella "consumata" per quel giocatore. L'altro giocatore vede ancora la casella come disponibile finché non la calpesta a sua volta.
6. **Edifici** (Centro Pokémon, Palestra, Laboratorio, Deposito): entrare in un edificio = transizione di scena dedicata (es. il Centro è la `curaSquadra` esistente, la Palestra è la battaglia col Capopalestra). Stessa regola di consumo azioni.
7. **Stile grafico mappa**: come l'immagine di Venezia allegata — vista top-down/isometrica illustrata (case, ponti, canali, piazze visibili come grafica unica), non tile-set pixel-art ricostruito casella per casella. Le caselle sono una **griglia logica invisibile sovrapposta** all'immagine di sfondo, con highlight visibili solo durante il turno del giocatore attivo.

### Modello dati

#### Tipi nuovi (`src/types/index.ts`)

```ts
type Casella =
  | { tipo: 'transito' }
  | { tipo: 'cespuglio'; cespuglioId: string }
  | { tipo: 'allenatore'; allenatoreId: number }
  | { tipo: 'npc'; dialogoId: string }
  | { tipo: 'edificio'; edificioId: 'centro' | 'palestra' | 'laboratorio' | 'deposito' }
  | { tipo: 'uscita'; versoMappaId: string; spawnX: number; spawnY: number }
  | { tipo: 'ostacolo' }   // muri, acqua, edifici non entrabili

type MappaGriglia = {
  id: string                // 'mappa-principale' | 'Venezia' | 'Percorso_1' | ...
  larghezza: number
  altezza: number
  caselle: Casella[][]      // [y][x], y dall'alto verso il basso
  spawnDefault: { x: number; y: number }
  background: string        // path immagine di sfondo (assetUrl)
}

type PosizioneAvatar = {
  mappaId: string
  x: number
  y: number
  direzione: 'N' | 'S' | 'E' | 'O'
}

type StatoTurnoOverworld = {
  giocatoreAttivo: 1 | 2
  azioniRimaste: number     // 2 a inizio turno, scala a 0 → cambio turno
}
```

#### Persistenza one-shot per giocatore

Nello store esiste già `cespugliVisitati: Set<string>` per giocatore. Si estende con:
- `caselleConsumate: Set<string>` per giocatore — chiave `"<mappaId>:<x>,<y>:<tipo>:<id>"` per battaglie/cespugli/allenatori già fatti su quella casella.
- Battaglie con allenatori restano in `allenatoriSconfitti` (già esistente) — la casella `allenatore` controlla quel set.

### Engine puro (`src/engine/movimento.ts` — nuovo)

Funzioni pure testabili (niente React, niente DOM):

- `caselleAdiacenti(pos: PosizioneAvatar, mappa: MappaGriglia): {x, y}[]` — 4-direzionale (N/S/E/O), filtrata per bordi mappa.
- `puòMuoversi(da: PosizioneAvatar, a: {x,y}, mappa: MappaGriglia): boolean` — controlla che `a` sia adiacente, dentro la mappa, e non `ostacolo`.
- `puòInteragire(casella: Casella, giocatoreId: 1|2, statoStore): boolean` — controlla che la casella sia interagibile e non già consumata da quel giocatore.
- `risultatoInterazione(casella, giocatoreId, statoStore): { tipo: 'battaglia-selvatica' | 'battaglia-npc' | 'edificio' | 'dialogo' | 'transizione-mappa' | 'no-op'; payload }` — descrive cosa scatenare.
- `consumaAzione(stato: StatoTurnoOverworld, tipo: 'movimento' | 'interazione'): StatoTurnoOverworld` — applica la regola: movimento `-1`, interazione `azioniRimaste = 0`.
- `nuovoTurno(giocatoreCorrente: 1|2): StatoTurnoOverworld` — `azioniRimaste = 2`, swap del giocatore.

Test in `src/engine/__tests__/movimento.test.ts`: copertura su tutti i casi (no movimento su ostacolo, no interazione su casella già consumata, regola 2-azioni/interazione-chiude-turno, swap turno).

### Stato globale (`src/store/gameStore.ts`)

Nuovi campi:
```ts
posizione1: PosizioneAvatar
posizione2: PosizioneAvatar
turnoOverworld: StatoTurnoOverworld
caselleConsumate1: Set<string>  // serializzato come array, già abbiamo il pattern per Set
caselleConsumate2: Set<string>
```

Nuove action:
- `muoviAvatar(giocatoreId, nuovaPos)` — applica movimento, decrementa azioni, eventualmente passa il turno.
- `interagisciCasella(giocatoreId, x, y)` — chiama `risultatoInterazione`, scatena la transizione (battaglia/edificio/...), marca la casella consumata, chiude il turno.
- `passaTurnoOverworld()` — fine azioni → swap.
- `tornaDallaBattaglia(esito)` — già esiste; estendere per gestire il ritorno sulla casella di partenza con consumo.

### Scene React

#### `MappaGrigliaScene` (nuova) — sostituisce in modalità nuova `PercorsoScene` / `CittaScene` / `MappaPrincipaleScene`

- Sfondo immagine fissa (assetUrl + zoom/pan se la mappa è > viewport)
- Griglia logica sovrapposta (CSS grid o SVG con celle invisibili)
- Avatar dei due giocatori con sprite + animazione di slide tra caselle (framer-motion `animate={{ x, y }}`)
- Highlight delle caselle adiacenti raggiungibili durante il turno del giocatore attivo (alone azzurro)
- Highlight delle caselle interagibili adiacenti (alone giallo + icona)
- Click su casella adiacente libera = muovi
- Click su casella interagibile adiacente = interagisci
- Tasti: WASD/frecce per movimento, Spazio per interagire (post-MVP)
- HUD in alto: turno corrente ("Turno di Giocatore 1"), azioni rimaste (2/2)
- Mini-indicatore "L'altro giocatore è in [Mappa]" se sono su mappe diverse (post-MVP, finché non si gioca tutto sulla stessa mappa principale)

#### Mappe da definire come JSON (`src/data/mappe-griglia/`)

Per partire (MVP):
- `mappa-principale.json` — Italia stilizzata come griglia con caselle "uscita" verso le 14 città/14 percorsi
- `Percorso_1.json` — esempio percorso (~15×8 caselle: 7 cespugli + 1-2 allenatori + transito + uscita verso Venezia/Piacenza)
- `Venezia.json` — esempio città (~30×20 caselle come l'immagine reference: case di transito, Centro Pokémon, Palestra di Marco il Marinaio, alcuni NPC, uscite verso mappa principale)

Le altre 27 mappe vengono migrate **dopo** che il sistema è solido.

### Asset grafici

Per Venezia (e in generale ogni città/percorso) serve **un'immagine di sfondo** in stile come quella allegata. Opzioni:
- Generate AI (come l'immagine reference) — l'utente fornisce o autorizza generazione
- Usare gli sfondi esistenti in `public/backgrounds/` come fallback temporaneo finché non si producono le versioni "isometriche illustrate" definitive
- Sprite avatar: 4 direzioni (N/S/E/O) × 2-frame walk = 8 frame per giocatore. Si può partire con un singolo sprite statico colorato diversamente per i 2 giocatori (rosso/blu) e iterare.

### Piano di lavoro a fasi

| Fase | Cosa | Sforzo | Output verificabile |
| --- | --- | --- | --- |
| **E.1** | Tipi (`Casella`, `MappaGriglia`, `PosizioneAvatar`, `StatoTurnoOverworld`) + engine `movimento.ts` + suite di test | S | 80 → ~95 test verdi, type-check clean, niente UI ancora |
| **E.2** | Store: `posizione1/2`, `turnoOverworld`, action `muoviAvatar` / `interagisciCasella` / `passaTurnoOverworld`, persistenza `caselleConsumate` con serializzazione Set | S | Test store; persistenza localStorage compatibile con save preesistenti |
| **E.3** | `MappaGrigliaScene` base con griglia 10×10 dummy hardcoded: due avatar, movimento click + tastiera, regola 2 azioni, swap turno automatico, highlight caselle | M | Scena giocabile end-to-end con dummy map; nessuna integrazione battaglie/edifici |
| **E.4** | Integrazione interazioni: cespuglio → `BattagliaScene` (selvatica), allenatore → `BattagliaScene` (NPC/Capopalestra), edificio centro → `curaSquadra`, edificio deposito → `DepositoScene`. Ritorno post-battaglia con casella consumata. | M | Loop completo cespuglio/allenatore/centro su dummy map |
| **E.5** | Transizioni tra mappe: casella `uscita` → fade-out/fade-in, spawn sull'altra mappa, persistenza posizione | S | Si passa da mappa-principale a Percorso_1 a Venezia |
| **E.6** | Definire JSON delle 3 mappe iniziali (mappa-principale dummy, Percorso_1, Venezia) — caselle, posizioni cespugli/allenatori/edifici | M | Si gioca su mappe reali, non più dummy |
| **E.7** | Asset grafici: sfondi mappa (riusa esistenti come fallback o nuovi in stile reference), sprite avatar 2 giocatori | M | Estetica vicina al reference |
| **E.8** | Migrazione delle 27 mappe restanti (16 percorsi / città+isole) a JSON griglia | L | Nuovo sistema sostituisce completamente le scene fallback |
| **E.9** | Polish: animazioni avatar (idle bounce, walk), pan camera che segue il giocatore attivo se la mappa > viewport, transizioni smooth | M | UX rifinita |

**MVP minimo giocabile (E.1 → E.6)**: si fa Percorso_1 e Venezia da overworld a griglia, le altre mappe restano sul sistema vecchio (fallback). Quando l'MVP è solido, si itera sulle altre.

### Compatibilità con il sistema esistente

- **Battaglie**: nessuna modifica alla `BattagliaScene` né all'engine di battaglia. Cambia solo come si **innesca** la battaglia (da casella vs da pulsante cespuglio).
- **XP / monete / evoluzioni**: invariate.
- **Save preesistenti**: serve migrazione (default a `posizione1/2` su `mappa-principale` allo spawn, `azioniRimaste = 2`, `caselleConsumate` vuoti). Si fa con `merge` come per `inventario`.
- **Scene fallback** (`PercorsoScene`, `CittaScene`, `MappaPrincipaleScene`): restano funzionanti. Il router (`App.tsx`) sceglie la scena nuova `MappaGrigliaScene` se l'utente è su una mappa migrata, altrimenti la vecchia. Quando E.8 è completa, le vecchie si rimuovono.

### Rischi e mitigazioni

- **Rischio**: la griglia logica sovrapposta a un'immagine illustrata può sembrare disallineata.
  - **Mitigazione**: definire un editor visivo minimale (un dev-tool: clicco sull'immagine, dico "questa zona = casella (5,3) tipo cespuglio"). Anche un overlay debug `?debug-grid=true` che mostra la griglia.
- **Rischio**: il save preesistente esplode al refactor dello store.
  - **Mitigazione**: bump `version` nel `persist` e migration che reset solo i campi nuovi.
- **Rischio**: la mappa principale (Italia intera) come griglia diventa enorme se mantieni la stessa scala delle città.
  - **Mitigazione**: la mappa principale resta a "macro-caselle" (ogni casella = 1 città/percorso), separata dalle mappe locali (Venezia ~30×20). Sono due livelli di zoom logici.

---

## 🎯 Prossimo passo concreto

Fase **BR.1 → BR.2 → BR.3** in sequenza (3 passate distinte, una per fase, ognuna verificabile end-to-end):

1. **BR.1 — UI battaglia**: sprite ingranditi a 280/240px senza `imageRendering: pixelated`, HP bar PNG asset, pulsanti mosse a 3 cards larghe in basso. Verifica visiva su `npm run dev`.
2. **BR.2 — InfoBox + flusso messaggi**: nuovo componente `<InfoBox>` multi-step, pulsante "▶ Avversario..." anche in NPC, modal di scambio Pokémon post-KO. Verifica end-to-end di un turno completo.
3. **BR.3 — Engine VBA-align**: cattura `(3 - hp/hpMax)`, stati come durata + immunità incrociate, cura rimuove veleno, turno post-KO NPC passa a B, squadre allenatori a 6 slot per Capi/Rivale. Test suite ~95/95 verdi.

Dopo Fase BR si scongela Fase E (overworld a griglia).

---

## 📌 Promemoria di metodo

- Per ogni nuova feature: aggiorna **dati** → **engine puro** → **store** → **scena**, mai il contrario.
- L'engine deve restare **senza dipendenze React / DOM**.
- Tutte le funzioni con randomness accettano un parametro `rng?: () => number` (default `Math.random`) per essere testabili.
- I tiri di dadi passano sempre per `rollD6` (mai `Math.random` diretto).
- Quando aggiungi una funzione che ha un equivalente VBA, scrivi `// Porting di: <NomeOriginale> da old_files/<File>.txt` come commento sopra.
- Non toccare `tipi.json` per "sistemarlo" alla canonica Pokémon ×2 — è intenzionalmente ×1.5 per il sistema d6.
- Quando si aggiungono effetti di mossa, usa le chiavi already-mapped: `'CONFUSIONE'`, `'SONNO'`, `'VELENO'`, `'CURA'`. Aggiungere chiavi nuove richiede di estendere `EFFETTO_TO_STATO` in `battleEngine.ts`.
