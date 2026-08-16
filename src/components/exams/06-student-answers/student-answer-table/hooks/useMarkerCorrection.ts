import { useMutation } from "@tanstack/react-query"
import { useEffect, useMemo, useRef } from "react"

import type { AnswerTableRow } from "@/components/exams/06-student-answers/student-answer-table/types"
import type {
  ExamPageColumn,
  UnsavedAnswerImage,
} from "@/components/exams/06-student-answers/types"
import { correctImageMutation } from "@/queries/omr"

interface UseMarkerCorrectionArgs {
  files: UnsavedAnswerImage[]
  tableRows: AnswerTableRow<UnsavedAnswerImage>[]
  markerCorrectionEnabled: boolean
  markerAvailableExamPageIds: Set<string>
  onFilesChange: (files: UnsavedAnswerImage[]) => void
}

interface UseMarkerCorrectionResult {
  correctingFileIds: Set<string>
}

/** 1ファイル分の補正作業。target が undefined なら元へ戻す */
interface CorrectionTask {
  file: UnsavedAnswerImage
  buffer: ArrayBuffer
  target: ExamPageColumn | undefined
}

/**
 * いま補正・復元が必要なファイルを洗い出す。
 *
 * files と配置（tableRows）だけから決まる純粋な導出なので、実行中フラグも
 * ここから引ける（状態として別に持つと files との同期がずれる）。
 */
function collectCorrectionTasks({
  files,
  tableRows,
  markerCorrectionEnabled,
  markerAvailableExamPageIds,
}: Omit<UseMarkerCorrectionArgs, "onFilesChange">): CorrectionTask[] {
  // ファイルID → 補正対象ページ（マスが持つ列の ExamPage 実体）のマップを構築。
  // 同定は id、ログの「ページN」表示は pageNumber と、実体をそのまま持ち回って使い分ける。
  const targetMap = new Map<string, ExamPageColumn>()
  if (markerCorrectionEnabled) {
    for (const row of tableRows) {
      for (const cell of row.cells) {
        if (cell.file) {
          targetMap.set(cell.file.id, cell.examPage)
        }
      }
    }
  }

  const tasks: CorrectionTask[] = []
  for (const file of files) {
    // DB読み込み済みの既存答案（imagePathあり）や buffer 無しは対象外
    if (file.imagePath || !file.buffer) continue
    const buffer = file.buffer
    const rawTarget = targetMap.get(file.id)
    // マスターが存在しないページは対象外（undefined扱いで復元）
    const target =
      rawTarget !== undefined && markerAvailableExamPageIds.has(rawTarget.id)
        ? rawTarget
        : undefined

    if (target === undefined) {
      if (
        file.correctedForExamPageId !== undefined ||
        file.correctionStatus !== undefined
      ) {
        tasks.push({ file, buffer, target: undefined })
      }
    } else if (file.correctedForExamPageId !== target.id) {
      tasks.push({ file, buffer, target })
    }
  }
  return tasks
}

/**
 * 配置戦略に応じた動的マーカー補正フック
 *
 * 仕組み:
 * - tableRows から各ファイルの配置先ページ（ExamPage.id）を決定
 * - file.correctedForExamPageId と異なれば再補正（または復元）
 * - トグルOFF、マスター無し、未配置ファイルは元に戻す
 */
export function useMarkerCorrection({
  files,
  tableRows,
  markerCorrectionEnabled,
  markerAvailableExamPageIds,
  onFilesChange,
}: UseMarkerCorrectionArgs): UseMarkerCorrectionResult {
  // 依存へ入れるのは `mutateAsync`。`useMutation` の戻り値は毎レンダー新しい
  // オブジェクトなので、まるごと入れると effect が自走する
  const { mutateAsync: requestCorrection } = useMutation(correctImageMutation())
  const originalBuffersRef = useRef<Map<string, ArrayBuffer>>(new Map())
  const runIdRef = useRef(0)
  const filesRef = useRef(files)
  useEffect(() => {
    filesRef.current = files
  })
  const tasks = useMemo(
    () =>
      collectCorrectionTasks({
        files,
        tableRows,
        markerCorrectionEnabled,
        markerAvailableExamPageIds,
      }),
    [files, tableRows, markerCorrectionEnabled, markerAvailableExamPageIds]
  )

  // 補正を実行するファイル（復元は待たせない）。補正が終われば onFilesChange で
  // files が入れ替わり、その回の作業が消えて自然に解除される
  const correctingFileIds = useMemo(
    () =>
      new Set(
        tasks
          .filter((task) => task.target !== undefined)
          .map((task) => task.file.id)
      ),
    [tasks]
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

    if (tasks.length === 0) return

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
            const result = await requestCorrection({
              examPageId: target.id,
              buffer: sendBuffer,
            })
            if (result.status === "corrected") {
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
                correctedForExamPageId: target.id,
                correctionError: undefined,
              }
            }
            const reason = result.reason
            console.warn(
              `補正スキップ (${file.name}, 対象ページ${target.pageNumber}): ${reason}`
            )
            const restored = restoreFromOriginal(file, origBuffer)
            return {
              ...restored,
              correctionStatus: "skipped" as const,
              correctedForExamPageId: target.id,
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
              correctedForExamPageId: target.id,
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
    }

    processTasks()
  }, [tasks, onFilesChange, requestCorrection])

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
      correctedForExamPageId: undefined,
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
    correctedForExamPageId: undefined,
    correctionError: undefined,
  }
}
