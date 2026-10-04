import type {
  ImportedFile,
  OutputPage,
  OutputSheet,
  PdfPageInput,
  PdfSourcePageInput,
} from "@/types/pdfTools.types"

/**
 * 出力の各ページを、main プロセスへ渡すページ入力に変換する。
 * 面はスロットの並び（空きスロットの null も）をそのまま渡す。
 */
export function buildPdfPageInputs(
  outputSheets: OutputSheet[],
  importedFiles: ImportedFile[]
): PdfPageInput[] {
  const filePathById = new Map(
    importedFiles.map((importedFile) => [importedFile.id, importedFile.path])
  )
  const toSourcePageInput = (page: OutputPage): PdfSourcePageInput => ({
    kind: "page",
    filePath: filePathById.get(page.sourceFileId) ?? "",
    pageNumber: page.sourcePageNumber,
    rotation: page.rotation,
  })
  return outputSheets.map((outputSheet) =>
    outputSheet.kind === "page"
      ? toSourcePageInput(outputSheet)
      : {
          kind: "sheet",
          nUp: outputSheet.nUp,
          slots: outputSheet.slots.map((slot) =>
            slot ? toSourcePageInput(slot) : null
          ),
        }
  )
}
