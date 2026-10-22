import { PDFDocument } from "pdf-lib"

export interface PdfChunk {
  index: number
  fromPage: number
  toPage: number
  bytes: Uint8Array
}

/** Splits a PDF into chunks of `size` pages (default 2) so each AI request stays small. */
export async function splitPdf(data: ArrayBuffer, size = 2): Promise<{ totalPages: number; chunks: PdfChunk[] }> {
  const source = await PDFDocument.load(data, { ignoreEncryption: true })
  const totalPages = source.getPageCount()
  const step = Math.max(1, Math.floor(size))
  const chunks: PdfChunk[] = []

  for (let start = 0; start < totalPages; start += step) {
    const end = Math.min(start + step, totalPages)
    const part = await PDFDocument.create()
    const pages = await part.copyPages(
      source,
      Array.from({ length: end - start }, (_, i) => start + i),
    )
    pages.forEach((p) => part.addPage(p))
    chunks.push({ index: chunks.length, fromPage: start + 1, toPage: end, bytes: await part.save() })
  }

  return { totalPages, chunks }
}
