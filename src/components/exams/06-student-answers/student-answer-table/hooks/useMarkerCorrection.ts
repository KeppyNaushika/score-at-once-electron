import { useEffect, useRef, useState } from "react"

import type { CellData } from "@/components/exams/06-student-answers/student-answer-table/types"
import type {
  ExamPageColumn,
  UnsavedAnswerImage,
} from "@/components/exams/06-student-answers/types"

interface UseMarkerCorrectionArgs {
  examId: string
  files: UnsavedAnswerImage[]
  tableData: CellData<UnsavedAnswerImage>[][]
  examPages: ExamPageColumn[]
  markerCorrectionEnabled: boolean
  markerAvailablePages: Set<number>
  onFilesChange: (files: UnsavedAnswerImage[]) => void
}

interface UseMarkerCorrectionResult {
  correctingFileIds: Set<string>
}

/**
 * 配置戦略に応じた動的マーカー補正フック
 *
 * 仕組み:
 * - tableData から各ファイルのマスターページ番号を決定
 * - file.correctedForPage と異なれば再補正（または復元）
 * - トグルOFF、マスター無し、未配置ファイルは元に戻す
 */
export function useMarkerCorrection({
  examId,
  files,
  tableData,
  examPages,
  markerCorrectionEnabled,
  markerAvailablePages,
  onFilesChange,
}: UseMarkerCorrectionArgs): UseMarkerCorrectionResult {
  const originalBuffersRef = useRef<Map<string, ArrayBuffer>>(new Map())
  const runIdRef = useRef(0)
  const filesRef = useRef(files)
  filesRef.current = files
  const [correctingFileIds, setCorrectingFileIds] = useState<Set<string>>(
    new Set()
  )

  // 削除されたファイルの元バッファ参照を解放（メモリリーク防止）
  useEffect(() => {
    const currentIds = new Set(files.map((file) => file.id))
    for (const id of originalBuffersRef.current.keys()) {
      if (!currentIds.has(id)) {
        originalBuffersRef.current.delete(id)
      }
    }
  }, [files])

  useEffect(() => {
    const runId = ++runIdRef.current

    // ファイルID → 対応マスターページ番号 のマップを構築
    const targetMap = new Map<string, number>()
    if (markerCorrectionEnabled) {
      for (const row of tableData) {
        // マスターページ番号はセルの列（ExamPage 実体）の pageNumber から導出する
        row.forEach((cell, pageIndex) => {
          const examPage = examPages[pageIndex]
          if (cell.file && examPage) {
            targetMap.set(cell.file.id, examPage.pageNumber)
          }
        })
      }
    }

    // 処理が必要なファイルを抽出
    type Task = {
      file: UnsavedAnswerImage
      buffer: ArrayBuffer
      target: number | undefined
    }
    const tasks: Task[] = []
    for (const file of files) {
      // DB読み込み済みの既存答案（imagePathあり）や buffer 無しは対象外
      if (file.imagePath || !file.buffer) continue
      const buffer = file.buffer
      const rawTarget = targetMap.get(file.id)
      // マスターが存在しないページは対象外（undefined扱いで復元）
      const target =
        rawTarget !== undefined && markerAvailablePages.has(rawTarget)
          ? rawTarget
          : undefined

      if (target === undefined) {
        if (
          file.correctedForPage !== undefined ||
          file.correctionStatus !== undefined
        ) {
          tasks.push({ file, buffer, target: undefined })
        }
      } else if (file.correctedForPage !== target) {
        tasks.push({ file, buffer, target })
      }
    }

    if (tasks.length === 0) return

    // 補正対象のIDを loading 状態として公開（補正実行のもののみ）
    const correctingIds = new Set(
      tasks
        .filter((task) => task.target !== undefined)
        .map((task) => task.file.id)
    )
    if (correctingIds.size > 0) {
      setCorrectingFileIds((prev) => {
        const next = new Set(prev)
        for (const id of correctingIds) next.add(id)
        return next
      })
    }

    const processTasks = async () => {
      const processed = await Promise.all(
        tasks.map(async ({ file, buffer, target }) => {
          // 元バッファを初回のみ記憶
          if (!originalBuffersRef.current.has(file.id)) {
            originalBuffersRef.current.set(file.id, buffer)
          }
          const origBuffer = originalBuffersRef.current.get(file.id)!

          // 復元（target未指定）
          if (target === undefined) {
            return restoreFromOriginal(file, origBuffer)
          }

          // 補正実行
          try {
            const sendBuffer = new Uint8Array(origBuffer.byteLength)
            sendBuffer.set(new Uint8Array(origBuffer))
            const result = await window.electronAPI.omr.correctImage(
              examId,
              target,
              sendBuffer
            )
            if (result.success && result.correctedBuffer) {
              const correctedAB = result.correctedBuffer.buffer.slice(
                result.correctedBuffer.byteOffset,
                result.correctedBuffer.byteOffset +
                  result.correctedBuffer.byteLength
              ) as ArrayBuffer
              if (file.preview && file.preview.startsWith("blob:")) {
                URL.revokeObjectURL(file.preview)
              }
              const blob = new Blob([correctedAB], { type: "image/png" })
              return {
                ...file,
                buffer: correctedAB,
                fileType: "image/png",
                preview: URL.createObjectURL(blob),
                correctionStatus: "corrected" as const,
                correctedForPage: target,
                correctionError: undefined,
              }
            }
            const reason = result.error ?? "不明なエラー"
            console.warn(
              `補正スキップ (${file.name}, 対象p${target}): ${reason}`
            )
            const restored = restoreFromOriginal(file, origBuffer)
            return {
              ...restored,
              correctionStatus: "skipped" as const,
              correctedForPage: target,
              correctionError: reason,
            }
          } catch (error) {
            const reason =
              error instanceof Error ? error.message : "画像補正IPC例外"
            console.error("画像補正エラー:", error)
            const restored = restoreFromOriginal(file, origBuffer)
            return {
              ...restored,
              correctionStatus: "skipped" as const,
              correctedForPage: target,
              correctionError: reason,
            }
          }
        })
      )

      if (runId !== runIdRef.current) {
        // 新しい実行で置き換えられた — loadingフラグは最新runが管理
        return
      }

      // 最新のfiles（他所で更新された可能性）に対してid一致で差し替え
      const byId = new Map(
        processed.map((processedFile) => [processedFile.id, processedFile])
      )
      const merged = filesRef.current.map((file) => byId.get(file.id) ?? file)
      onFilesChange(merged)

      // loading終了
      if (correctingIds.size > 0) {
        setCorrectingFileIds((prev) => {
          const next = new Set(prev)
          for (const id of correctingIds) next.delete(id)
          return next
        })
      }
    }

    processTasks()
  }, [
    examId,
    files,
    tableData,
    examPages,
    markerCorrectionEnabled,
    markerAvailablePages,
    onFilesChange,
  ])

  return { correctingFileIds }
}

/** 元バッファから preview を作り直して復元 */
function restoreFromOriginal(
  file: UnsavedAnswerImage,
  origBuffer: ArrayBuffer
): UnsavedAnswerImage {
  if (file.buffer === origBuffer) {
    return {
      ...file,
      correctionStatus: undefined,
      correctedForPage: undefined,
      correctionError: undefined,
    }
  }
  if (file.preview && file.preview.startsWith("blob:")) {
    URL.revokeObjectURL(file.preview)
  }
  const blob = new Blob([origBuffer], { type: file.fileType })
  return {
    ...file,
    buffer: origBuffer,
    preview: URL.createObjectURL(blob),
    correctionStatus: undefined,
    correctedForPage: undefined,
    correctionError: undefined,
  }
}
