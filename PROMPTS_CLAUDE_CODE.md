# 🎯 Prompt per Claude Code — Arkamon

> Set di prompt copia-incolla per portare avanti Arkamon fase per fase.
> Lanciali in ordine; ognuno presuppone che il precedente sia completato.
> Strategia generale: **portare il VBA esistente in TS** (non reinventare). Il VBA in `old_files/` è quasi completo come gameplay.

---

## 0. Avvio della sessione (sempre)

Quando apri Claude Code nella cartella del progetto, **non serve nessun prompt iniziale**: Claude Code legge automaticamente `CLAUDE.md`.

Per il primo onboarding di Claude Code, però, lancia questo per fargli fare un giro di ricognizione e produrre una mappa del lavoro residuo:

```
Hai appena letto CLAUDE.md. Per favore esegui questa ricognizione:

PARTE A — Codice TypeScript attuale
1. Apri src/types/index.ts e fammi un riassunto delle interfacce esistenti
2. Apri src/engine/battleEngine.ts e dimmi che funzioni espone, quali sono complete e quali sono stub/incomplete
3. Apri src/store/gameStore.ts e mostrami lo shape dello stato e le action esposte
4. Lista le scene presenti in src/scenes/ con una riga di descrizione ciascuna

PARTE B — Codice VBA in old_files/
5. Conferma la presenza di questi file: Mod_Battle_Engine.bas, Mod_Game_Events.bas, Mod_UI_Manager.bas, Mod_ButtonClick_Handlers.bas, Mod_Deposito.bas, Mod_Utilities.bas, Database.xlsx + screenshot .png
6. Per ognuno dei 6 file .bas, produci un sommario di 3-5 righe: subroutine principali esposte, scopo
7. Se è presente Database.xlsx, segnalamelo e dimmi quanto pesa (non aprirlo)

PARTE C — Gap analysis
8. Per ogni voce della "Fase A — Parità con VBA" della roadmap in CLAUDE.md, dimmi:
   - Stato in TS: assente / stub / parziale / completo
   - Funzione VBA corrispondente in old_files/
   - Stima complessità del porting (S/M/L)
9. Suggerisci il prossimo task concreto basandoti sul gap analysis.

Output: un report markdown ben strutturato. Non scrivere codice. Voglio prima un piano consolidato.
```

Salva l'output come `STATO_PROGETTO.md` nella repo: sarà la mappa di riferimento per le sessioni successive.

---

## 1. Estrazione dati dall'Excel → JSON

**Quasi sicuramente questo è già fatto** (la roadmap del README dice "Fase 1 ✅"), ma se così non fosse o se trovi disallineamenti tra `Database.xlsx` e i JSON in `src/data/`:

```
Voglio rigenerare i JSON di gioco dall'Excel old_files/Database.xlsx in modo deterministico.

Procedura:
1. Verifica con `node --version` di avere Node 18+
2. Crea uno script in scripts/excel-to-json.ts che usi la lib "xlsx" (installala come devDependency se manca: npm install -D xlsx tsx)
3. Lo script deve leggere Database.xlsx e produrre questi file in src/data/:
   - pokemon.json   (da foglio Pokemon_Base, 110 record)
   - mosse.json     (da foglio Mosse, ~110 record con scaling lvl 5-100)
   - tipi.json      (da foglio Tipi, matrice 8x8)
   - crescita-hp.json (da foglio Crescita_HP, 4 record)
   - mappe.json     (da foglio Mappe, 28 record)
   - incontri.json  (da foglio Incontri_Selvatici)
   - allenatori.json (dal blocco allenatori sotto Incontri_Selvatici)
4. Mantieni la sintassi camelCase per le chiavi JSON (es. hpBase, livelloEvoluzione, mossa1Id)
5. Aggiungi uno script npm: "data:rebuild": "tsx scripts/excel-to-json.ts"
6. Segnala nel terminale eventuali anomalie: Pokémon senza categoria (Ervys, Xesar, Zoorian), mosse con tutti i danni a 0, riferimenti rotti
7. NON sovrascrivere se trovi già questi file: mostrami prima un diff.

Mostrami lo script prima di eseguirlo.
```

---

## 2. Fase A1 — Parità con VBA: Engine puro

```
Voglio portare in TypeScript le funzioni puramente computazionali dell'engine VBA.

Riferimento: old_files/Mod_Battle_Engine.bas e old_files/Mod_Utilities.bas

Da portare in src/engine/ (con commento "// Porting di: <NomeOriginale>"):

In src/engine/dice.ts:
- rollD6(n: number, rng?: () => number): number  ← LanciaDadi
- roundHalfUp(v: number): number  ← RoundIntHalfUp

In src/engine/types.ts (matrice tipi):
- typeMultiplier(atk: TipoArkamon, def: TipoArkamon): 0.5 | 1 | 2  ← TipoMultiplier

In src/engine/stats.ts:
- calcolaHpMax(idBase: number, livello: number): number  ← CalcolaHPMax
- ottieniParametriMossa(mossaId: number, livello: number): {nome, tipo, numD6, incremento} | null  ← OttieniParametriMossaAlLivello
- clampLivello(lv: number): number  ← ClampLivello

In src/engine/battle.ts:
- determinaPrimoTurno(lvA: number, lvB: number, rng?): "A"|"B"  ← DeterminaPrimoTurno
- calcolaDanno(input: {idBaseAtt, lvAtt, mossaId, idBaseDif, rng?}): {danno, mossaNome, mossaTipo, mult, msgEffetto}  ← parte di CalcolaEApplicaDanno (solo il calcolo, NON l'applicazione)
- scegliMossaIA(idBaseAtt, lvAtt, idBaseDif, rng?): 1|2|3  ← ScegliMossaIA

In src/engine/cattura.ts:
- tentaCattura(input: {tassoCattura, hpAttuali, hpMax, rng?}): {riuscita: boolean, roll: number, soglia: number}  ← parte di EseguiAzioneCattura

In src/engine/incontri.ts:
- pesoCategoria(cat: "Comune"|"Medio"|"Difficile"): 60|30|10  ← PesoCategoria
- scegliIncontroPesato(possibili: Incontro[], rng?): Incontro  ← ScegliIndicePesato

VINCOLI:
- TUTTE le funzioni devono essere PURE (nessun side effect, nessun import dallo store)
- Il parametro rng è opzionale: se mancante usa Math.random; se presente è una funzione () => number per i test
- Mantieni gli stessi numeri della versione VBA (vedi formule in CLAUDE.md)
- TypeScript strict, no any

Procedura:
1. Mostra prima il piano (lista file e firme funzioni) e aspetta il mio ok
2. Implementa tutto in un singolo round di file (puoi creare/modificare più file insieme)
3. Aggiungi un piccolo test manuale alla fine (un file scripts/test-engine.ts che chiama le funzioni con valori noti e stampa i risultati). Lo eseguiamo con tsx per verificare a vista.
```

---

## 3. Fase A2 — Test dell'engine

```
L'engine è portato. Aggiungiamo test automatici.

1. Installa vitest come devDependency: npm install -D vitest
2. Aggiungi a package.json: "test": "vitest run", "test:watch": "vitest"
3. Crea src/engine/__tests__/ con un file per modulo:
   - dice.test.ts  → rollD6 con rng deterministico (mock che restituisce 0.5 → ogni dado dà 4)
   - stats.test.ts → calcolaHpMax per categorie diverse a livelli specifici (5, 10, 50, 100)
   - battle.test.ts → calcolaDanno: caso normale, super efficace (Acqua→Fuoco), poco efficace (Fuoco→Acqua), AI sceglie la mossa migliore tenendo conto di STAB
   - cattura.test.ts → al 100% HP la soglia è bassa, a 1 HP la soglia è ~doppia
   - incontri.test.ts → pesoCategoria restituisce 60/30/10; con rng controllato il pescato è prevedibile

Tutti i test devono passare. Se trovi una funzione che non si presta a essere testata, segnalalo: probabilmente non era pura.

Mostrami i test prima di lanciarli.
```

---

## 4. Fase A3 — Store completo (Zustand)

```
Voglio uno store Zustand che mappi 1:1 lo stato del VBA, persistito in localStorage.

Riferimento: i fogli "Stato_Giocatore", "Battaglia_Corrente", "Giocatore[1|2]_Squadra/Deposito" descritti in CLAUDE.md.

Struttura proposta (in src/store/gameStore.ts):

interface GameState {
  // Stato globale
  giocatori: { 1: Giocatore, 2: Giocatore };
  giocatoreAttivo: 1 | 2;
  rivalePokemonScartato: number | null;  // ID del Pokémon non scelto al laboratorio
  
  // Posizione
  posizioneCorrente: string;  // es. "Venezia", "Percorso_1"
  
  // Cespugli visitati: { [giocatoreId]: { [percorso]: Set<lettera> } }
  cespugliVisitati: Record<1|2, Record<string, string[]>>;
  
  // Battaglia in corso (null se non in battaglia)
  battagliaCorrente: BattagliaCorrente | null;
  
  // Action
  scegliStarter(giocatoreId: 1|2, idBase: number): void;
  cambiaPosizione(luogo: string): void;
  iniziaBattaglia(input: InizioBattaglia): void;
  eseguiAzione(azione: AzioneBattaglia): void;
  terminaBattaglia(esito: 'vittoria'|'sconfitta'|'cattura'): void;
  visitaCespuglio(percorso: string, lettera: string): void;
  scambiaPokemon(istanzaA: number, istanzaB: number): void;
  // ...
}

interface Giocatore {
  id: 1 | 2;
  nome: string;
  squadra: PokemonIstanza[];   // max 6
  deposito: PokemonIstanza[];
  monete: number;
  exp: number;
  badge: number[];
}

interface PokemonIstanza {
  idIstanza: number;     // 1001+ per giocatore 1, 2001+ per giocatore 2
  idBase: number;
  nickname: string;
  livello: number;
  hpMax: number;
  hpAttuali: number;
  exp: number;
}

VINCOLI:
- Persistenza con il middleware persist di Zustand su localStorage (chiave 'arkamon-save-v1')
- Le action chiamano l'engine puro (importato da src/engine/) e applicano il risultato allo stato
- Niente logica complessa nelle action: solo orchestrazione
- Selettori esposti: useGiocatoreAttivo(), useSquadraGiocatore(id), useBattagliaCorrente()

Procedura: piano → ok → implementazione. Segnala se trovi tipi già definiti in src/types/index.ts che dobbiamo riutilizzare invece di duplicare.
```

---

## 5. Fase A4 — Scena Percorso

```
Implementiamo la scena Percorso. Riferimento visivo: lo screenshot Screenshot_9.png in old_files/ (foresta scura con 7 cespugli verdi a forma di cerchi rossi disposti).

Specifiche:
- La scena è il sotto-livello accessibile cliccando un nodo "Percorso_X" sulla MappaPrincipale
- Mostra una vista dall'alto del percorso con SVG/HTML positioned
- 7 cespugli per percorso (etichettati A-G), posizionati in modo coerente con lo screenshot
- Cliccando un cespuglio per la prima volta del giocatore corrente:
  → seleziona un Pokémon usando engine/incontri.scegliIncontroPesato (input: lista da incontri.json filtrata per percorso+lettera)
  → marca il cespuglio come visitato (action visitaCespuglio dello store)
  → lancia battaglia selvatica (action iniziaBattaglia con tipoBattaglia 'selvatico')
- Cespugli già visitati: aspetto disabilitato (grigi/sbiaditi), non cliccabili
- In alto a sinistra: pulsante "← Torna" che riporta alla MappaPrincipale
- In alto a destra: indicatore del giocatore attivo (foto/colore) + monete

Componenti da creare/aggiornare:
- src/scenes/PercorsoScene.tsx
- src/components/Cespuglio.tsx (cerchio cliccabile, stato attivo/visitato)
- src/components/HeaderHUD.tsx (header con giocatore attivo + monete + pulsante torna)

Stile: usa le variabili CSS --arka-* dal index.css. Per ora niente immagini di sfondo: usa un gradient verde scuro con classe Tailwind. Le immagini di sfondo le aggiungiamo in fase di polish.

Procedura: piano (componenti, props, dati) → ok → implementazione in un singolo round.
```

---

## 6. Fase A5 — Battaglia completa (selvatica + NPC + PvP)

Suddividi in 3 prompt separati per ridurre il rischio. Inizia da quello selvatico perché è il più semplice.

### 6.1 Battaglia selvatica completa

```
Completiamo la BattagliaScene per il caso 'selvatico'. Riferimento visivo: Screenshot_11.png, Screenshot_12.png, Screenshot_13.png in old_files/.

Layout (dagli screenshot):
- Sfondo: scena foresta (per ora gradient verde, immagini in fase polish)
- In alto: barra HP del Pokémon avversario con nome e livello, in stile barra rossa
- In alto a destra: sprite del Pokémon avversario (front view), ridimensionato
- Al centro: InfoBox grigio con messaggi narrativi ("Appare X!", "Y usa Z. Danno: 10")
- In basso a sinistra: sprite del Pokémon del giocatore (back view, silhouette se nuovo)
- In basso a destra: barra HP del Pokémon del giocatore con nome, livello, "X/Y" numerico
- In basso al centro: 3 pulsanti mossa (nome + "X dadi +Y" + icona tipo) + 1 pulsante CATTURA
- In alto a sinistra (durante turno avversario): badge "TURNO NEMICO" + pulsante "→ Prosegui"

Flusso:
1. Click su mossa giocatore → engine.calcolaDanno → applica danno → mostra messaggio nell'InfoBox
2. Se HP avversario <= 0 → fine battaglia (vittoria), mostra messaggio + pulsante "PROSEGUI" → eseguiAzione di TerminaBattaglia
3. Altrimenti: turno passa al "B" (avversario). Disabilita pulsanti mosse, mostra "TURNO NEMICO".
4. Avversario sceglie mossa random (selvatico) → applica danno al giocatore → mostra messaggio
5. Se HP giocatore <= 0: se ha altri Pokémon → schermata scambio; altrimenti sconfitta
6. Click CATTURA → engine.tentaCattura → se riuscita aggiunge al team o al deposito (se team pieno) e termina battaglia; se fallita perde il turno

Componenti:
- src/scenes/BattagliaScene.tsx (orchestratore)
- src/components/HpBar.tsx (con numero opzionale, colore dinamico verde→giallo→rosso)
- src/components/InfoBox.tsx (con typewriter effect opzionale)
- src/components/MoveButton.tsx (mossa con dadi + tipo)

VINCOLI:
- Tutta la logica di calcolo passa dall'engine puro (no calcoli inline nel componente)
- L'eseguiAzione dello store gestisce la sequenza di stati (turno A → animazione → turno B → animazione)
- Anima la barra HP che decresce gradualmente (300ms con CSS transition)
- Quando un Pokémon va a 0 HP, l'sprite diventa semi-trasparente prima di sparire

Procedura: piano → ok → implementazione. Concentrati SOLO sul caso selvatico per ora.
```

### 6.2 Battaglia NPC

```
Estendi BattagliaScene per il caso 'allenatore_npc'. Differenze rispetto al selvatico:

1. NESSUN pulsante CATTURA (Pokémon di un allenatore non si catturano)
2. Messaggio iniziale diverso: "Inizia la battaglia contro <NomeAllenatore>!" (vedi Screenshot_11.png)
3. Quando il Pokémon avversario va KO ma l'allenatore ha altri Pokémon: messaggio "<Allenatore> manda in campo <NomePokémon>!" e si continua
4. AI dell'avversario usa engine.scegliMossaIA (non random)
5. Vittoria → +200 monete (capopalestra → +1000); sconfitta → -200 monete
6. Riferimento dati: old_files/Database.xlsx foglio "Allenatori" (struttura: ID, Nome, Luogo, Tipo, Pokémon1_ID, Livello1, ..., Pokémon6_ID, Livello6)

Aggiungi anche il caso 'capopalestra' come variante di NPC con:
- Messaggio iniziale "Capopalestra <Nome> ti sfida!"
- Vittoria → +1000 monete + badge nella squadra del giocatore

Procedura: piano (cosa cambia rispetto al selvatico) → ok → implementazione minimale (riutilizza il più possibile la BattagliaScene esistente).
```

### 6.3 Battaglia PvP

```
Estendi BattagliaScene per il caso 'pvp'. Differenze:

1. NESSUN pulsante CATTURA
2. Layout duale: pulsanti mosse del giocatore B (avversario) visibili in posizione speculare a quelli del giocatore A (es. nella parte alta sopra alla barra HP avversaria)
3. Solo la pulsantiera del giocatore di TURNO è abilitata; l'altra è grigia
4. Nessuna AI: entrambi i giocatori cliccano fisicamente le proprie mosse
5. Lo "scambio Pokémon a HP 0" funziona per entrambi i lati
6. Casi: PvP contro Rivale (su un percorso) o contro Capopalestra (in palestra)

Riferimento dati: gli allenatori PvP hanno tipo "PVP" nel foglio Allenatori (ID 201 Rivale, 203 Capopalestra1).

Procedura: piano → ok → implementazione.
```

---

## 7. Fase A6 — Scena Città e Centro Pokémon

```
Implementiamo la scena Città. Riferimento: la mappa Italia in Screenshot_8.png mostra le città come pallini blu/rosa, ognuna è un nodo cliccabile sulla MappaPrincipale.

Specifiche:
- Una città è un sotto-livello con edifici cliccabili: PALESTRA, CENTRO POKÉMON, NEGOZIO (placeholder), eventuali NPC
- CENTRO POKÉMON: cura tutti i Pokémon della squadra (HP al massimo). Mostra animazione/messaggio breve "I tuoi Pokémon sono pieni di energie!" e un pulsante PROSEGUI.
- PALESTRA: apre PalestraScene con dialogo del Capopalestra → battaglia di tipo PvP (contro un terzo giocatore) o NPC se PvP non disponibile
- NEGOZIO: per ora placeholder con "Coming soon"

Crea:
- src/scenes/CittaScene.tsx (parametrizzato sul nome della città)
- src/scenes/CentroPokemonScene.tsx
- src/scenes/PalestraScene.tsx

Per ora puoi usare una sola scena CittaScene generica con un layout uguale per tutte le città; le differenze (palestra obbligatoria? quale capopalestra?) le leggi dai dati JSON.

Procedura: piano (struttura layout, dati richiesti, transizioni) → ok → implementazione.
```

---

## 8. Fase A7 — Deposito completo

```
Implementiamo la DepositoScene. Riferimento visivo: Screenshot_7.png in old_files/.

Layout (dallo screenshot):
- A sinistra: lista verticale dei 6 Pokémon in squadra, con sprite + nome + livello in una "etichetta nera"
- Al centro/destra: griglia 7x5 (35 slot) di un singolo BOX
- In alto: pulsanti BOX 1 / BOX 2 / BOX 3 con frecce per navigare
- Ogni slot mostra lo sprite del Pokémon (o cerchio grigio vuoto)

Funzionalità:
- Click su Pokémon in squadra → si seleziona (bordo evidenziato)
- Click su slot deposito (vuoto o pieno) → scambia con quello selezionato in squadra
- Click su slot deposito occupato senza selezione attiva → mostra dettagli + opzione "Sposta in squadra" (solo se squadra ha < 6)
- Pulsante CHIUDI in alto a destra → torna alla scena precedente (centro Pokémon)

Vincoli:
- Squadra non può essere vuota (almeno 1 Pokémon attivo)
- Quando si cattura un nuovo Pokémon e la squadra è piena, va automaticamente nel primo slot libero del primo box disponibile (gestito dall'engine cattura, non da qui)

Crea:
- src/scenes/DepositoScene.tsx
- src/components/PokemonCard.tsx (riutilizzabile per squadra e griglia)
- src/components/PokemonSlotVuoto.tsx (cerchio grigio)

Procedura: piano → ok → implementazione.
```

---

## 9. Fase A8 — Evoluzione e Level Up

```
Implementiamo il sistema di evoluzione e il level up.

Riferimento visivo: Screenshot_16.png e Screenshot_17.png in old_files/ (sfondo cielo notturno con cristalli, Pokémon che si trasforma con effetto luminoso).

Riferimento logico: nel VBA le funzioni sono ControllaSeEvolve, GestisciLevelUp, AvviaScenaEvoluzione.

Specifiche:
- A fine battaglia: ogni Pokémon usato guadagna XP (base: 1 per nemico KO; opzionale 2x per cattura)
- Se XP raggiunge la soglia: salita di livello → ricalcolo HP max (engine.calcolaHpMax) → mossa1Id/2/3 aggiornate dai dati base
- Se livello raggiunge il livelloEvoluzione del Pokémon (e Pokémon ha un evoluzioneId): triggera la EvoluzioneScene
- Durante l'evoluzione mostra: "<Nome> si sta evolvendo!" → animazione (per ora un fade) → "<Nome> si è evoluto!" → cambia idBase nella istanza
- Pulsante "Annulla evoluzione" come nei giochi originali (premi B = pulsante apposito)
- Dopo l'evoluzione si torna alla schermata precedente (mappa o continuazione del flusso)

Per la formula XP, propone tu una semplice (es. xp_to_levelup(L) = L * 5) e segnalami se nel VBA c'è qualcosa di diverso che hai trovato.

Crea:
- src/engine/leveling.ts (xpToLevelUp, applyXp, applyLevelUp - puri)
- src/engine/evolution.ts (canEvolve, evolve - puri)
- src/scenes/EvoluzioneScene.tsx
- Integra nel flow di fine battaglia dello store

Procedura: piano → ok → implementazione.
```

---

## 10. Fase B — Estensioni nuove (mai fatte in VBA)

Questi prompt vanno oltre il VBA: introduciamo feature pianificate ma mai realizzate.

### 10.1 Sistema Stati

```
Aggiungiamo gli stati alterati. Specifica originale in CLAUDE.md sezione "Sistemi futuri".

Stati:
- Confusione: dura 2 turni, ogni turno 50% di colpire l'avversario / colpirsi (autodanno = stesso danno della mossa applicato a sé)
- Sonno: dura 3 turni, ogni turno 50% sveglia / turno saltato (no azione possibile)
- Avvelenamento: ogni turno il Pokémon perde 10% degli HP max; curabile solo da una mossa specifica (segnaposto: ID mossa "Antidoto" → da definire)
- Vincolo: Confusione e Sonno mutualmente esclusivi (l'applicazione del secondo annulla il primo)

Crea:
- Aggiungi a PokemonIstanza: stato: { tipo: 'sano'|'confuso'|'addormentato'|'avvelenato', turniRimanenti: number } 
- src/engine/stati.ts: applicaStato, processaInizioTurno (gestisce sonno = skipTurno?, confusione = autodanno?, avvelenamento = HP - 10%), curaStato
- Estendi calcolaDanno per accettare un % di chance di applicare uno stato (le mosse possono avere campo statoApplicato e probStato nel JSON)
- BattagliaScene: indicatore visivo dello stato sopra il Pokémon (icona stilizzata)

Per ora aggiungi i campi opzionali nel JSON delle mosse senza popolarli (default null/0). Il bilanciamento di quali mosse causano cosa lo decideremo dopo.

Procedura: piano → ok → implementazione.
```

### 10.2 Mossa Suprema e Mosse curative

```
Aggiungiamo due categorie speciali di mosse:

1. MOSSE CURATIVE: invece di danno, recuperano HP al lanciatore. Specifica: percentuale degli HP max recuperati (es. 25%, 50%).
   - Estendi il JSON mosse: campo "categoria": 'attacco'|'cura'|'stato'
   - Per cura: campo "percentualeCura": numero (es. 25)
   - Logica: in calcolaDanno, se categoria == 'cura' restituisce un risultato diverso ({tipo: 'cura', hpRecuperati: ...})
   
2. MOSSA SUPREMA: 1 sola per Pokémon, infligge danno doppio MA causa autodanno = 50% degli HP max del lanciatore
   - Campo "suprema": boolean nel JSON mosse
   - Logica: danno *= 2; subito dopo applica autodanno = floor(hpMaxAttaccante / 2)
   - Vincolo UI: il pulsante della mossa suprema ha un colore diverso (rosso) e una conferma "Sei sicuro? Subirai metà dei tuoi HP max"

Crea/modifica:
- src/types/index.ts: aggiungi i campi nuovi
- src/engine/battle.ts: estendi calcolaDanno con i nuovi casi
- src/components/MoveButton.tsx: render diverso per cura (icona +) e suprema (bordo rosso)

Procedura: piano → ok → implementazione.
```

---

## 11. Fase C — Polish

### 11.1 Sprite reali

```
Sostituiamo i placeholder con sprite reali.

Approccio:
- Cartella public/assets/pokemon/<idBase>.png  (front view) e public/assets/pokemon/<idBase>_back.png (back view)
- src/components/PokemonSprite.tsx: prop {idBase, view: 'front'|'back', size?}
- Fallback: se lo sprite non esiste, mostra un cerchio grigio con il nome
- In battaglia: avversario = front view (alto-destra); proprio Pokémon = back view (basso-sinistra)
- Negli screenshot del prototipo (Screenshot_18.png, ecc.) le silhouette nere indicano "Pokémon mai catturato" → aggiungi una variante "silhouette" (filtro CSS brightness 0)

Per ora aggiungi solo l'infrastruttura, NON popolare tutti i 110 sprite. Mostra il sistema funzionante con 2-3 Pokémon di test e il fallback per gli altri.

Procedura: piano → ok → implementazione.
```

### 11.2 Audio

```
Aggiungiamo un SoundManager.

Crea src/audio/SoundManager.ts con:
- Singleton class SoundManager
- preload(name, url): carica un file audio
- play(name, volume?): riproduce
- stopAll(), mute(), unmute(), setMasterVolume()
- Gestisce browser policy: il primo play deve essere triggerato da un click (per autoplay)

Eventi sonori:
- 'click': click menu generico
- 'battle-start': inizio battaglia
- 'attack-hit': colpo a segno
- 'super-effective': super efficace
- 'ko': Pokémon KO
- 'capture-success': cattura riuscita
- 'capture-fail': cattura fallita
- 'victory': fanfara vittoria
- 'level-up': salita di livello
- 'evolution': evoluzione

File audio: public/assets/audio/<name>.mp3 (per ora possono essere file vuoti o royalty-free presi da freesound.org).

Aggiungi un toggle muto persistito (Zustand) e un'icona altoparlante in alto a destra di ogni scena.

Procedura: piano → ok → implementazione.
```

---

## 12. Fase D — Distribuzione

### 12.1 GitHub Pages

```
Configuriamo il deploy automatico su GitHub Pages.

1. In vite.config.ts: imposta `base: '/Arkamon-Beta/'` (o il nome esatto della repo)
2. Crea .github/workflows/deploy.yml con:
   - trigger: push su main
   - build: npm ci && npm run build
   - deploy: usa actions/deploy-pages@v4 e actions/upload-pages-artifact@v3
3. Verifica che le immagini in public/assets/ siano referenziate con path relativi che rispettano la base
4. Aggiungi un badge nel README con il link al sito deployato

Mostrami il workflow YAML prima di applicare.
```

### 12.2 Tauri (desktop)

```
Configuriamo Tauri 2.x per produrre un eseguibile desktop nativo.

1. Installa @tauri-apps/cli e @tauri-apps/api come dipendenze
2. tauri init con: app name "Arkamon", window title "Arkamon", dist dir "../dist", dev path "http://localhost:3000"
3. In tauri.conf.json: window 1280x720 minimo, resizable, fullscreen toggleable
4. Aggiorna .gitignore per ignorare src-tauri/target
5. Aggiungi script npm: "tauri:dev", "tauri:build"
6. Verifica che npm run tauri:build produca un installer .msi (Windows) o .dmg (Mac) o .AppImage (Linux)

Mostrami il diff di tauri.conf.json e package.json prima di applicare.
```

---

## 🛠️ Prompt di manutenzione utili

### Porting VBA → TypeScript (riusabile)
```
Voglio portare la logica di <NomeSubroutineVBA> da old_files/<File>.bas a TypeScript.

Procedura:
1. Apri il file VBA e identifica la subroutine/funzione richiesta. Riportami la firma originale e una traduzione del comportamento in 5-10 righe in italiano (non codice).
2. Identifica le dipendenze: altre subroutine VBA chiamate, variabili globali lette/scritte, fogli Excel consultati. Elencale.
3. Proponi dove collocare la versione TS: in src/engine/<file>.ts (se logica pura) o in src/store/gameStore.ts (se modifica stato). Motiva.
4. Mostra il diff prima di applicare.
5. Aggiungi sopra la funzione TS un commento `// Porting di: <NomeOriginale> da old_files/<File>.bas`
6. Se la versione TS deve divergere dalla VBA per un buon motivo (bug, bilanciamento), evidenzialo nel commento.

NON copiare ciecamente la sintassi VBA: TypeScript ha primitive diverse (Array.map invece di For Each, ecc.). Idiomatico vince su letterale.
```

### Refactor
```
Hai introdotto duplicazione tra <FileA> e <FileB>. Estrai il codice comune in un helper in src/engine/ o src/components/ a seconda del tipo. Mantieni l'API esterna invariata.
```

### Bug
```
Sto vedendo questo bug: <descrizione>. Apri i file rilevanti, formula 2-3 ipotesi sulla causa con un livello di confidenza, poi proponi la fix. Non patchare alla cieca.
```

### Test rapido
```
Aggiungi un test in src/engine/__tests__/<nome>.test.ts per la funzione <X>. Usa vitest. Se vitest non è installato, mostrami il comando di installazione prima di scrivere il test.
```

### Performance
```
La scena <X> ri-renderizza troppo spesso. Identifica i selettori Zustand e i useEffect colpevoli. Proponi memo / selettori più stretti, senza cambiare il comportamento.
```

### Verifica parità VBA
```
Sto facendo una verifica di parità tra il VBA e l'implementazione TS. Per la funzione <X>:
1. Apri old_files/<File>.bas e copia (in un commento markdown, NON nel codice) la subroutine originale
2. Apri la sua controparte TS e copiala accanto
3. Per ogni riga della VBA, segna con ✅ se ha equivalente in TS, ⚠️ se è stata cambiata, ❌ se manca
4. Concludi con una valutazione: parità completa / parità con divergenze giustificate / parità incompleta (con lista delle cose mancanti)

Output: un report markdown senza modifiche al codice.
```

---

## 📌 Suggerimenti pratici per usare Claude Code

1. **Sessione corta = qualità alta**: chiudi la sessione e riaprila quando cambi argomento. Il contesto resta più pulito.
2. **Lascia fare il giro di ricognizione**: il primo prompt di ogni sessione dovrebbe essere "leggi questi 3 file e riassumimi". Eviti che inventi.
3. **Pretendi il piano prima del codice**: per feature > 50 righe, chiedi sempre il piano prima.
4. **Versiona prima di modificare grossi pezzi**: `git commit` prima di lasciare a Claude un task ampio. Se va male, `git reset --hard`.
5. **Branch dedicato per esperimenti**: `git checkout -b prova-feature-X` → se non ti piace, `git checkout main` e basta.
6. **Aggiorna `STATO_PROGETTO.md`**: ogni 2-3 sessioni, lancia di nuovo il prompt di onboarding e sovrascrivi `STATO_PROGETTO.md`. È la tua bussola.
7. **Quando stai per cambiare logica del VBA, fermati**: chiedi all'utente "questa formula nel VBA fa X, vuoi che mantenga X o aggiorni a Y?". L'utente ha pensieri di game design che il codice non comunica.
