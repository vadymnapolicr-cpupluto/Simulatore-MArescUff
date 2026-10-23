import { PDFDocument } from "pdf-lib"

export interface PdfChunk {
  index: number
  fromPage: number
  toPage: number
  pageNumbers: number[]
  bytes: Uint8Array
}

export interface SplitPdfOptions {
  size?: number
  skipStart?: number
  skipEnd?: number
  skipCustom?: string | number[]
}

export function parseExcludedPages(
  totalPages: number,
  skipStart = 2,
  skipEnd = 2,
  skipCustom: string | number[] = "",
): Set<number> {
  const excluded = new Set<number>()

  // Salta prime N pagine
  const startCount = Math.max(0, Math.floor(skipStart))
  for (let p = 1; p <= Math.min(startCount, totalPages); p++) {
    excluded.add(p)
  }

  // Salta ultime N pagine
  const endCount = Math.max(0, Math.floor(skipEnd))
  for (let p = Math.max(1, totalPages - endCount + 1); p <= totalPages; p++) {
    excluded.add(p)
  }

  // Pagine custom aggiuntive (es. "7, 12" o "10-12")
  if (Array.isArray(skipCustom)) {
    for (const p of skipCustom) {
      if (p >= 1 && p <= totalPages) excluded.add(p)
    }
  } else if (typeof skipCustom === "string" && skipCustom.trim()) {
    const parts = skipCustom.split(/[\s,;]+/)
    for (const part of parts) {
      if (/^\d+$/.test(part)) {
        const num = Number(part)
        if (num >= 1 && num <= totalPages) excluded.add(num)
      } else if (/^\d+-\d+$/.test(part)) {
        const [a, b] = part.split("-").map(Number)
        const low = Math.min(a, b)
        const high = Math.max(a, b)
        for (let p = low; p <= high; p++) {
          if (p >= 1 && p <= totalPages) excluded.add(p)
        }
      }
    }
  }

  return excluded
}

/** Divide il PDF in blocchi escludendo le pagine impostate. */
export async function splitPdf(
  data: ArrayBuffer,
  options?: number | SplitPdfOptions,
): Promise<{ totalPages: number; activePages: number[]; chunks: PdfChunk[] }> {
  const source = await PDFDocument.load(data, { ignoreEncryption: true })
  const totalPages = source.getPageCount()

  const opts: SplitPdfOptions = typeof options === "number" ? { size: options } : options ?? {}
  const size = Math.max(1, Math.floor(opts.size ?? 2))
  const skipStart = opts.skipStart ?? 2
  const skipEnd = opts.skipEnd ?? 2
  const skipCustom = opts.skipCustom ?? ""

  const excluded = parseExcludedPages(totalPages, skipStart, skipEnd, skipCustom)
  const activePages: number[] = []
  for (let p = 1; p <= totalPages; p++) {
    if (!excluded.has(p)) activePages.push(p)
  }

  const chunks: PdfChunk[] = []
  for (let i = 0; i < activePages.length; i += size) {
    const chunkPages = activePages.slice(i, i + size)
    const part = await PDFDocument.create()
    const zeroBased = chunkPages.map((p) => p - 1)
    const pages = await part.copyPages(source, zeroBased)
    pages.forEach((p) => part.addPage(p))

    chunks.push({
      index: chunks.length,
      fromPage: chunkPages[0],
      toPage: chunkPages[chunkPages.length - 1],
      pageNumbers: chunkPages,
      bytes: await part.save(),
    })
  }

  return { totalPages, activePages, chunks }
}
