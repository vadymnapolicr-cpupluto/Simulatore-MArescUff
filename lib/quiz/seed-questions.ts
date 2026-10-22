import type { Difficulty, Question, SubjectId } from "./types"

type Row = [Difficulty, string, string[], number, string?, string?]

const RAW: Record<SubjectId, Row[]> = {
  logica: [
    ["facile", "Quale numero completa la serie: 2, 4, 8, 16, ...?", ["24", "32", "30", "18"], 1, "Ogni termine è il doppio del precedente.", "Serie numeriche"],
    ["facile", "Se tutti i gatti sono felini e Tom è un gatto, allora:", ["Tom non è un felino", "Tom è un felino", "Tutti i felini sono gatti", "Non si può dire"], 1, "Sillogismo diretto.", "Logica deduttiva"],
    ["facile", "Quanto fa il 25% di 80?", ["15", "20", "25", "40"], 1, "80 × 0,25 = 20.", "Percentuali"],
    ["facile", "Un treno percorre 120 km in 2 ore. Qual è la velocità media?", ["50 km/h", "60 km/h", "70 km/h", "240 km/h"], 1, "120 / 2 = 60.", "Problemi"],
    ["facile", "Quale parola NON appartiene al gruppo: rosa, tulipano, quercia, margherita?", ["Rosa", "Tulipano", "Quercia", "Margherita"], 2, "La quercia è un albero, gli altri sono fiori.", "Logica verbale"],
    ["facile", "Completa la serie: A, C, E, G, ...", ["H", "I", "L", "F"], 1, "Si salta una lettera ogni volta.", "Serie alfabetiche"],
    ["difficile", "Completa la serie: 3, 5, 9, 17, 33, ...", ["49", "57", "65", "66"], 2, "La differenza raddoppia: +2, +4, +8, +16, +32.", "Serie numeriche"],
    ["difficile", "Nessun A è B. Alcuni C sono A. Quindi:", ["Alcuni C non sono B", "Tutti i C sono B", "Nessun C è B", "Alcuni B sono C"], 0, "I C che sono A non possono essere B.", "Logica deduttiva"],
    ["difficile", "Un prezzo aumenta del 20% e poi diminuisce del 20%. Rispetto al prezzo iniziale è:", ["Uguale", "Più alto del 4%", "Più basso del 4%", "Più basso del 2%"], 2, "1,2 × 0,8 = 0,96.", "Percentuali"],
    ["difficile", "Tre operai fanno un lavoro in 12 giorni. In quanti giorni lo fanno 4 operai?", ["8", "9", "10", "16"], 1, "3 × 12 = 36 giorni-uomo; 36 / 4 = 9.", "Proporzioni"],
    ["difficile", "Individuare il diagramma che rappresenta: Operai specializzati, Operai, Fabbriche.", ["Tre cerchi concentrici", "Un cerchio dentro un altro, il terzo separato", "Tre cerchi separati", "Tre cerchi intersecati"], 1, "Gli specializzati sono contenuti negli operai; le fabbriche sono un insieme a sé.", "Insiemistica"],
    ["difficile", "Se oggi è mercoledì, che giorno sarà tra 100 giorni?", ["Giovedì", "Venerdì", "Sabato", "Martedì"], 1, "100 mod 7 = 2 → mercoledì + 2 = venerdì.", "Calendario"],
  ],
  italiano: [
    ["facile", "Quale parola è scritta correttamente?", ["Coscienza", "Coscenza", "Cosciensa", "Coscienzia"], 0, undefined, "Ortografia"],
    ["facile", "Il plurale di 'uovo' è:", ["Uovi", "Uova", "Uove", "Uovo"], 1, "Plurale irregolare femminile.", "Morfologia"],
    ["facile", "Qual è il contrario di 'generoso'?", ["Altruista", "Avaro", "Gentile", "Prodigo"], 1, undefined, "Lessico"],
    ["facile", "In 'Marco corre veloce', 'veloce' svolge funzione di:", ["Soggetto", "Complemento oggetto", "Avverbio/complemento di modo", "Predicato"], 2, undefined, "Analisi logica"],
    ["facile", "Quale forma è corretta?", ["Qual'è", "Qual è", "Qualè", "Qual-è"], 1, "'Qual' è un troncamento, non vuole apostrofo.", "Ortografia"],
    ["facile", "Un sinonimo di 'celere' è:", ["Lento", "Rapido", "Celeste", "Calmo"], 1, undefined, "Lessico"],
    ["difficile", "Individuare la frase con il congiuntivo corretto:", ["Penso che lui ha ragione", "Penso che lui abbia ragione", "Penso che lui avrebbe ragione", "Penso che lui aveva ragione"], 1, undefined, "Sintassi"],
    ["difficile", "'Se lo avessi saputo, sarei venuto' è un periodo ipotetico:", ["Della realtà", "Della possibilità", "Dell'irrealtà", "Misto"], 2, "Congiuntivo trapassato + condizionale passato.", "Sintassi"],
    ["difficile", "Qual è il significato di 'pleonastico'?", ["Necessario", "Superfluo", "Ambiguo", "Elegante"], 1, undefined, "Lessico"],
    ["difficile", "In 'È necessario che tu studi', la proposizione 'che tu studi' è:", ["Oggettiva", "Soggettiva", "Relativa", "Causale"], 1, "Fa da soggetto a 'è necessario'.", "Sintassi"],
    ["difficile", "Quale parola contiene un dittongo?", ["Paura", "Piede", "Poeta", "Leone"], 1, "'ie' in 'piede' forma dittongo.", "Fonologia"],
  ],
  storia: [
    ["facile", "In che anno è stata proclamata l'Unità d'Italia?", ["1848", "1861", "1870", "1915"], 1, undefined, "Risorgimento"],
    ["facile", "Chi guidò la Spedizione dei Mille?", ["Cavour", "Mazzini", "Garibaldi", "Vittorio Emanuele II"], 2, undefined, "Risorgimento"],
    ["facile", "La Prima guerra mondiale iniziò nel:", ["1912", "1914", "1918", "1939"], 1, undefined, "Novecento"],
    ["facile", "Quale evento segna convenzionalmente la fine del Medioevo?", ["Scoperta dell'America", "Rivoluzione francese", "Caduta di Roma", "Pace di Westfalia"], 0, undefined, "Età moderna"],
    ["difficile", "Il Congresso di Vienna si concluse nel:", ["1789", "1804", "1815", "1830"], 2, undefined, "Ottocento"],
    ["difficile", "Lo Statuto Albertino fu concesso nel:", ["1821", "1848", "1861", "1876"], 1, undefined, "Risorgimento"],
    ["difficile", "Il Trattato di Rapallo (1920) riguardava:", ["La questione adriatica", "La pace con la Germania", "I Patti Lateranensi", "La Libia"], 0, undefined, "Novecento"],
    ["difficile", "Chi era il presidente del Consiglio durante la 'svolta di Salerno'?", ["Badoglio", "Bonomi", "De Gasperi", "Parri"], 0, undefined, "Novecento"],
  ],
  civica: [
    ["facile", "La Costituzione italiana è entrata in vigore il:", ["2 giugno 1946", "1 gennaio 1948", "25 aprile 1945", "1 gennaio 1950"], 1, undefined, "Costituzione"],
    ["facile", "Quanti sono gli articoli della Costituzione (esclusi transitori)?", ["100", "139", "150", "200"], 1, undefined, "Costituzione"],
    ["facile", "Chi è il Capo dello Stato in Italia?", ["Il Presidente del Consiglio", "Il Presidente della Repubblica", "Il Presidente del Senato", "Il Ministro dell'Interno"], 1, undefined, "Istituzioni"],
    ["facile", "Il potere legislativo spetta a:", ["Governo", "Magistratura", "Parlamento", "Presidente della Repubblica"], 2, undefined, "Istituzioni"],
    ["difficile", "Quanti anni dura il mandato del Presidente della Repubblica?", ["5", "6", "7", "9"], 2, undefined, "Istituzioni"],
    ["difficile", "Quale articolo della Costituzione afferma che l'Italia ripudia la guerra?", ["Art. 1", "Art. 3", "Art. 11", "Art. 21"], 2, undefined, "Costituzione"],
    ["difficile", "La Corte costituzionale è composta da:", ["9 giudici", "12 giudici", "15 giudici", "21 giudici"], 2, undefined, "Istituzioni"],
    ["difficile", "Da quale ministero dipende la Guardia di Finanza?", ["Interno", "Difesa", "Economia e Finanze", "Giustizia"], 2, undefined, "Ordinamento"],
  ],
  inglese: [
    ["facile", "Choose the correct form: 'She ___ to school every day.'", ["go", "goes", "going", "gone"], 1, undefined, "Present simple"],
    ["facile", "The plural of 'child' is:", ["Childs", "Children", "Childes", "Childrens"], 1, undefined, "Plurali"],
    ["facile", "What is the opposite of 'cheap'?", ["Expensive", "Poor", "Easy", "Small"], 0, undefined, "Vocabolario"],
    ["facile", "'I ___ a student.'", ["is", "are", "am", "be"], 2, undefined, "Verbo essere"],
    ["difficile", "'If I ___ you, I would accept.'", ["am", "was", "were", "be"], 2, "Second conditional: 'were' per tutte le persone.", "Condizionali"],
    ["difficile", "'By next year, she ___ her degree.'", ["will finish", "will have finished", "finishes", "has finished"], 1, "Future perfect.", "Tempi verbali"],
    ["difficile", "Choose the correct sentence:", ["He suggested me to go", "He suggested that I go", "He suggested me going", "He suggested I to go"], 1, undefined, "Costruzioni"],
    ["difficile", "'I'm looking forward ___ you.'", ["to see", "seeing", "to seeing", "see"], 2, undefined, "Phrasal verbs"],
  ],
  informatica: [
    ["facile", "Che cosa significa CPU?", ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Control Power Unit"], 0, undefined, "Hardware"],
    ["facile", "Quale dei seguenti è un sistema operativo?", ["Excel", "Linux", "Chrome", "Word"], 1, undefined, "Software"],
    ["facile", "1 byte corrisponde a:", ["4 bit", "8 bit", "16 bit", "1024 bit"], 1, undefined, "Fondamenti"],
    ["facile", "Quale estensione indica un file PDF?", [".doc", ".pdf", ".xls", ".txt"], 1, undefined, "File"],
    ["difficile", "Quale protocollo è usato per l'invio di email?", ["HTTP", "FTP", "SMTP", "DNS"], 2, undefined, "Reti"],
    ["difficile", "In Excel, quale funzione restituisce la media?", ["SOMMA", "MEDIA", "CONTA", "MAX"], 1, undefined, "Office"],
    ["difficile", "La memoria RAM è:", ["Permanente", "Volatile", "Di sola lettura", "Esterna"], 1, undefined, "Hardware"],
    ["difficile", "Il numero binario 1010 corrisponde in decimale a:", ["8", "10", "12", "5"], 1, undefined, "Fondamenti"],
  ],
}

function generateMath(): Question[] {
  const out: Question[] = []
  for (let i = 0; i < 24; i++) {
    const a = 12 + ((i * 7) % 37)
    const b = 3 + ((i * 5) % 11)
    const hard = i % 2 === 1
    if (hard) {
      const result = a * b - b
      const opts = [result, result + b, result - 2, result + 7]
      const order = rotate(opts, i % 4)
      out.push({
        id: `gen-logica-${i}`,
        subject: "logica",
        topic: "Calcolo",
        difficulty: "difficile",
        text: `Quanto vale ${a} × ${b} − ${b}?`,
        options: order.map(String),
        correctIndex: order.indexOf(result),
        explanation: `${a} × ${b} = ${a * b}; ${a * b} − ${b} = ${result}.`,
      })
    } else {
      const result = a + b * 2
      const opts = [result, result + 2, result - 1, result + 10]
      const order = rotate(opts, i % 4)
      out.push({
        id: `gen-logica-${i}`,
        subject: "logica",
        topic: "Calcolo",
        difficulty: "facile",
        text: `Quanto vale ${a} + ${b} × 2?`,
        options: order.map(String),
        correctIndex: order.indexOf(result),
        explanation: "La moltiplicazione precede l'addizione.",
      })
    }
  }
  return out
}

function rotate<T>(arr: T[], n: number) {
  return [...arr.slice(n), ...arr.slice(0, n)]
}

export const SEED_QUESTIONS: Question[] = [
  ...Object.entries(RAW).flatMap(([subject, rows]) =>
    rows.map(([difficulty, text, options, correctIndex, explanation, topic], i) => ({
      id: `seed-${subject}-${i}`,
      subject: subject as SubjectId,
      difficulty,
      text,
      options,
      correctIndex,
      explanation,
      topic,
    })),
  ),
  ...generateMath(),
]
