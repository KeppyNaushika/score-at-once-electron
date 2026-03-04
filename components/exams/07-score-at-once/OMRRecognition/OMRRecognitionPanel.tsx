"use client"

import { Play, RotateCcw, Settings2 } from "lucide-react"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import type { ComputedCell } from "@/types/answerSheetLayout.types"
import type { OMRCellConfig, OMRCellResult, Point } from "@/types/omr.types"

import { useOMRRecognition } from "./hooks/useOMRRecognition"
import { OMRCellDetail } from "./OMRCellDetail"
import { OMRResultsTable } from "./OMRResultsTable"

interface OMRRecognitionPanelProps {
  /** レイアウトエンジンが計算したセル一覧 */
  cells: ComputedCell[]
  /** セルごとのOMR設定（キー: questionPath.join("-")） */
  cellConfigs: Record<string, OMRCellConfig>
  /** OMRマーカーの期待位置（0-1正規化座標） */
  expectedCorners: [Point, Point, Point, Point]
  /** 認識対象の答案画像パスリスト */
  answerEntries: {
    path: string
    studentId?: string
    studentName?: string
  }[]
  /** ページインデックス */
  pageIndex?: number
}

export function OMRRecognitionPanel({
  cells,
  cellConfigs,
  expectedCorners,
  answerEntries,
  pageIndex,
}: OMRRecognitionPanelProps) {
  const {
    isRecognizing,
    progress,
    sheetResults,
    error,
    recognizeBatch,
    clearResults,
    updateParams,
    currentParams,
  } = useOMRRecognition({
    cells,
    cellConfigs,
    expectedCorners,
    pageIndex,
  })

  const [showSettings, setShowSettings] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{
    studentId?: string
    cellResult: OMRCellResult
  } | null>(null)

  const handleRunRecognition = useCallback(() => {
    recognizeBatch(answerEntries)
  }, [recognizeBatch, answerEntries])

  const handleCellClick = useCallback(
    (studentId: string | undefined, cellResult: OMRCellResult) => {
      setSelectedCell({ studentId, cellResult })
    },
    []
  )

  const handleCellUpdate = useCallback(
    (updatedValues: string[]) => {
      // 結果テーブル上での手動修正（将来的にQuestionScoreへの書き込みに接続）
      if (selectedCell) {
        setSelectedCell({
          ...selectedCell,
          cellResult: {
            ...selectedCell.cellResult,
            recognizedValues: updatedValues,
          },
        })
      }
    },
    [selectedCell]
  )

  const progressPercent =
    progress && progress.total > 0
      ? (progress.processed / progress.total) * 100
      : 0

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">OMR自動認識</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            設定
          </Button>
          {sheetResults.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1"
              onClick={clearResults}
              disabled={isRecognizing}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              クリア
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 gap-1"
            onClick={handleRunRecognition}
            disabled={isRecognizing || answerEntries.length === 0}
          >
            <Play className="h-3.5 w-3.5" />
            {isRecognizing
              ? "認識中..."
              : `認識実行 (${answerEntries.length}件)`}
          </Button>
        </div>
      </div>

      {/* パラメータ設定 */}
      {showSettings && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                暗さ閾値: {currentParams.colorThreshold}
              </Label>
            </div>
            <Slider
              min={5}
              max={100}
              step={5}
              value={[currentParams.colorThreshold]}
              onValueChange={([v]) => updateParams({ colorThreshold: v })}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                塗りつぶし閾値: {(currentParams.areaThreshold * 100).toFixed(0)}
                %
              </Label>
            </div>
            <Slider
              min={10}
              max={90}
              step={5}
              value={[currentParams.areaThreshold * 100]}
              onValueChange={([v]) => updateParams({ areaThreshold: v / 100 })}
            />
          </div>
        </div>
      )}

      {/* プログレスバー */}
      {isRecognizing && progress && (
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>
              {progress.currentStudentName
                ? `処理中: ${progress.currentStudentName}`
                : "処理中..."}
            </span>
            <span>
              {progress.processed}/{progress.total}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 結果サマリ */}
      {!isRecognizing && progress && progress.processed > 0 && (
        <div className="text-muted-foreground flex gap-4 text-xs">
          <span>合計: {progress.total}件</span>
          <span className="text-green-600">成功: {progress.succeeded}件</span>
          <span className="text-red-600">失敗: {progress.failed}件</span>
        </div>
      )}

      {/* 結果テーブル */}
      <OMRResultsTable
        sheetResults={sheetResults}
        onCellClick={handleCellClick}
      />

      {/* セル詳細 */}
      {selectedCell && (
        <OMRCellDetail
          cellResult={selectedCell.cellResult}
          studentId={selectedCell.studentId}
          onUpdate={handleCellUpdate}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  )
}
