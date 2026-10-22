import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface LocalQuestion {
  number: number
  page: number
  text: string
  options: string[]
  band: { top: number; bottom: number }
  figures: Box[]
  warnings: string[]
}

export interface LocalPageResult {
  page: number
  questions: LocalQuestion[]
  textItems: number
  scanned: boolean
}

interface Item {
  str: string
  x: number
  y: number
  w: number
  h: number
}

const NUMBER_RE = /^\s*(\d{1,3})\s*[).]\s*([\s\S]*)$/
const OPTION_RE = /^\s*([a-eA-E])\s*\)\s*([\s\S]*)$/
const INLINE_OPTION_SPLIT = /\s+(?=[a-eA-E]\)\s)/
const HEADER_RE = /LIBRETTO\s+TIPO|^Pagina\s+\d+\s+di\s+\d+$|^\d+\s*\/\s*\d+$/i
const FIGURE_HINT_RE = /\b(figur[ae]|tabell[ae]|grafic[oi]|immagin[ei]|schema|disegno|diagramma|osservand[oa])\b/i

export async function loadPdf(data: ArrayBuffer | Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
  const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0))
  return pdfjs.getDocument({ data: bytes }).promise
}

function joinText(items: Item[]) {
  const sorted = [...items].sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x))
  let out = ""
  for (const it of sorted) {
    const s = it.str.replace(/\s+/g, " ").trim()
    if (!s) continue
    if (!out) out = s
    else if (/[-‐]$/.test(out) && /^[a-zàèéìòù]/.test(s)) out = out.slice(0, -1) + s
    else if (/[-‐/(]$/.test(out)) out += s
    else out += ` ${s}`
  }
  return out.replace(/\s+([,.;:?!)])/g, "$1").trim()
}

/** Splits items holding several "a) ... b) ..." chunks into separate virtual items. */
function expandItems(raw: Item[]): Item[] {
  const out: Item[] = []
  for (const it of raw) {
    const parts = it.str.split(INLINE_OPTION_SPLIT)
    if (parts.length < 2) {
      out.push(it)
      continue
    }
    let offset = 0
    const charW = it.w / Math.max(1, it.str.length)
    for (const p of parts) {
      const idx = it.str.indexOf(p, offset)
      out.push({ ...it, str: p, x: it.x + idx * charW, w: p.length * charW })
      offset = idx + p.length
    }
  }
  return out
}

type Matrix = [number, number, number, number, number, number]
const mul = (m: Matrix, c: Matrix): Matrix => [
  m[0] * c[0] + m[1] * c[2],
  m[0] * c[1] + m[1] * c[3],
  m[2] * c[0] + m[3] * c[2],
  m[2] * c[1] + m[3] * c[3],
  m[4] * c[0] + m[5] * c[2] + c[4],
  m[4] * c[1] + m[5] * c[3] + c[5],
]

async function findImages(page: PDFPageProxy): Promise<Box[]> {
  const pdfjs = await import("pdfjs-dist")
  const OPS = pdfjs.OPS
  const ops = await page.getOperatorList()
  const boxes: Box[] = []
  let ctm: Matrix = [1, 0, 0, 1, 0, 0]
  const stack: Matrix[] = []
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i] as unknown[]
    if (fn === OPS.save) stack.push(ctm)
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm
    else if (fn === OPS.transform) ctm = mul(args as Matrix, ctm)
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm)
      const m = args?.[0]
      if (Array.isArray(m) && m.length === 6) ctm = mul(m as Matrix, ctm)
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm
    else if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintImageMaskXObject ||
      fn === OPS.paintImageXObjectRepeat
    ) {
      const pts = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([x, y]) => [x * ctm[0] + y * ctm[2] + ctm[4], x * ctm[1] + y * ctm[3] + ctm[5]])
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      boxes.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) })
    }
  }
  return boxes
}

export async function parsePage(doc: PDFDocumentProxy, pageNum: number): Promise<LocalPageResult> {
  const page = await doc.getPage(pageNum)
  const [vx0, vy0, vx1, vy1] = page.view
  const W = vx1 - vx0
  const H = vy1 - vy0
  const tc = await page.getTextContent()

  const rawItems: Item[] = []
  for (const it of tc.items) {
    if (!("str" in it) || !it.str.trim()) continue
    const item = { str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || 8 }
    if (HEADER_RE.test(item.str.trim())) continue
    if (item.y > vy1 - H * 0.04 || item.y < vy0 + H * 0.03) continue
    rawItems.push(item)
  }

  const images = await findImages(page)
  const scanned = rawItems.length < 5 || images.some((b) => b.x1 - b.x0 > W * 0.85 && b.y1 - b.y0 > H * 0.85)

  // Question markers: "N)" either alone or followed by text, in the left part of the page.
  const markers: (Item & { num: number })[] = []
  const items: Item[] = []
  for (const it of expandItems(rawItems)) {
    const m = it.x < vx0 + W * 0.4 ? NUMBER_RE.exec(it.str) : null
    if (m && Number(m[1]) > 0) {
      markers.push({ ...it, num: Number(m[1]) })
      if (m[2].trim()) {
        const charW = it.w / Math.max(1, it.str.length)
        const cut = it.str.length - m[2].length
        items.push({ ...it, str: m[2], x: it.x + cut * charW, w: m[2].length * charW })
      }
    } else items.push(it)
  }

  // Keep only markers aligned on the dominant left column (ignores "1)" inside text).
  const xs = markers.map((m) => Math.round(m.x / 10) * 10)
  const freq = new Map<number, number>()
  for (const x of xs) freq.set(x, (freq.get(x) ?? 0) + 1)
  const colX = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const qMarkers = markers
    .filter((m) => colX === undefined || Math.abs(m.x - colX) <= 15)
    .sort((a, b) => b.y - a.y)
  for (const m of markers) if (!qMarkers.includes(m)) items.push(m)

  const marginX = qMarkers.length ? Math.min(...qMarkers.map((m) => m.x)) : vx0 + W * 0.05
  const figures = images.filter((b) => {
    const w = b.x1 - b.x0
    const h = b.y1 - b.y0
    if (w < 12 || h < 12) return false
    if (w > W * 0.85 && h > H * 0.85) return false
    return b.x1 > marginX + 5 // QR codes sit in the left margin
  })

  const questions: LocalQuestion[] = qMarkers.map((mk, i) => {
    const next = qMarkers[i + 1]
    const top = mk.y + mk.h * 1.3
    const bottom = next ? next.y + next.h * 1.1 : vy0 + H * 0.03
    const inBand = items.filter((it) => it.y <= top && it.y > bottom - 0.01)

    const starts: (Item & { letter: number; rest: string })[] = []
    const plain: Item[] = []
    for (const it of inBand) {
      const m = OPTION_RE.exec(it.str)
      if (m) {
        const letter = m[1].toLowerCase().charCodeAt(0) - 97
        const charW = it.w / Math.max(1, it.str.length)
        const cut = it.str.length - m[2].length
        starts.push({ ...it, letter, rest: m[2], x: it.x })
        if (m[2].trim()) plain.push({ ...it, str: m[2], x: it.x + cut * charW + 0.01, w: m[2].length * charW })
        ;(plain[plain.length - 1] as Item & { owner?: number }).owner = m[2].trim() ? starts.length - 1 : undefined
      } else plain.push(it)
    }

    // One start per letter, first in reading order.
    const seen = new Set<number>()
    const optStarts = starts
      .sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x))
      .filter((s) => (seen.has(s.letter) ? false : (seen.add(s.letter), true)))

    const groups: Item[][] = optStarts.map(() => [])
    const qText: Item[] = []
    for (const it of plain) {
      const cands = optStarts
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => s.y >= it.y - 1.5 && s.x <= it.x + 2)
      if (!cands.length) {
        qText.push(it)
        continue
      }
      const maxX = Math.max(...cands.map((c) => c.s.x))
      const best = cands.filter((c) => Math.abs(c.s.x - maxX) <= 3).sort((a, b) => a.s.y - b.s.y)[0]
      groups[best.idx].push(it)
    }

    const order = optStarts.map((s, idx) => ({ letter: s.letter, idx })).sort((a, b) => a.letter - b.letter)
    const options = order.map((o) => joinText(groups[o.idx]))
    const text = joinText(qText)

    const qFigures = figures.filter((f) => {
      const cy = (f.y0 + f.y1) / 2
      return cy <= top && cy > bottom
    })

    const warnings: string[] = []
    if (options.length < 2) warnings.push("Risposte non trovate")
    else if (order.some((o, k) => o.letter !== k)) warnings.push("Lettere delle risposte non consecutive")
    if (options.some((o) => !o)) warnings.push("Una risposta è vuota")
    if (!text) warnings.push("Testo domanda vuoto")
    if (!qFigures.length && FIGURE_HINT_RE.test(text)) warnings.push("Cita una figura/tabella ma nessuna immagine trovata")

    return { number: mk.num, page: pageNum, text, options, band: { top, bottom }, figures: qFigures, warnings }
  })

  page.cleanup()
  return { page: pageNum, questions, textItems: rawItems.length, scanned }
}

/** Renders a region of a page (PDF points) to a JPEG data URL. Browser only. */
export async function renderRegion(
  doc: PDFDocumentProxy,
  pageNum: number,
  regions: Box[],
  { scale = 2.5, pad = 4, maxWidth = 1100 } = {},
): Promise<string[]> {
  const page = await doc.getPage(pageNum)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  const [vx0, , , vy1] = page.view
  const out = regions.map((r) => {
    const x = Math.max(0, (r.x0 - pad - vx0) * scale)
    const y = Math.max(0, (vy1 - r.y1 - pad) * scale)
    const w = Math.min(canvas.width - x, (r.x1 - r.x0 + pad * 2) * scale)
    const h = Math.min(canvas.height - y, (r.y1 - r.y0 + pad * 2) * scale)
    const ratio = Math.min(1, maxWidth / w)
    const crop = document.createElement("canvas")
    crop.width = Math.max(1, Math.round(w * ratio))
    crop.height = Math.max(1, Math.round(h * ratio))
    crop.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, crop.width, crop.height)
    return crop.toDataURL("image/jpeg", 0.85)
  })
  page.cleanup()
  return out
}

export function unionBox(boxes: Box[]): Box {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  }
}

/** Full-width crop of a question band (useful for vector figures not detected as images). */
export async function bandBox(doc: PDFDocumentProxy, pageNum: number, band: { top: number; bottom: number }) {
  const page = await doc.getPage(pageNum)
  const [vx0, , vx1] = page.view
  const W = vx1 - vx0
  return { x0: vx0 + W * 0.03, x1: vx1 - W * 0.02, y0: band.bottom, y1: band.top } satisfies Box
}

/** Converts a Gemini [ymin, xmin, ymax, xmax] 0-1000 box to PDF points. */
export async function normalizedToBox(doc: PDFDocumentProxy, pageNum: number, b: number[]): Promise<Box | null> {
  if (b.length !== 4 || b.some((n) => !Number.isFinite(n))) return null
  const page = await doc.getPage(pageNum)
  const [vx0, vy0, vx1, vy1] = page.view
  const W = vx1 - vx0
  const H = vy1 - vy0
  const [ymin, xmin, ymax, xmax] = b.map((n) => Math.min(1000, Math.max(0, n)) / 1000)
  if (xmax <= xmin || ymax <= ymin) return null
  return { x0: vx0 + xmin * W, x1: vx0 + xmax * W, y0: vy1 - ymax * H, y1: vy1 - ymin * H }
}
