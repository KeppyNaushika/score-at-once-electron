import type {
  ImportedFile,
  OutputSheet,
  PdfPageInput,
} from "@/types/pdfTools.types"

/**
 * 出力の各ページを、main プロセスへ渡すページ入力に変換する。
 * 面はスロットの並び（空きスロットの null も）をそのまま渡す。全体の面に入った
 * ファイルごとの面も、面のまま入れ子にして渡す（配置は main が葉ごとに畳む）。
 */
export function buildPdfPageInputs(
  outputSheets: OutputSheet[],
  importedFiles: ImportedFile[]
): PdfPageInput[] {
  const filePathById = new Map(
    importedFiles.map((importedFile) => [importedFile.id, importedFile.path])
  )
  const toPageInput = (outputSheet: OutputSheet): PdfPageInput =>
    outputSheet.kind === "page"
      ? {
          kind: "page",
          filePath: filePathById.get(outputSheet.sourceFileId) ?? "",
          pageNumber: outputSheet.sourcePageNumber,
          rotation: outputSheet.rotation,
        }
      : {
          kind: "sheet",
          nUp: outputSheet.nUp,
          slots: outputSheet.slots.map((slot) =>
            slot ? toPageInput(slot) : null
          ),
        }
  return outputSheets.map(toPageInput)
}
