"use client"

import { Download } from "lucide-react"

import {
  ExportOptions,
  IndividualReportOptions,
  PdfOrientation,
} from "@/app/exams/[examId]/08-export/types"
import { IndividualReportSettings } from "@/components/exams/08-export/components/IndividualReportSettings"
import ScoringMarkSettings, {
  ScoringMarkConfig,
} from "@/components/exams/08-export/components/ScoringMarkSettings"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type ExportTabType =
  | "scored-answers"
  | "grading-data"
  | "individual-reports"

interface ExportOptionsCardProps {
  examId: string
  exportOptions: ExportOptions
  setExportOptions: (options: ExportOptions) => void
  scoringMarkConfig: ScoringMarkConfig
  setScoringMarkConfig: (config: ScoringMarkConfig) => void
  individualReportOptions: IndividualReportOptions
  setIndividualReportOptions: (options: IndividualReportOptions) => void
  selectedStudents: Set<string>
  isExporting: boolean
  onExportScoredAnswers: () => void
  onExportGradingData: () => void
  onExportIndividualReports: () => void
  activeTab: ExportTabType
  onTabChange: (tab: ExportTabType) => void
}

export function ExportOptionsCard({
  examId,
  exportOptions,
  setExportOptions,
  scoringMarkConfig,
  setScoringMarkConfig,
  individualReportOptions,
  setIndividualReportOptions,
  selectedStudents,
  isExporting,
  onExportScoredAnswers,
  onExportGradingData,
  onExportIndividualReports,
  activeTab,
  onTabChange,
}: ExportOptionsCardProps) {
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
        className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto"
      >
        {/* ダウンロードボタン */}
        <div>
          <Button
            className="w-full"
            size="lg"
            onClick={onExportScoredAnswers}
            disabled={selectedStudents.size === 0 || isExporting}
          >
            <Download className="mr-2 h-4 w-4" />
            採点済み答案PDFをダウンロード
          </Button>
          {selectedStudents.size === 0 && (
            <p className="text-muted-foreground mt-2 text-center text-xs">
              生徒を選択してください
            </p>
          )}
        </div>

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
            <p className="text-muted-foreground mt-1 text-xs">
              値を大きくすると処理が速くなりますが、メモリ使用量が増えます
            </p>
          </div>
        </div>

        {/* 採点マーク設定 */}
        <ScoringMarkSettings
          config={scoringMarkConfig}
          onChange={setScoringMarkConfig}
        />
      </TabsContent>

      <TabsContent
        value="grading-data"
        className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto"
      >
        {/* ダウンロードボタン */}
        <div>
          <Button
            className="w-full"
            size="lg"
            onClick={onExportGradingData}
            disabled={selectedStudents.size === 0 || isExporting}
          >
            <Download className="mr-2 h-4 w-4" />
            採点データExcelをダウンロード
          </Button>
          {selectedStudents.size === 0 && (
            <p className="text-muted-foreground mt-2 text-center text-xs">
              生徒を選択してください
            </p>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-base font-semibold">Excel出力設定</h4>
          <p className="text-muted-foreground text-sm">
            採点データをExcel形式で出力します。設定は現在ありません。
          </p>
        </div>
      </TabsContent>

      <TabsContent
        value="individual-reports"
        className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto"
      >
        {/* ダウンロードボタン */}
        <div>
          <Button
            className="w-full"
            size="lg"
            onClick={onExportIndividualReports}
            disabled={selectedStudents.size === 0 || isExporting}
          >
            <Download className="mr-2 h-4 w-4" />
            個人成績表PDFをダウンロード
          </Button>
          {selectedStudents.size === 0 && (
            <p className="text-muted-foreground mt-2 text-center text-xs">
              生徒を選択してください
            </p>
          )}
        </div>

        {/* 設定パネル */}
        <IndividualReportSettings
          examId={examId}
          options={individualReportOptions}
          onChange={setIndividualReportOptions}
        />
      </TabsContent>
    </Tabs>
  )
}
