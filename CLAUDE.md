# CLAUDE.md — Contesto per Claude Code

> Questo file viene letto automaticamente da Claude Code ad ogni sessione.
> Contiene tutto ciò che serve per lavorare su Arkamon senza dover ricostruire il contesto ogni volta.
> **Tutti i numeri/formule qui sono estratti dal codice VBA originale in `old_files/`** — sono autoritativi.

## 🎮 Cos'è Arkamon

Gioco ibrido **Pokémon × boardgame con dadi D6** (stile D&D), in versione web.
Originariamente prototipato in PowerPoint+VBA, ora React/TypeScript.

**Ambientazione**: Italia stilizzata (la mappa principale è una versione fantasy della penisola italiana).

**Modalità di gioco**: 2 giocatori principali a turni + altri giocatori che interpretano Capipalestra e Rivale (ruoli PvP).

**Loop di gioco**:
1. Scelta starter in laboratorio (1 di 3, il terzo va al Rivale)
2. Movimento sulla mappa principale (città + percorsi)
3. Esplorazione cespugli (cattura Pokémon) e palestre (sfide)
4. Battaglie a turni: selvaggio / NPC / PvP
5. Progressione tramite XP, evoluzioni, monete, badge

## 🏗️ Stack & comandi

- **Stack**: React 18 + TypeScript + Vite 5 + Tailwind 3 + Zustand
- **Node**: 18+
- **Pacchetto**: `npm` (NON usare yarn/pnpm in questa repo)

```bash
npm install      # prima volta
npm run dev      # http://localhost:3000 con hot reload
npm run build    # build produzione
npm run preview  # anteprima del build
```

⚠️ **NON eseguire MAI `npm audit fix --force`**: ha già rotto la repo una volta forzando Vite v5 → v8. Se vedi vulnerabilità "moderate" su dev-dependencies, ignorale. Vedi `INSTRUZIONI.md`.

## 📁 Architettura

```
src/
├── data/         JSON di gioco (pokemon, mosse, tipi, mappe…) + index.ts (loader tipizzato)
├── types/        Interfacce TypeScript del dominio
├── engine/       LOGICA PURA. Niente React/DOM qui. Testabile in isolamento.
├── store/        Stato globale Zustand + persistenza localStorage
├── scenes/       Schermate React (Titolo, Laboratorio, MappaPrincipale, Battaglia, …)
├── components/   UI riutilizzabile (HpBar, MoveButton, …)
├── App.tsx       Router scene
├── main.tsx      Entry React
└── index.css     Variabili CSS globali (--arka-*)
```

## 🎯 Specifiche di game design (autoritative, dal VBA)

### Pokémon — `Pokemon_Base`
- **Totale**: 110 specie (ID 1-110)
- **Starter**: ID 1 (Vyrath/Normale), 5 (Darklaw/Oscurità), 9 (Felyss/Psico) — 4 stadi ognuno
- **Squadra**: massimo **6** in attivo, gli altri in deposito (3 box × ~35 slot)
- **Tipi**: 8 in totale → `Normale, Elettro, Fuoco, Terra, Acqua, Erba, Oscurità, Psico`
- **Categorie** (determinano crescita HP per livello):

| Categoria    | HP/livello | Esempi              |
| ------------ | ---------- | ------------------- |
| Lenta        | +1.0       | Sparkly, Grimbolt   |
| Media        | +1.5       | Vyrath, Darklaw, Felyss (gli starter) |
| Veloce       | +2.0       | Clastoom, Blazion   |
| Leggendaria  | +3.14      | Ao-shin, Aka-shin, Oniros, Voider |

- **HP base**: 12 per tutti i Pokémon (livello base 5)
- **Livelli**: minimo 5, massimo 100
- **Mosse**: 3 slot fissi (`Mossa1_ID, Mossa2_ID, Mossa3_ID` nella tabella). Alcuni stadi hanno solo 1-2 mosse (gli ID 0 sono slot vuoti).
- **Tasso cattura**: per Pokémon (1 = leggendari, 5 = molto facile da catturare)
- **Evoluzione**: campo `Livello_Evoluzione` + `Evoluzione_ID`. Esempi:
  - Starter: lvl 15 → 35 → 55
  - Linee a 3 stadi (Wormaren, Clastoom, Chimzap, RS-219, Leafrex, Shabyss, ecc.): lvl 19 → 40
  - Linee a 2 stadi (la maggioranza): lvl 26
- ⚠️ **Bug noto nel database**: alcuni Pokémon non hanno categoria popolata (Ervys 99-100, Xesar 101-102, Zoorian 105-106). Quando porti il dato in JSON, segnalalo.

### Mosse — `Mosse`
Ogni mossa ha:
- `ID_Mossa`, `Nome_Mossa`, `Tipo`
- 96 colonne `Dadi_lvl_5..Dadi_lvl_100` (numero di D6 da tirare a quel livello)
- 96 colonne `Incremento_lvl_5..Incremento_lvl_100` (bonus piatto sommato al tiro)
- Esempi: "Soffio" (Normale, 1d6+1 a lvl 5, 20d6+20 a lvl 100), "Voltaggio" (Elettro, 1d6+1 a lvl 5)

### Matrice tipi 8×8 — `Tipi`
Riga = tipo attaccante, colonna = tipo difensore.

| ATK \ DEF  | Norm | Elet | Fuoc | Terr | Acqu | Erba | Oscu | Psic |
| ---------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Normale    | 1    | 1    | 1    | 1    | 1    | 1    | 1    | 1    |
| Elettro    | 1    | 1    | 1    | 0.5  | **2**| 1    | 1    | 1    |
| Fuoco      | 1    | 1    | 1    | 1    | 0.5  | **2**| 1    | 1    |
| Terra      | 1    | **2**| 1    | 1    | 1    | 0.5  | 1    | 1    |
| Acqua      | 1    | 0.5  | **2**| **2**| 1    | 1    | 1    | 1    |
| Erba       | 1    | 1    | 0.5  | 1    | **2**| 1    | 1    | 1    |
| Oscurità   | 1    | 1    | 1    | 1    | 1    | 1    | 1    | **2**|
| Psico      | 1    | 1    | 1    | 1    | 1    | 1    | **2**| 1    |

Nessun tipo ha immunità (0×); tutto è 0.5 / 1 / 2.

### Calcolo HP massimi
```
hpMax(idBase, livello) = 
  livello <= 5 ? hpBase
                : hpBase + Int((livello - 5) * hpPerLivello[categoria])
```

### Calcolo danno
```
sommaDadi  = somma di N tiri di 1d6  (N = Dadi_lvl_<L>)
incremento = Incremento_lvl_<L>
mult       = TipiMatrix[tipoMossa][tipoDifensore]   // 0.5, 1 o 2
danno      = roundHalfUp((sommaDadi + incremento) * mult)
```

⚠️ **Lo STAB (1.5×) NON è applicato al danno** nel VBA originale: è usato **solo** dall'AI per scegliere la mossa migliore (vedi sotto). Quando porti questa logica in TS, mantieni lo stesso comportamento (o segnalalo all'utente prima di cambiarlo).

### AI scelta mossa NPC
```
score(mossa) = ((numD6 * 3.5) + incremento) * mult * stabMult
  dove stabMult = 1.5 se tipo_mossa == tipo_attaccante, altrimenti 1.0
sceglie la mossa col score più alto
in caso di pareggio, 50/50 tra le mosse pari merito
```

### Cattura (solo battaglie selvatiche)
```
roll          = 3d6   (tre tiri di 1d6 sommati, range 3..18)
sogliaSuccesso = tassoCattura * (2 - hpAttualiB / hpMaxB)
catturaRiuscita = roll <= sogliaSuccesso
```
- HP pieno → moltiplicatore 1× (più difficile)
- HP a 0 → moltiplicatore 2× (più facile)
- `tassoCattura` per Pokémon: dal database (1 leggendari, 5 comuni)

### Determinazione primo turno
- Livello più alto → tocca a quel giocatore
- Pareggio → casuale 50/50

### Cespugli (incontri)
- 7 cespugli per percorso, etichettati A-G (vedi `Incontri_Selvatici`)
- Ogni cespuglio ha 3-4 Pokémon assegnati con probabilità:
  - **Comune**: peso 60
  - **Medio**: peso 30
  - **Difficile**: peso 10
- Algoritmo di scelta: peso totale → roll random nel range → indice corrispondente
- **Ogni cespuglio è visitabile UNA SOLA VOLTA per giocatore** (flag persistente)

### Combattimento (3 tipi)
Tutti a turni, basati su D6.

| Tipo            | Azioni giocatore         | Avversario controllato da | Cattura disponibile? |
| --------------- | ------------------------ | ------------------------- | -------------------- |
| **Selvatico**   | 3 mosse o **Cattura**    | AI random (3 mosse)       | ✅ sì                 |
| **Allenatore_NPC** | 3 mosse              | AI con `ScegliMossaIA`    | ❌ no                 |
| **PvP**         | 3 mosse                  | Terzo giocatore (3 mosse PvP) | ❌ no             |

Fine battaglia → HP di tutti i Pokémon ripristinati al massimo, ritorno alla scena precedente (`Fonte_Ritorno`).

### Sistema XP & Level Up (già presente nel VBA)
- 1 punto EXP per nemico sconfitto
- Da gestire in roadmap: `2× exp` per cattura, `EXP limitata per percorso`
- Salita di livello → ricalcolo HP max + scaling automatico delle mosse

### Sistema Monete (già presente nel VBA)
- +200$ per allenatore NPC battuto
- +1000$ per Capopalestra battuto
- −200$ se sconfitto da un allenatore

### Sistemi futuri (in roadmap originale, NON ancora implementati)
- **Stati**: Confusione (2 turni, 50% di colpirsi), Sonno (3 turni, 50% sveglia/turno saltato), Avvelenamento (10% HP/turno)
- **Mosse di cura HP** a percentuale
- **Mossa Suprema**: danno doppio + autodanno (50% HP max)
- **Oggetti**: Masterball (cattura 100%)
- **Pulsante turno A↔B**

### Mappa principale (`Mappe`)
28 luoghi totali, ognuno mappato a una slide PowerPoint. Quando porti in TS, mappa luogo → componente scena.

| Luogo            | Slide ID PPT |
| ---------------- | ------------ |
| Venezia (start)  | 4            |
| Percorso_1       | 5            |
| Piacenza         | 6            |
| Percorso_2       | 7            |
| Milano           | 8            |
| Percorso_3..6    | 9, 10, 11, 12|
| Torino           | 13           |
| Grosseto         | 14           |
| Civitavecchia    | 15           |
| Percorso_7       | 16           |
| Cagliari         | 17           |
| Percorso_8       | 18           |
| Palermo          | 19           |
| Percorso_9       | 20           |
| ReggioCalabria   | 21           |
| Percorso_10      | 22           |
| Foggia           | 23           |
| Percorso_11..12  | 24, 25       |
| Napoli           | 26           |
| Molisnt          | 27           |
| Percorso_13      | 28           |
| Pescara          | 29           |
| Percorso_14      | 30           |
| Roma             | 31           |
| (slide 32 = VS)  | 32           |
| (slide 33 = battaglia) | 33     |
| (slide 34-36 = box deposito 1-3) | 34-36 |

## 📦 La cartella `old_files/` (FONTE DELLA VERITÀ originale)

Contiene il **prototipo VBA originale** (codice `.bas`/`.cls`/`.frm`, le slide PowerPoint esportate come immagini, l'Excel del database). È la **fonte autorevole** per qualunque dubbio sulla logica di gioco.

### Struttura attesa di `old_files/`

| File                          | Contenuto                                |
| ----------------------------- | ---------------------------------------- |
| `Mod_Battle_Engine.bas`       | Calcolo danno, AI, cattura, fine battaglia |
| `Mod_Game_Events.bas`         | Setup starter, scelta Rivale, transizioni di scena |
| `Mod_UI_Manager.bas`          | Visibilità pulsanti, sprite, infobox     |
| `Mod_ButtonClick_Handlers.bas`| Handler `*_Click()` collegati alle forme PowerPoint |
| `Mod_Deposito.bas`            | Apertura box, scambio squadra↔deposito (3 box × 35+ slot) |
| `Mod_Utilities.bas`           | Helper generici (CSV, lookup, dadi, clamp livello) |
| `Database.xlsx`               | 11 fogli: Pokemon_Base, Mosse, Crescita_HP, Tipi, Mappe, Stato_Giocatore, Incontri_Selvatici, Allenatori, Battaglia_Corrente, Giocatore[1\|2]_Squadra, Giocatore[1\|2]_Deposito |
| Slide esportate (.png)        | Screenshot delle scene (titolo, laboratorio, mappa, percorso, battaglia, deposito, evoluzione) |

### Funzioni VBA chiave (già implementate, da portare in TS)

**Engine (logica pura, → `src/engine/`)**:
- `CalcolaHPMax(idBase, livello)` → numero
- `LanciaDadi(n)` → somma di n D6
- `OttieniParametriMossaAlLivello(mossaID, livello)` → `{nome, tipo, numD6, incremento}`
- `TipoMultiplier(tipoAtk, tipoDef)` → 0.5 | 1 | 2
- `ScegliMossaIA(idBaseAtt, lvAtt, idBaseDif)` → indice 1..3
- `CalcolaEApplicaDanno(latoAttaccante, idxMossa, ...)` → applica danno + restituisce messaggio
- `EseguiAzioneCattura()` → calcola roll cattura, esegue
- `DeterminaPrimoTurno(lvA, lvB)` → "A" | "B"
- `PesoCategoria(categoria)` → 60 | 30 | 10
- `ScegliIndicePesato(possibiliIncontri)` → indice del Pokémon che appare nel cespuglio
- `ControllaSeEvolve()` → bool (se il Pokémon attuale ha raggiunto la soglia)
- `GestisciLevelUp()` → applica level up, aggiorna HP max, applica mosse nuove

**State (Zustand → `src/store/gameStore.ts`)**:
- Tutto ciò che è in `Battaglia_Corrente`, `Giocatore[1|2]_Squadra/Deposito`, `Stato_Giocatore`
- Persistenza in localStorage (sostituisce il salvataggio Excel del VBA)

**UI (React → `src/scenes/` e `src/components/`)**:
- `AbilitaPulsantiPerTurno`, `AggiornaUI_PostAzione`, `AggiornaSpritePokemon`, `MostraInfoBox` → diventano stato React/Zustand
- `ApriInterfacciaDeposito` → `DepositoScene.tsx`
- `AvviaScenaEvoluzione` → `EvoluzioneScene.tsx`

### Regole d'uso di `old_files/`

1. **Quando hai un dubbio sul comportamento atteso, controlla PRIMA in `old_files/`**, non inventare.
2. **Non importare** quei file: servono solo come specifica.
3. **Quando porti una funzione VBA in TS**, aggiungi un commento:
   ```ts
   // Porting di: <NomeOriginale> da old_files/<File>.bas
   ```
4. **Le slide PowerPoint contengono mockup** (titolo, laboratorio, mappa Italia, percorso con cespugli, battaglia, deposito, evoluzione) → usali come riferimento per layout e stile visivo.
5. **Se trovi una formula in VBA che differisce dall'implementazione TS attuale**, segnalala all'utente prima di "correggerla".

## 📝 Convenzioni di codice

- **TypeScript strict**: niente `any` impliciti.
- **Engine puro**: `src/engine/*` non importa nulla da React, DOM, store. Funzioni pure per testabilità.
- **Determinismo**: i tiri di dadi passano per un helper `rollD6(n, rng?)` in `engine/` (così si può seedare nei test).
- **Store**: lo stato di gioco vive in `src/store/gameStore.ts` (Zustand). Le scene leggono via selettori, non destrutturano l'intero store.
- **Stile**: Tailwind con palette custom in `tailwind.config.js`. Colori globali via variabili CSS in `src/index.css` (`--arka-primary`, `--arka-bg`, ecc.). NON hardcodare `#xxxxxx` nei componenti.
- **Naming**: scene in `PascalCaseScene.tsx`, componenti in `PascalCase.tsx`, helper in `camelCase.ts`.
- **i18n**: il gioco è in **italiano**. Tutti i testi UI in italiano. I nomi delle variabili/funzioni in inglese (standard del codice).

## 🚫 Cose da NON fare

- ❌ NON lanciare `npm audit fix --force`
- ❌ NON aggiornare Vite oltre la 5.x senza un piano di migrazione
- ❌ NON aggiungere dipendenze pesanti senza chiedere (il bundle deve restare leggero per Tauri)
- ❌ NON spostare logica dell'engine dentro i componenti React
- ❌ NON usare `localStorage` direttamente nei componenti: passa sempre dallo store (che lo persiste)
- ❌ NON committare file di build (`dist/`, `node_modules/`)
- ❌ NON aggiungere lo STAB al calcolo del danno se non concordato (nel VBA originale è solo nell'AI)

## ✅ Workflow tipico per una feature

1. Aggiorna i tipi in `src/types/index.ts` se necessario
2. Aggiungi/modifica i dati in `src/data/*.json`
3. Aggiungi la logica pura in `src/engine/<nuovoModulo>.ts`
4. Aggiungi lo stato in `src/store/gameStore.ts`
5. Crea/modifica la scena in `src/scenes/<NomeScena>.tsx`
6. Componenti riutilizzabili in `src/components/`
7. Verifica con `npm run dev` e poi `npm run build` (deve passare senza errori TS)

## 🗺️ Stato reale del progetto (dal confronto VBA ↔ React)

Il VBA è **molto più completo** di quanto suggerito dalla roadmap del README. Lista di feature **già funzionanti in VBA** che devono essere portate/finite in TS:

- ✅ Battaglia selvatica (mossa, cattura, AI random)
- ✅ Battaglia NPC (con AI intelligente che usa STAB + tipo)
- ✅ Battaglia PvP (con due pulsantiere mosse)
- ✅ Calcolo danno con efficacia tipi e messaggi ("Superefficace!", "Poco efficace…")
- ✅ Sistema XP e level up con scaling automatico delle mosse
- ✅ Evoluzioni con scena animata dedicata
- ✅ Sistema monete (+200/+1000/-200)
- ✅ Deposito a 3 box, scambio squadra↔deposito
- ✅ Cambio Pokémon in battaglia quando uno è KO
- ✅ Salvataggio del Pokémon scartato per il Rivale
- ✅ Cespugli 1-time per giocatore con incontri pesati
- ✅ Mappa principale con 28 nodi cliccabili (Italia stilizzata)

**Da implementare ex-novo (mai fatti, neanche in VBA)**:
- ⏭️ Stati: Confusione, Sonno, Avvelenamento
- ⏭️ Mosse di cura HP a percentuale
- ⏭️ Mossa Suprema (2× danno + autodanno)
- ⏭️ Oggetti (Masterball)
- ⏭️ Pulsante esplicito di switch turno A↔B
- ⏭️ Sound effects e musiche
- ⏭️ Build Tauri per desktop

**Roadmap operativa consigliata** (riformulata):
1. **Fase A — Parità con VBA**: portare in TS tutto ciò che funziona già nel prototipo (priorità ordinata: scena Percorso → Città → Battaglie complete → Deposito → Evoluzione → XP/monete)
2. **Fase B — Estensioni nuove**: Stati, mossa suprema, mosse curative, oggetti
3. **Fase C — Polish**: SFX, animazioni, bilanciamento contenuti
4. **Fase D — Distribuzione**: deploy GitHub Pages + build Tauri desktop

## 💬 Stile delle risposte di Claude Code

- Scrivi in **italiano** (commenti in codice e messaggi all'utente)
- Quando proponi modifiche grosse, **mostra prima un piano** poi applica
- Se devi creare più file insieme, raggruppali in un'unica risposta
- Quando fai refactor, **non rompere l'API pubblica** delle funzioni dell'engine (le scene le importano)
- Dopo ogni modifica significativa, suggerisci di lanciare `npm run dev` e di verificare ad occhio

## 🆘 In caso di dubbio

Se la richiesta è ambigua, chiedi conferma prima di scrivere codice. Meglio una domanda in più che 200 righe da rifare.
