# Roadmap & stato attuale — Arkamon

> Documento di pianificazione consolidato. Aggiornato: 28 aprile 2026.
> Per il contesto di codebase e regole vedi [CLAUDE.md](./CLAUDE.md).

## Stato sintetico

| Indicatore | Valore |
| --- | --- |
| Branch attivo | `claude/review-typescript-code-0IWD1` |
| Commit ahead `main` | 6 |
| Test (`npm test`) | **39/39 verdi** |
| Type check (`tsc --noEmit`) | clean |
| Build (`npm run build`) | clean |
| Loop end-to-end giocabile | ✅ titolo → laboratorio → mappa → percorso/città → battaglia (con cattura/XP/evoluzione) → ritorno |

## Stack & vincoli

- React 18 + TypeScript + Vite 5 + Tailwind 3 + Zustand + framer-motion
- Vitest 2 (Vite 5 non è compatibile con Vitest ≥3 — pin a `^2`)
- Vite **bloccato a 5.x** (vedi CLAUDE.md "non aggiornare oltre")

---

## ✅ Fase A — Parità con VBA: completata in larga parte

Le seguenti voci della roadmap originale sono state portate in TS e sono testate / giocabili.

### Engine puro (`src/engine/battleEngine.ts`, `encounters.ts`)

- ✅ **Calcolo HP massimi** allineato al VBA: `liv ≤ 5 ? hpBase : hpBase + trunc((liv-5)*crescita)`
- ✅ **Tiro dadi** `rollD6(n, rng?)` con RNG iniettabile per testabilità deterministica
- ✅ **Round-half-up** (`roundHalfUp`, porting di `RoundIntHalfUp`)
- ✅ **Calcolo danno** con STAB×1.5 + efficacia di tipo (matrice 0.5 / 1 / **1.5**, non ×2 — fonte: `Database.xlsx`)
- ✅ **Cattura** 3d6 vs `tasso × (2 - hp/hpMax)` (porting fedele di `EseguiAzioneCattura`)
- ✅ **AI scelta mossa** con STAB virtuale + tie-break 50/50 (porting di `ScegliMossaIA`)
- ✅ **Iniziativa** `(lvA, lvB, rng?)` con tie-break a livelli pari
- ✅ **Cespugli pesati** 60/30/10 (`pesoCategoria`, `scegliIncontroPesato`, `generaIncontroDaCespuglio`)
- ✅ **Sistema monete** `calcolaVariazioneMonete` (+200 NPC / +1000 Capopalestra / −200 sconfitta vs allenatore)
- ✅ **XP** semplificato per scelta di game design (vedi sotto)

### Stato globale (`src/store/gameStore.ts`)

- ✅ Persistenza `localStorage` con serializzazione `Set` custom
- ✅ `StatoGiocatore.monete` + action `aggiornaMonete`
- ✅ `iniziaBattagliaNPC(allenatoreId, luogoRitorno)` popola `squadraA` (riferimento al team del giocatore) e `squadraB` (istanze fresche per ogni slot dell'allenatore)
- ✅ `risolviBattagliaNPC(esito)` applica monete + marca `allenatoriSconfitti` su vittoria
- ✅ `curaSquadra(giocatoreId)` per Centro Pokémon
- ✅ `aggiornaPokemon` per persistere modifiche di livello/xp/evoluzione

### Scene (`src/scenes/`)

- ✅ `TitoloScene` — Nuova partita / Continua
- ✅ `LaboratorioScene` — scelta starter ID 1/5/9 a turni
- ✅ `MappaPrincipaleScene` — **28 luoghi reali** disposti a forma d'Italia (coordinate inline, tunabili)
- ✅ `PercorsoScene` — 7 cespugli A-G visitabili una sola volta per giocatore (flag persistente)
- ✅ `CittaScene` — lista allenatori NPC sfidabili + Centro Pokémon
- ✅ `BattagliaScene` — multi-pokemon, cattura, XP, evoluzione inline, indicatore squadra a pallini

### Battaglia

- ✅ Selvatica con cattura (pulsante "🟡 Cattura")
- ✅ NPC con monete su vittoria/sconfitta + flag `allenatoriSconfitti`
- ✅ **Multi-pokemon**: switch automatico su KO finché un lato ha ancora pokemon vivi
- ✅ **XP regola di gioco**: 1 KO = 1 punto XP, 1 punto XP = 1 livello, livello max 100 (per arrivare a 100 servono 99 KO)
- ✅ **Evoluzione inline**: al raggiungimento del livello soglia il pokemon cambia `specieId` + `nome`, HP ricalcolato

---

## 🚧 Fase A — voci rimaste da completare

### Alto valore / scope contenuto

- ⏭️ **Pokémon scartato → Rivale**
  Il `LaboratorioScene` rimuove l'ID dello starter non scelto dalla lista ma non lo assegna a nessun avversario. Va wired sul Rivale (allenatore ID 201, tipo PVP). Stima: **S**.

- ⏭️ **Scena Evoluzione dedicata**
  Oggi l'evoluzione è inline (riga di log + cambio sprite a fine battaglia). Il VBA originale aveva `AvviaScenaEvoluzione` con animazione e conferma. Riferimento: `Mod_Game_Events.AvviaScenaEvoluzione`, `PreparaScenaEvoluzione`, `ConcludiEvoluzione`. Stima: **M**.

- ⏭️ **Distinzione Capopalestra (+1000₳)**
  Il tipo `TipoAllenatore` è `'PVP' | 'NPC'` — manca `'Capopalestra'`. Aggiungerlo al type union, segnalarlo nei dati `allenatori.json`, e farlo leggere come `TipoAvversario = 'Capopalestra'` in `risolviBattagliaNPC`. Stima: **S**.

- ⏭️ **PvP (Player vs Player)**
  Il tipo `'PVP'` è già nel codice; manca un entry point UX. Quando incontri il Rivale (Percorso_1) o ad altri PvP designati, deve attivarsi una scena con due pulsantiere mosse (porting di `Mod_Battle_Engine` per battaglie PvP). Stima: **M**.

### Scope più grande

- ⏭️ **Deposito 3 box, scambio squadra↔box**
  Porting di `Mod_Deposito` (`ApriInterfacciaDeposito`, `GestisciClickSlot`, `EseguiScambio`). Lo store ha già `deposito: Record<"box:slot", PokemonIstanza>` (30 box × 35 slot, sparse). Manca tutta la UI e l'azione di scambio. Stima: **L**. **Diventa rilevante solo dopo che il giocatore può accumulare > 6 pokemon**.

- ⏭️ **Più allenatori in più città**
  Oggi `allenatori.json` ha 3 voci (1 Rivale a Percorso_1, 2 NPC). Le altre città mostrano "Nessun allenatore". Data-entry per popolare almeno le 14 città principali. Stima: **M** (no logica, solo dati).

---

## 🆕 Fase B — Estensioni nuove (mai implementate, neanche in VBA)

- ⏭️ **Stati alterati**:
  - Confusione (2 turni, 50% di colpire sé stessi)
  - Sonno (3 turni, 50% sveglia per turno o salta)
  - Avvelenamento (10% HP/turno)
- ⏭️ **Mosse di cura HP** a percentuale
- ⏭️ **Mossa Suprema**: ×2 danno, autodanno 50% HP max
- ⏭️ **Oggetti**: Masterball (cattura 100%), eventuali pozioni
- ⏭️ **Pulsante switch turno A↔B esplicito** (oggi auto)

---

## 💅 Fase C — Polish

- ⏭️ Sound effects (mosse, KO, evoluzione, cattura)
- ⏭️ Musica di sottofondo per scena
- ⏭️ Animazioni (entrata Pokémon, evoluzione, KO)
- ⏭️ Bilanciamento contenuti (livelli allenatori, distribuzione cespugli, economia monete)
- ⏭️ Sostituire emoji 🐺/🦈 con sprite reali per Pokémon
- ⏭️ Sfondo Italia stilizzata in `MappaPrincipaleScene` (immagine vera, non gradiente)

---

## 📦 Fase D — Distribuzione

- ⏭️ Deploy `gh-pages` (lo script `npm run deploy` esiste già)
- ⏭️ Build desktop con Tauri

---

## 🧪 Suite di test

| File | Test | Cosa copre |
| --- | --- | --- |
| `src/engine/__tests__/battleEngine.test.ts` | 24 | rollD6, roundHalfUp, calcolaHPMax, efficaciaTipo, determinaIniziativa, tentaCattura, applicaXP (regole 1 KO = 1 lvl + cap 100 + evoluzione) |
| `src/engine/__tests__/monete.test.ts` | 7 | calcolaVariazioneMonete su tutti i match-up (NPC/Capopalestra/Selvatico/PVP × vittoria/sconfitta) |
| `src/engine/__tests__/encounters.test.ts` | 8 | pesoCategoria + scegliIncontroPesato (deterministico via RNG iniettabile) |
| **Totale** | **39** | tutto verde |

I test coprono l'engine puro. Le scene React non hanno test automatici al momento — la verifica è manuale via `npm run dev`.

---

## 🗂️ Diario commit (questa branch)

| SHA | Descrizione |
| --- | --- |
| `c17e7b1` | Engine VBA-aligned (6 fix) + suite vitest + matrice tipi 1.5× |
| `f1e0a80` | Sistema monete + cespugli pesati 60/30/10 + Scena Percorso |
| `70f9718` | Pulsante Cattura nelle battaglie selvatiche |
| `1213175` | Mappa principale popolata con i 28 luoghi reali |
| `a6e5c26` | Scena Città + Battaglia NPC + Centro Pokémon |
| `fba61b5` | Multi-pokemon team + XP semplificato (1 KO = 1 lvl) + evoluzione inline |

---

## 🎯 Prossimi candidati (in ordine di valore decrescente)

1. **Pokémon scartato → Rivale + Scena Evoluzione dedicata** (combo UX/storytelling, ~M totale). Chiude due fili narrativi importanti del laboratorio e rende le evoluzioni un momento "sentito".
2. **Capopalestra (+1000₳)** + popolamento allenatori delle città (~M, mostly data-entry). Sblocca progressione economica e dà significato alle città vuote.
3. **Stati alterati** (confusione/sonno/avvelenamento, ~L). Profondità tattica al combattimento.
4. **Deposito** (~L). Diventa interessante solo quando le squadre saranno più grosse.
5. **Polish** (sprite, SFX, sfondo mappa Italia, ~variabile). Da fare quando il gameplay è solido.

---

## 📌 Promemoria di metodo

- Per ogni nuova feature: aggiorna **dati** → **engine puro** → **store** → **scena**, mai il contrario.
- L'engine deve restare **senza dipendenze React / DOM**.
- Tutte le funzioni con randomness accettano un parametro `rng?: () => number` (default `Math.random`) per essere testabili.
- I tiri di dadi passano sempre per `rollD6` (mai `Math.random` diretto).
- Quando aggiungi una funzione che ha un equivalente VBA, scrivi `// Porting di: <NomeOriginale> da old_files/<File>.txt` come commento sopra.
- Non toccare il database `tipi.json` per "sistemarlo" alla canonica Pokémon ×2 — è intenzionalmente ×1.5 per il sistema d6.
