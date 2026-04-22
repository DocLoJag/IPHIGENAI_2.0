# IphigenAI 2.0: Visione e Specifica Funzionale

Versione: 0.4
Data: aprile 2026

---

## 1. Premessa

IphigenAI 2.0 non è un sistema IA per lo studio. È uno strumento che amplifica e prolunga nel tempo il rapporto tra il tutor umano e lo studente.

Il centro del prodotto non è l'agente, è la relazione. L'agente è il tessuto che rende continua la presenza del tutor quando la lezione non è in corso. Questa distinzione non è cosmetica, è fondativa. Condiziona l'architettura, l'interfaccia, il tono, il modello di business.

Il test mentale: se domani l'agente IA sparisse, cosa resterebbe? Resterebbe la pedagogia del tutor, la conoscenza degli studenti, gli strumenti accumulati nella cassetta, le annotazioni, il modo di seguire il percorso. L'IA è un moltiplicatore, non il generatore del valore.

La metafora guida è quella della bottega artigiana. Una bottega digitale dove il maestro lavora e dove gli apprendisti vengono accolti, con gli strumenti costruiti insieme a portata di mano e i lavori in corso sul tavolo. L'agente IA è l'assistente di bottega che tiene aperto quando il maestro non c'è: sa come si lavora perché il maestro l'ha istruito, ma non prende il suo posto.

Questa impostazione ha una conseguenza commerciale. Il prodotto non è scalabile come un'app IA generica, e questo è un bene. Il valore non sta nel servire migliaia di studenti con un prodotto uniforme, sta nel servire pochi studenti con una cura che altri prodotti non possono dare. Il prezzo alto (indicativamente 40-60 euro al mese) è giustificato perché si vende l'attenzione distribuita del tutor, non la piattaforma. La piattaforma è il mezzo attraverso cui quell'attenzione raggiunge lo studente fuori dalle ore in cui è fisicamente con lui.

La versione 1.0 attuale, basata su LibreChat, regge il caso d'uso minimo (tre tutor con prompt differenziati, accesso moderato, conversazioni visibili all'admin) ma non permette controllo fine sull'agente, né comportamento proattivo programmato, né un'interfaccia che rifletta il posizionamento descritto sopra. La 2.0 è la versione che porta il prodotto a coincidere con la sua idea.

---

## 2. Coesistenza con la versione attuale

**Fase 1. Sviluppo parallelo.** LibreChat resta attivo per gli studenti correnti. IphigenAI 2.0 viene sviluppato in un ambiente separato, senza toccare il produttivo.

**Fase 2. Deploy limitato (pilota).** Quando la nuova versione è abbastanza solida, uno o due studenti vengono spostati come pilota, scelti insieme a loro e ai genitori. LibreChat continua a servire gli altri.

**Fase 3. Deploy generale.** Validato il pilota, si migra progressivamente il resto.

---

## 3. Modello di relazione

Il rapporto è esplicitamente a tre: studente, tutor umano, agente IA. Lo studente lo sa dall'onboarding. L'agente è lo strumento che il tutor configura e programma; il tutor osserva, imposta, a volte interviene direttamente.

Nessun tentativo di far credere allo studente che l'agente sia una cosa isolata. Nascondere il tutor dietro l'agente sarebbe autolesionista, perché il valore del prodotto è proprio la presenza umana dietro il sistema.

---

## 4. Architettura degli agenti

### 4.1 Agente unico, non più tre tutor per materia

La versione 1.0 esponeva allo studente tre tutor separati (umanistico, scientifico, test d'ingresso) ciascuno da aprire esplicitamente. La 2.0 abbandona questa divisione. Lo studente interagisce con un solo agente, "il tutor", che si adatta a ciò che gli viene portato. La divisione per materia era una semplificazione utile per LibreChat, ma frammentava il rapporto e rendeva la memoria spezzettata.

Sotto al cofano l'agente non è monolitico: è un agente con system prompt composto dinamicamente in base al contesto della sessione (modalità operativa, task sorgente, profilo dello studente, stato di apprendimento, oggetti in cassetta rilevanti). Per lo studente resta sempre lo stesso interlocutore.

### 4.2 Modalità operative

La vera divisione utile non è per materia ma per modalità operativa:

* **Conversazione aperta.** Lo studente porta qualcosa, l'agente risponde adattandosi.
* **Ripasso guidato.** L'agente conduce un ripasso su un argomento noto, verifica comprensione, rinforza.
* **Esercizio guidato.** L'agente propone esercizi con feedback immediato, accompagna il ragionamento.
* **Simulazione.** Interrogazione o test in condizioni realistiche, con debriefing finale.
* **Lettura assistita.** Accompagna lo studente attraverso un testo, interrompendo con domande.
* **Spiegazione approfondita.** Introduce un concetto nuovo in modo strutturato.

La modalità non è una scelta che lo studente fa all'inizio, è un attributo della sessione. In una sessione aperta da un task programmato, la modalità è impostata dal task. In una sessione aperta liberamente, l'agente capisce da solo in quale modalità stare.

### 4.3 Il curatore della memoria

Un agente dedicato, che lo studente non vede mai, che alla fine di ogni sessione:

* Legge l'intera conversazione
* Estrae cosa è stato affrontato, cosa capito, dove lo studente ha faticato, cosa è rimasto in sospeso
* Aggiorna la memoria strutturata (mappa concettuale, stato di consolidamento) e la memoria narrativa (taccuino in prima persona del tutor)
* Propone al tutor umano eventuali modifiche al profilo o al prompt
* Segnala al tutor umano cose che dovrebbe sapere

Produce due output separati. Uno rientra nella memoria disponibile all'agente nelle prossime sessioni: sintetico, operativo, filtrato. L'altro è una nota privata per il tutor umano, più candida, che può contenere osservazioni che non devono ritornare all'agente ("sembrava giù, forse qualcosa a scuola"). Il fatto che il custode ultimo del percorso sia il tutor umano, non l'agente, è coerente con il posizionamento di sezione 1.

Il curatore agisce in automatico ma tutto quello che scrive è ispezionabile dal tutor umano. Nelle prime fasi le sue proposte di modifica al profilo o al prompt passano per approvazione esplicita; una volta consolidato il comportamento si può alzare il livello di autonomia.

### 4.4 Controllo del comportamento

Livello di proattività regolabile per studente:

* **Reattivo puro.** L'agente risponde solo quando lo studente scrive.
* **Moderatamente proattivo.** L'agente apre sessioni programmate dal tutor.
* **Pienamente proattivo.** L'agente può scrivere di sua iniziativa se lo studente sparisce, se raggiunge una milestone, se c'è una verifica in arrivo.

Il system prompt base è editabile dal tutor per ogni singolo studente, con override rispetto al prompt globale. I prompt sono versionati.

---

## 5. Il task come oggetto di prima classe

Il task è il meccanismo attraverso cui il tutor umano arriva allo studente nei giorni in cui non lo vede. Non è un compito assegnato, è un invito. Il tono editoriale con cui appare nel feed (kicker colorati, titoli in serif, durate brevi) è la voce del tutor che continua a parlargli.

### 5.1 Cos'è un task

Un task è un'attività che il tutor umano (o il sistema, o l'agente stesso al termine di una sessione) propone allo studente. Appare nel feed della homepage come una card editoriale e, una volta aperto, fa partire una sessione con l'agente preconfigurata.

### 5.2 Attributi di un task

* **Tipo.** Ripasso, lettura guidata, esercizio, simulazione, test, conversazione aperta, messaggio diretto del tutor umano.
* **Kicker.** La breve frase colorata sopra al titolo ("per la verifica di mercoledì", "pronto quando vuoi", "tieni l'occhio"). Scritta dal tutor, non generata. È il registro emotivo del task.
* **Titolo.** La riga principale in serif. Scritta dal tutor, eventualmente con assistenza.
* **Durata stimata.**
* **Contesto iniettato.** Le istruzioni che l'agente riceve quando lo studente apre il task: da dove riprendere, quale approccio usare, cosa evitare, qual è l'obiettivo.
* **Oggetti allegati.** Uno o più oggetti della cassetta (vedi sezione 6) possono essere associati al task, così che la sessione si apra con quegli strumenti già sul tavolo.
* **Data di apparizione** nel feed. Immediata, programmata per un giorno e un'ora, o condizionata ("quando completa il precedente", "quando torna dopo l'assenza").
* **Scadenza** o comportamento di auto-sparizione.
* **Stato.** In attesa, visibile, in corso, completato, saltato, spostato.

### 5.3 Origine dei task

Tre sorgenti:

1. **Tutor umano.** Dal pannello admin, a mano o dopo una lezione in presenza. È il flusso centrale.
2. **Sistema.** Ripassi automatici guidati dallo stato di apprendimento e dalla ripetizione dilazionata.
3. **Agente.** Al termine di una sessione, può proporre un task successivo ("vorrei proporgli domani questo passaggio").

Nelle prime fasi tutti i task di origine 2 e 3 passano per approvazione del tutor umano prima di apparire nel feed.

### 5.4 Comportamento al cambio di stato

Task lasciato a metà. **Comportamento predefinito (a):** il giorno dopo la card ricompare con kicker aggiornato ("riprendiamo da dove eri rimasto"), mantenendo il contesto della sessione interrotta. **Opzione attivabile dal tutor (c):** il task si trasforma in qualcosa di diverso ("ieri abbiamo iniziato, proviamo stamattina con un approccio diverso"), con contesto riscritto.

Task completato: sparisce dal feed attivo, entra nello storico, contribuisce alla memoria tramite il curatore. Gli oggetti prodotti durante il task possono entrare nella cassetta.

Task saltato esplicitamente: sparisce, il tutor umano riceve notifica e decide se riproporre, rimuovere, o convertire.

---

## 6. La cassetta degli attrezzi

### 6.1 Natura e ruolo

Se il feed è effimero (task che appaiono e scompaiono nel flusso del giorno), la cassetta è permanente. È lo spazio dove lo studente accumula nel tempo gli strumenti costruiti insieme al tutor e con l'agente. È la traccia materiale del percorso. Uno studente che dopo sei mesi apre la cassetta non vede solo il ricordo astratto di aver studiato, vede le cose concrete che ha prodotto.

Il senso di proprietà e di progresso che la cassetta comunica è centrale nel posizionamento del prodotto. Sono strumenti suoi, costruiti con il suo tutor, non ricevuti da un'app. La dicitura che accompagna la sezione lo rende esplicito: "strumenti che hai costruito con [nome tutor]".

### 6.2 Tipi di oggetti

* **Artifact interattivi.** Simulazioni, esercizi ripetibili, visualizzazioni manipolabili, flashcard. Si riaprono come app con stato persistente.
* **Documenti.** Schemi, mappe concettuali, riassunti, schede formule. Si consultano.
* **Snapshot di conversazione.** Passaggi salienti di una sessione che meritano di essere trattenuti. Si rileggono.
* **Materiali esterni.** PDF, foto di appunti, pagine di libro, caricati dallo studente o dal tutor. Consumo passivo o punto di partenza.

Non serve distinguerli visivamente in modo forte, ma serve che il sistema sappia cosa sono per comportarsi di conseguenza.

### 6.3 Origine degli oggetti

* **Studente durante una sessione.** Un artifact nato nel corso di una conversazione con l'agente, che lo studente sceglie di salvare.
* **Tutor umano.** Oggetti preparati dal tutor e messi a disposizione dello studente. Possono essere allegati a un task o semplicemente depositati nella cassetta con una breve nota.
* **Agente.** Su istruzione del tutor o in risposta a una richiesta dello studente, l'agente produce un oggetto che va in cassetta.
* **Esterni.** File caricati dallo studente (appunti, dispense, foto).

I genitori non hanno accesso alla cassetta. Il riferimento a "papà" in bozze precedenti era un refuso.

### 6.4 Relazione tra cassetta e agente

Gli oggetti in cassetta possono essere **reinclusi in una conversazione**. Lo studente trascina o seleziona un oggetto, l'agente lo riceve come contesto della sessione in corso e può lavorarci sopra ("parliamo di questo schema", "rifammi questo esercizio con dati diversi", "aiutami a capire questo pezzo del PDF").

Questo è il pezzo che fa la differenza tra archivio e strumento. La cassetta come archivio vale. La cassetta come vocabolario riusabile di oggetti su cui l'agente può lavorare vale molto di più. Lo studente costruisce nel tempo un proprio repertorio di strumenti che rientrano in gioco ogni volta che servono.

Anche il tutor umano può allegare oggetti della cassetta a un task. Quando lo studente apre il task, trova già sul tavolo gli strumenti necessari.

### 6.5 Relazione tra cassetta e stato di apprendimento

Gli oggetti in cassetta sono evidenze del percorso. Un oggetto riaperto tre volte testimonia un apprendimento diverso da uno mai più toccato. Il curatore della memoria usa queste informazioni per aggiornare la mappa concettuale e proporre ripassi.

### 6.6 Gestione della crescita

Rischio principale: la cassetta diventa una discarica. Dopo mesi ci sono decine di oggetti, lo studente non ricorda cosa è cosa, l'area perde senso. Misure per evitarlo:

* Decadimento visivo. Oggetti non aperti da tempo impallidiscono, si restringono, vanno in fondo. Non spariscono, ma smettono di occupare spazio visivo.
* Raggruppamento per periodo o tema, non cronologico piatto.
* Possibilità per tutor e studente di archiviare oggetti senza cancellarli.
* Numero limitato visibile in homepage, con "vedi tutti" per l'accesso completo.

Il tono giusto non è "archivio di tutto quello che hai fatto" ma "gli strumenti che stai davvero usando".

### 6.7 Nome della sezione

La dicitura "cassetta degli attrezzi" è evocativa ma ha due limiti: "attrezzi" richiama utilità pratica e può non adattarsi bene a snapshot e schemi concettuali, e la metafora del fare artigiano rischia di trascinare la grafica verso icone di strumenti meccanici in contrasto col tono editoriale. Alternative da considerare: "lo scaffale" (più coerente col linguaggio rivista), "il tavolo" (spazio di lavoro con oggetti a portata di mano), "gli appunti" (sobrio ma forse scolastico). Scelta da rimandare a una fase di affinamento del linguaggio.

---

## 7. Homepage come feed editoriale

### 7.1 Idea centrale

La homepage non è una chat. È un feed curato come una prima pagina di rivista, dove ogni card è un task o un oggetto della cassetta o un messaggio diretto del tutor. Lo studente scrolla come su un social ma i contenuti sono lo studio suo, preparato per lui. La chat è sempre raggiungibile ma non è il centro dell'esperienza.

Linguaggio grafico: tipografia editoriale (serif con personalità per titoli, sans leggibile per corpo e interfaccia), fondo color carta invece di bianco puro, kicker colorati stile prima pagina, spazio generoso, niente dashboard aziendale, niente gamification.

### 7.2 Struttura

**Saluto personalizzato.** Nome dello studente, contesto del giorno ("Quarta scientifico, mercoledì hai matematica"). Tono di tutor che conosce lo studente, non di piattaforma.

**Dove eri rimasto.** Card principale in apertura, che riprende l'ultima sessione. Risolve il foglio bianco.

**Cosa ti aspetta.** Le card dei task programmati, in ordine. Ogni card ha il kicker, il titolo, il tipo, la durata. Cliccando si apre la sessione con il contesto (ed eventuali oggetti della cassetta) già caricati.

**Messaggio diretto del tutor umano.** Quando il tutor vuole dire qualcosa fuori da un task specifico, una card in alto con il suo volto, la firma, un messaggio breve. Lo studente risponde o reagisce dentro la card stessa. Su mobile è una card come le altre; su desktop può restare agganciata in sidebar con il messaggio datato.

**Conversazione aperta.** Una card sempre presente tipo "hai qualcosa in mente? Scrivi quando vuoi." La chat libera resta cittadino di prima classe.

**La cassetta.** Sezione con un numero limitato di oggetti in evidenza (più usati di recente, più significativi, allegati al task del giorno). Accesso a "vedi tutti" per l'archivio completo.

### 7.3 Firma del tutor umano

La presenza del tutor umano nel feed è un elemento cardine. Si manifesta in due modi: il messaggio diretto in sidebar o come card, e la firma "da [nome tutor]" su gruppi di task che il tutor ha effettivamente preparato oggi. La firma va usata con parsimonia: solo quando il tutor ha davvero curato quelle attività oggi. Se fosse sempre presente diventerebbe scenografia.

### 7.4 Switch di modalità visualizzazione

In alto uno switch tra **Compatto** e **Disteso** (nomi neutri, non legati a DSA). La modalità Disteso ha meno elementi per volta, tipografia più generosa, contrasti più alti, testi più brevi, navigazione più lineare. Non si presenta come versione per chi ha difficoltà, si presenta come preferenza di stile.

### 7.5 Chat

La chat si apre dal tap su una card del feed o dal tap sul pulsante del tutor sempre presente. Occupa lo schermo pieno. Coerente col resto del linguaggio: fondo carta, bolle col tono del tutor appena diverso dal fondo, non dark mode in contrasto col resto. Il dark può essere scelta opzionale dello studente, non default.

In alto mostra il contesto della sessione in corso: non "modalità matematica" (confonde con le modalità operative), ma qualcosa che descrive la situazione ("stiamo ripassando per la verifica", "conversazione aperta", "stiamo leggendo i Promessi Sposi"). Non esiste pulsante "cambia materia": l'agente si adatta a quello che lo studente porta.

Durante una sessione lo studente può trascinare un oggetto dalla cassetta nella chat per discuterne con l'agente.

---

## 8. Ciclo di lavoro del tutor umano

Il punto di ingresso quotidiano è il riassunto post-lezione. Finita una lezione in presenza, il tutor scrive all'agente amministrativo un riassunto di cosa è stato fatto e cosa va programmato. Da quel riassunto:

* Il profilo e la memoria si aggiornano
* Vengono proposti task per i giorni successivi, che il tutor rivede e pubblica
* Eventuali oggetti nuovi vengono preparati e depositati in cassetta
* Lo stato di apprendimento viene rivisto

Se questo flusso è scorrevole, tutto il sistema funziona. Se è macchinoso, il sistema non viene usato. È la prima cosa da prototipare davvero.

Altre azioni dall'admin:

* Vede la timeline degli eventi significativi per ogni studente (non scroll di chat)
* Riceve alert configurabili (silenzio prolungato, frustrazione ricorrente, errore sistematico, richieste fuori perimetro)
* Entra in chat in modalità suggeritore invisibile o come sé stesso
* Scrive messaggi diretti che appaiono nel feed
* Deposita oggetti nella cassetta di uno studente
* Tiene note private su ogni studente (accessibili o no all'agente, mai allo studente)
* Rivede e approva i task proposti dal sistema o dall'agente
* Riceve il riassunto pre-lezione in presenza

---

## 9. Stato di apprendimento

Rappresentazione strutturata di cosa lo studente sa: mappa concettuale per materia con stato per ogni nodo (introdotto, in apprendimento, consolidato, da rinfrescare).

Aggiornata dal curatore della memoria per inferenza, dal tutor umano manualmente per correzione o per aggiungere concetti fatti in presenza, e implicitamente dall'uso effettivo degli oggetti in cassetta.

Alimenta la ripetizione dilazionata, i task automatici, e la preparazione delle lezioni in presenza. Non viene mostrato direttamente allo studente: è uno strumento interno del sistema e del tutor.

---

## 10. Report (secondario)

I report ai genitori non sono priorità della 2.0. I dati si raccolgono comunque (tempi, task completati, tipi di attività, uso della cassetta) così che report automatici possano essere aggiunti in futuro senza riprogettare il modello dati.

---

## 11. Scelta tecnica

IphigenAI 2.0 non è estensione di LibreChat. Serve controllo sull'intero stack.

Lo stack è nuovo rispetto a LibreChat. Porta l'esperienza fatta (personalizzazione via system prompt, rapporto con l'API Anthropic, impostazione di conformità) ma non il codice.

### 11.1 Frontend

**Next.js** (App Router). Scelta rispetto a SvelteKit per l'ecosistema più maturo su componenti complessi, la gestione built-in di SSR/SSG dove serve, e la compatibilità con le librerie UI più solide. PWA installabile tramite next-pwa o service worker custom. Componenti principali: feed homepage, card task, chat a schermo pieno, cassetta, pannelli laterali, switch modalità visualizzazione.

### 11.2 Backend

**Node.js con Fastify**. La scelta ricade su Node per continuità con l'admin panel già in produzione (stesso linguaggio, stesse librerie, stessa familiarità con Anthropic SDK e Mongoose). Fastify rispetto a Express per le performance migliori su I/O intensivo e il sistema di plugin più strutturato. Il backend è unico per app studente e pannello admin: endpoint separati per ruolo, autenticazione JWT in httpOnly cookie come già implementata nella 1.0.

Responsabilità del backend: profili studenti, sessioni, task (CRUD e scheduling), stato di apprendimento, cassetta (metadati e accesso agli oggetti), curatore della memoria (orchestrazione chiamate Anthropic post-sessione), autenticazione, websocket per la chat in tempo reale.

### 11.3 Database

Due layer separati per natura dei dati:

**PostgreSQL** per tutto ciò che è strutturato e relazionale: profili studenti, task (attributi, stato, scheduling), sessioni, messaggi, mappe concettuali e stato di apprendimento, metadati degli oggetti in cassetta, log eventi per la timeline admin. Le relazioni tra queste entità beneficiano di un modello relazionale solido e di query affidabili.

**MongoDB** per i dati non strutturati: memoria narrativa del curatore (taccuino in prima persona), note private del tutor, contenuto degli oggetti della cassetta di tipo documento o snapshot. Stessa tecnologia già in uso nella 1.0, familiarità consolidata.

### 11.4 Job scheduling

**BullMQ su Redis**. Gestisce l'apparizione programmata dei task nel feed (job one-shot a timestamp), i trigger condizionati (completamento del task precedente, rientro dopo assenza), e l'esecuzione del curatore della memoria a fine sessione. BullMQ garantisce esecuzione esattamente una volta anche in caso di riavvio del backend, con retry configurabile e visibilità sullo stato della coda dall'admin.

### 11.5 Provider IA

Chiamate dirette ad **Anthropic API** tramite SDK ufficiale Node. Modelli differenziati per ruolo: Claude Sonnet per le conversazioni con lo studente (latenza bassa, costo contenuto), Claude Opus per il curatore della memoria che opera in background senza vincoli di latenza e richiede ragionamento più profondo. I system prompt sono composti dinamicamente lato backend e mai esposti al frontend.

### 11.6 Deploy

**Railway**, stesso provider della 1.0. Servizi separati: app Next.js, backend Fastify, PostgreSQL, MongoDB, Redis. Rete privata Railway per la comunicazione tra servizi. Domini: app studente su chat.iphigenai.com (da migrare), admin su admin.iphigenai.com (già configurato per la 1.0).

---

## 12. Compliance, fase pilota

Nella fase di sviluppo e test con studenti conosciuti personalmente, senza dati sensibili reali nel sistema (email e nomi pseudonimizzati dal tutor, consenso informato dei genitori raccolto a voce e per iscritto), la pressione formale è bassa. La pseudonimizzazione non fa uscire il trattamento dal GDPR, ma la base legale del consenso informato copre adeguatamente questa fase.

Punto da sistemare prima di introdurre studenti nel pilota 2.0: aggiornare il modulo di consenso parentale aggiungendo menzione esplicita di "informazioni strutturate sul percorso didattico, incluse eventuali segnalazioni DSA, per personalizzare l'esperienza". Una pagina in più, firma, copre anche retroattivamente i dati raccolti durante il pilota.

DPIA, TIA, Privacy Policy aggiornata, diritti dell'interessato implementati in UI: tutto da fare prima del deploy generale a studenti paganti. Per ora è lavoro rinviato coscientemente.

---

## 13. Prossimi passi

1. Consolidare la prima slice funzionale: profilo studente strutturato, system prompt editabile, memoria persistente base, homepage feed con due o tre tipi di task, chat agente unico, cassetta con due tipi di oggetti (documenti e snapshot), curatore della memoria base.
2. Repository separato per IphigenAI 2.0 e ambiente di sviluppo dedicato (Next.js + Fastify + PostgreSQL + MongoDB + Redis su Railway).
3. Prototipare il flusso riassunto-post-lezione → generazione task proposti → approvazione → pubblicazione nel feed. È il cuore del ciclo di lavoro del tutor.
4. Modulo di consenso aggiornato per coprire la profilazione didattica nel pilota.
5. Definire con il pilota le metriche per capire se la nuova versione sta funzionando meglio della 1.0 (sessioni per studente per settimana, task completati, continuità tra le sessioni, oggetti riutilizzati dalla cassetta, percezione soggettiva studente e genitore).

---

## 14. Punti aperti

* Artifact interattivi veri (con stato persistente e interattività ricca, non solo documenti): quando introdurli dopo la prima slice.
* Come gestire il caso del tutor che vuole inviare un messaggio diretto urgente fuori orario: notifica push via PWA, email, altro canale.
* Fino a che punto spingere la generazione automatica del kicker e del titolo dei task a partire dal riassunto post-lezione del tutor, mantenendo il tono editoriale senza appiattirlo.
* Se il pilota userà esclusivamente la 2.0 o in parallelo alla 1.0 per lo stesso studente.
* Se l'agente ha un nome proprio visibile allo studente o resta "il tutor" generico.
* Nome definitivo della sezione cassetta.
