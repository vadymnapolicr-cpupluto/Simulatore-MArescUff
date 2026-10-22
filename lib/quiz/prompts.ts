import type { AiSettings } from "./types"

export const DEFAULT_EXTRACT_PROMPT = `Sei un assistente che estrae domande a risposta multipla da libretti di quiz del concorso Allievi Marescialli della Guardia di Finanza.
Struttura tipica del libretto: pagine orizzontali, ogni domanda inizia con il numero "N)", il testo è nella colonna di sinistra e le 4 risposte a), b), c), d) sono in 4 colonne affiancate. Nel margine sinistro può esserci un QR code: IGNORALO. Intestazione e piè di pagina ("LIBRETTO TIPO", "Pagina X di Y") vanno ignorati.
Regole:
- Estrai TUTTE le domande delle pagine ricevute, nell'ordine, con il loro numero originale.
- Riporta testo e risposte fedelmente (senza numero e senza lettere a), b)...). Unisci le righe spezzate.
- materia: logica (logica, matematica, ragionamento, figure, tabelle), italiano, storia, civica (Costituzione, diritto, UE, Agenda 2030), inglese, informatica.
- difficolta: "difficile" se richiede calcolo o ragionamento in più passaggi, altrimenti "facile".
- corretta: lettera della risposta esatta. Il libretto NON riporta le soluzioni: risolvi tu la domanda con attenzione. Se non sei sicuro scrivi comunque la più probabile.
- pagina: numero della pagina DENTRO il blocco ricevuto (1 = prima pagina del blocco).
- figura: se la domanda contiene una figura, tabella o immagine (non il QR code) restituisci il riquadro [ymin, xmin, ymax, xmax] normalizzato 0-1000 rispetto alla pagina, altrimenti null.
- Se una domanda è troncata a fine blocco e mancano le risposte, ignorala.`

export const DEFAULT_SOLVE_PROMPT = `Sei un esperto preparatore per il concorso Allievi Marescialli della Guardia di Finanza.
Ricevi un blocco di domande a risposta multipla già estratte (testo e opzioni A, B, C, D) ed eventualmente l'immagine della figura/tabella collegata.
Per OGNI domanda:
- Risolvi con attenzione, ragionando passo passo prima di scegliere (per logica e matematica verifica i calcoli).
- corretta: la lettera dell'unica risposta esatta. Attenzione alle domande con "non è corretta" o "non contiene".
- materia: logica, italiano, storia, civica, inglese, informatica.
- difficolta: "difficile" se richiede calcolo o più passaggi, altrimenti "facile".
- argomento: 2-4 parole.
- spiegazione: 1-3 frasi in italiano che giustificano la risposta.
- Se la domanda cita una figura che non vedi, indica nella spiegazione "FIGURA MANCANTE" e scegli la più probabile.
Restituisci una voce per ogni id ricevuto, usando lo stesso id.`

export const MODEL_SUGGESTIONS = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-pro-latest",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
]

export const DEFAULT_SETTINGS: AiSettings = {
  apiKey: "",
  model: "gemini-flash-latest",
  pagesPerChunk: 2,
  solveBlockSize: 10,
  delayMs: 1500,
  maxRetries: 2,
  extractPrompt: DEFAULT_EXTRACT_PROMPT,
  solvePrompt: DEFAULT_SOLVE_PROMPT,
}
