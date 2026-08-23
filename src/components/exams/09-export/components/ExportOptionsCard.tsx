"use client"

import { Download } from "lucide-react"

import { CaptureReturnVersionButton } from "@/components/exams/09-export/components/CaptureReturnVersionButton"
import { IndividualReportSettings } from "@/components/exams/09-export/components/IndividualReportSettings"
import { ScoringMarkSettingsContainer } from "@/components/exams/09-export/components/scoring-mark-settings/components/ScoringMarkSettingsContainer"
import type {
  ExportOptions,
  PdfOrientation,
} from "@/components/exams/09-export/types"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { IndividualReportOptions } from "@/types/individualReport.types"
import type { AnswerOverlaySettings } from "@/types/scoringOverlay.types"

export type ExportTabType =
  "scored-answers" | "grading-data" | "individual-reports"

interface ExportOptionsCardProps {
  examId: string
  exportOptions: ExportOptions
  setExportOptions: (options: ExportOptions) => void
  answerOverlaySettings: AnswerOverlaySettings
  setAnswerOverlaySettings: (config: AnswerOverlaySettings) => void
  individualReportOptions: IndividualReportOptions
  setIndividualReportOptions: (options: IndividualReportOptions) => void
  selectedStudents: Set<string>
  isExporting: boolean
  onExportScoredAnswers: () => void
  onExportGradingData: () => void
  onExportRData: (format: "csv" | "json") => void
  onExportIndividualReports: () => void
  /** 指定生徒を返却版として記録する */
  captureReturn: (examStudentIds: string[]) => Promise<boolean>
  /** 返却版記録の実行中フラグ */
  capturingReturn: boolean
  activeTab: ExportTabType
  onTabChange: (tab: ExportTabType) => void
}

/**
 * ダウンロードボタン（可変幅）＋返却版記録ボタン（固定幅）の行。
 * スクロール領域の外に固定表示する用途で使う。記録ボタンは共通コンポーネントを
 * 呼び出し側で生成して captureButton として受け取る。
 */
function DownloadRow({
  downloadLabel,
  onDownload,
  disabled,
  noStudentSelected,
  captureButton,
}: {
  downloadLabel: string
  onDownload: () => void
  disabled: boolean
  noStudentSelected: boolean
  captureButton: React.ReactNode
}) {
  return (
    <div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          size="lg"
          onClick={onDownload}
          disabled={disabled}
        >
          <Download className="mr-2 h-4 w-4" />
          {downloadLabel}
        </Button>
        {captureButton}
      </div>
      {noStudentSelected && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          生徒を選択してください
        </p>
      )}
    </div>
  )
}

export function ExportOptionsCard({
  examId,
  exportOptions,
  setExportOptions,
  answerOverlaySettings,
  setAnswerOverlaySettings,
  individualReportOptions,
  setIndividualReportOptions,
  selectedStudents,
  isExporting,
  onExportScoredAnswers,
  onExportGradingData,
  onExportRData,
  onExportIndividualReports,
  captureReturn,
  capturingReturn,
  activeTab,
  onTabChange,
}: ExportOptionsCardProps) {
  const noStudentSelected = selectedStudents.size === 0

  // 記録ボタンは全タブ共通（左カードの ReturnDiffPanel と同一コンポーネント）
  const captureButton = (
    <CaptureReturnVersionButton
      selectedExamStudentIds={Array.from(selectedStudents)}
      capturing={capturingReturn}
      capture={captureReturn}
      label="返却版として記録"
      size="lg"
      className="w-44 shrink-0"
    />
  )
  const handleOrientationChange = (value: PdfOrientation) => {
    setExportOptions({
      ...exportOptions,
      pdfOrientation: value,
    })
  }

  const handleParallelCountChange = (value: number[]) => {
    setExportOptions({
      ...exportOptions,
      parallelCount: value[0],
    })
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => onTabChange(v as ExportTabType)}
      className="flex h-full w-full flex-col"
    >
      <TabsList className="grid w-full shrink-0 grid-cols-3">
        <TabsTrigger value="scored-answers" className="text-xs">
          採点済み答案PDF
        </TabsTrigger>
        <TabsTrigger value="grading-data" className="text-xs">
          採点データExcel
        </TabsTrigger>
        <TabsTrigger value="individual-reports" className="text-xs">
          個人成績表PDF
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="scored-answers"
        className="mt-4 flex min-h-0 flex-1 flex-col gap-4"
      >
        {/* ダウンロードボタン（スクロール外に固定） */}
        <div className="shrink-0">
          <DownloadRow
            downloadLabel="採点済み答案PDFをダウンロード"
            onDownload={onExportScoredAnswers}
            disabled={noStudentSelected || isExporting}
            noStudentSelected={noStudentSelected}
            captureButton={captureButton}
          />
        </div>

        <div className="relative min-h-0 flex-1 space-y-4 overflow-y-auto">
          {/* PDF用紙設定 */}
          <div className="space-y-3">
            <h4 className="text-base font-semibold">PDF用紙設定</h4>
            <div>
              <Label className="text-sm font-medium">用紙の向き</Label>
              <div className="mt-2 flex gap-2">
                <Button
                  variant={
                    exportOptions.pdfOrientation === "portrait"
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => handleOrientationChange("portrait")}
                >
                  A4縦 (ポートレート)
                </Button>
                <Button
                  variant={
                    exportOptions.pdfOrientation === "landscape"
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => handleOrientationChange("landscape")}
                >
                  A4横 (ランドスケープ)
                </Button>
              </div>
            </div>
          </div>

          {/* 並列処理設定 */}
          <div className="space-y-3">
            <h4 className="text-base font-semibold">処理設定</h4>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">並列処理数</Label>
                <span className="text-sm font-medium">
                  {exportOptions.parallelCount}
                </span>
              </div>
              <Slider
                value={[exportOptions.parallelCount]}
                onValueChange={handleParallelCountChange}
                min={1}
                max={8}
                step={1}
                className="mt-2"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                値を大きくすると処理が速くなりますが、メモリ使用量が増えます
              </p>
            </div>
          </div>

          {/* 採点マーク設定 */}
          <ScoringMarkSettingsContainer
            config={answerOverlaySettings}
            onChange={setAnswerOverlaySettings}
          />
        </div>
      </TabsContent>

      <TabsContent
        value="grading-data"
        className="mt-4 flex min-h-0 flex-1 flex-col gap-4"
      >
        {/* ダウンロードボタン（スクロール外に固定） */}
        <div className="shrink-0">
          <DownloadRow
            downloadLabel="採点データExcelをダウンロード"
            onDownload={onExportGradingData}
            disabled={noStudentSelected || isExporting}
            noStudentSelected={noStudentSelected}
            captureButton={captureButton}
          />
        </div>

        <div className="relative min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="space-y-3">
            <h4 className="text-base font-semibold">Excel出力設定</h4>
            <p className="text-sm text-muted-foreground">
              採点データをExcel形式で出力します。設定は現在ありません。
            </p>
          </div>

          {/* R / exametrika 向けデータ出力（#834） */}
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-base font-semibold">
              分析用データ（R / exametrika）
            </h4>
            <p className="text-sm text-muted-foreground">
              設問×生徒の正誤行列を出力します。欠席・未採点は欠測値として扱います。
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onExportRData("csv")}
                disabled={selectedStudents.size === 0 || isExporting}
              >
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onExportRData("json")}
                disabled={selectedStudents.size === 0 || isExporting}
              >
                <Download className="mr-2 h-4 w-4" />
                JSON
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent
        value="individual-reports"
        className="mt-4 flex min-h-0 flex-1 flex-col gap-4"
      >
        {/* ダウンロードボタン（スクロール外に固定） */}
        <div className="shrink-0">
          <DownloadRow
            downloadLabel="個人成績表PDFをダウンロード"
            onDownload={onExportIndividualReports}
            disabled={noStudentSelected || isExporting}
            noStudentSelected={noStudentSelected}
            captureButton={captureButton}
          />
        </div>

        <div className="relative min-h-0 flex-1 space-y-4 overflow-y-auto">
          {/* 設定パネル */}
          <IndividualReportSettings
            examId={examId}
            options={individualReportOptions}
            onChange={setIndividualReportOptions}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}
