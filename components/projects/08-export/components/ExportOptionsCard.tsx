"use client"

import {
  ExportOptions,
  PdfOrientation,
} from "@/app/projects/[projectId]/08-export/types"
import ScoringMarkSettings, {
  ScoringMarkConfig,
} from "@/components/projects/08-export/components/ScoringMarkSettings"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download } from "lucide-react"

interface ExportOptionsCardProps {
  exportOptions: ExportOptions
  setExportOptions: (options: ExportOptions) => void
  scoringMarkConfig: ScoringMarkConfig
  setScoringMarkConfig: (config: ScoringMarkConfig) => void
  selectedStudents: Set<string>
  isExporting: boolean
  onExportScoredAnswers: () => void
  onExportGradingData: () => void
  onExportIndividualReports: () => void
}

export function ExportOptionsCard({
  exportOptions,
  setExportOptions,
  scoringMarkConfig,
  setScoringMarkConfig,
  selectedStudents,
  isExporting,
  onExportScoredAnswers,
  onExportGradingData,
  onExportIndividualReports,
}: ExportOptionsCardProps) {
  const handleOrientationChange = (value: PdfOrientation) => {
    setExportOptions({
      ...exportOptions,
      pdfOrientation: value,
    })
  }

  return (
    <Tabs defaultValue="scored-answers" className="flex h-full w-full flex-col">
      <TabsList className="grid w-full flex-shrink-0 grid-cols-3">
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
            disabled
            onClick={onExportIndividualReports}
          >
            <Download className="mr-2 h-4 w-4" />
            個人成績表PDFをダウンロード（開発中）
          </Button>
        </div>

        <div className="space-y-3">
          <h4 className="text-base font-semibold">個人成績表設定</h4>
          <p className="text-muted-foreground text-sm">
            個人成績表PDFの出力機能は現在開発中です。
          </p>
        </div>
      </TabsContent>
    </Tabs>
  )
}
