/**
 * OMR認識実行フック
 *
 * バッチ認識の実行・進捗管理・結果保持を行う。
 */

import { useCallback, useEffect, useRef, useState } from "react"

import type { ComputedCell } from "@/types/answerSheetLayout.types"
import type {
  OMRBatchProgress,
  OMRCellConfig,
  OMRCellResult,
  OMRRecognitionParams,
  OMRSheetResult,
  Point,
} from "@/types/omr.types"

interface OMRRecognitionState {
  /** 認識中フラグ */
  isRecognizing: boolean
  /** バッチ進捗 */
  progress: OMRBatchProgress | null
  /** シートごとの認識結果 */
  sheetResults: OMRSheetResult[]
  /** 全セル結果のフラットリスト */
  allCellResults: Array<OMRCellResult & { studentId?: string }>
  /** エラーメッセージ */
  error: string | null
}

interface UseOMRRecognitionOptions {
  cells: ComputedCell[]
  cellConfigs: Record<string, OMRCellConfig>
  expectedCorners: [Point, Point, Point, Point]
  params?: OMRRecognitionParams
  pageIndex?: number
}

interface UseOMRRecognitionReturn extends OMRRecognitionState {
  /** 単一画像の認識を実行 */
  recognizeSingle: (
    imagePath: string,
    studentId?: string
  ) => Promise<OMRSheetResult | null>
  /** バッチ認識を実行 */
  recognizeBatch: (
    entries: { path: string; studentId?: string; studentName?: string }[]
  ) => Promise<void>
  /** 結果をクリア */
  clearResults: () => void
  /** パラメータ変更 */
  updateParams: (params: Partial<OMRRecognitionParams>) => void
  /** 現在のパラメータ */
  currentParams: OMRRecognitionParams
}

const DEFAULT_PARAMS: OMRRecognitionParams = {
  colorThreshold: 128,
  areaThreshold: 0.4,
}

/** OMRマークシート認識の実行・バッチ処理・進捗管理・結果保持を行うフック */
export function useOMRRecognition(
  options: UseOMRRecognitionOptions
): UseOMRRecognitionReturn {
  const { cells, cellConfigs, expectedCorners, pageIndex } = options

  const [state, setState] = useState<OMRRecognitionState>({
    isRecognizing: false,
    progress: null,
    sheetResults: [],
    allCellResults: [],
    error: null,
  })

  const [currentParams, setCurrentParams] = useState<OMRRecognitionParams>(
    options.params ?? DEFAULT_PARAMS
  )

  const cleanupRef = useRef<(() => void) | null>(null)

  // プログレスリスナー登録
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI?.omr) return

    const cleanup = window.electronAPI.omr.onBatchProgress((progress) => {
      setState((prev) => ({ ...prev, progress }))
    })
    cleanupRef.current = cleanup

    return () => {
      cleanup()
      cleanupRef.current = null
    }
  }, [])

  const recognizeSingle = useCallback(
    async (
      imagePath: string,
      studentId?: string
    ): Promise<OMRSheetResult | null> => {
      if (!window.electronAPI?.omr) {
        setState((prev) => ({
          ...prev,
          error: "OMR APIが利用できません",
        }))
        return null
      }

      setState((prev) => ({
        ...prev,
        isRecognizing: true,
        error: null,
      }))

      try {
        const result = await window.electronAPI.omr.recognizeSheet({
          imagePath,
          cells,
          cellConfigs,
          expectedCorners,
          params: currentParams,
          pageIndex,
          studentId,
        })

        setState((prev) => ({
          ...prev,
          isRecognizing: false,
          sheetResults: [...prev.sheetResults, result],
          allCellResults: [
            ...prev.allCellResults,
            ...result.cellResults.map((cr) => ({
              ...cr,
              studentId: result.studentId,
            })),
          ],
        }))

        return result
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isRecognizing: false,
          error: error instanceof Error ? error.message : "認識に失敗しました",
        }))
        return null
      }
    },
    [cells, cellConfigs, expectedCorners, currentParams, pageIndex]
  )

  const recognizeBatch = useCallback(
    async (
      entries: { path: string; studentId?: string; studentName?: string }[]
    ) => {
      if (!window.electronAPI?.omr) {
        setState((prev) => ({
          ...prev,
          error: "OMR APIが利用できません",
        }))
        return
      }

      setState({
        isRecognizing: true,
        progress: {
          total: entries.length,
          processed: 0,
          succeeded: 0,
          failed: 0,
        },
        sheetResults: [],
        allCellResults: [],
        error: null,
      })

      try {
        const results = await window.electronAPI.omr.batchRecognize({
          imagePaths: entries,
          cells,
          cellConfigs,
          expectedCorners,
          params: currentParams,
          pageIndex,
        })

        const allCells: Array<OMRCellResult & { studentId?: string }> = []
        for (const result of results) {
          for (const cr of result.cellResults) {
            allCells.push({ ...cr, studentId: result.studentId })
          }
        }

        setState({
          isRecognizing: false,
          progress: {
            total: entries.length,
            processed: entries.length,
            succeeded: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
          },
          sheetResults: results,
          allCellResults: allCells,
          error: null,
        })
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isRecognizing: false,
          error:
            error instanceof Error ? error.message : "バッチ認識に失敗しました",
        }))
      }
    },
    [cells, cellConfigs, expectedCorners, currentParams, pageIndex]
  )

  const clearResults = useCallback(() => {
    setState({
      isRecognizing: false,
      progress: null,
      sheetResults: [],
      allCellResults: [],
      error: null,
    })
  }, [])

  const updateParams = useCallback((params: Partial<OMRRecognitionParams>) => {
    setCurrentParams((prev) => ({ ...prev, ...params }))
  }, [])

  return {
    ...state,
    recognizeSingle,
    recognizeBatch,
    clearResults,
    updateParams,
    currentParams,
  }
}
