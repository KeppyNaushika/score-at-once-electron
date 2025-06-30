"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { FileText } from "lucide-react"
import { ExportOptions } from "../types"
import ScoringMarkSettings, { ScoringMarkConfig } from "@/components/export/ScoringMarkSettings"

interface ExportOptionsCardProps {
  exportOptions: ExportOptions
  setExportOptions: (options: ExportOptions) => void
  scoringMarkConfig: ScoringMarkConfig
  setScoringMarkConfig: (config: ScoringMarkConfig) => void
}

export function ExportOptionsCard({
  exportOptions,
  setExportOptions,
  scoringMarkConfig,
  setScoringMarkConfig,
}: ExportOptionsCardProps) {
  const updateExportOption = (key: keyof ExportOptions, value: any) => {
    setExportOptions({ ...exportOptions, [key]: value })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          出力オプション
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 出力形式 */}
        <div className="space-y-2">
          <Label>出力形式</Label>
          <Select
            value={exportOptions.format}
            onValueChange={(value: 'pdf' | 'excel') => updateExportOption('format', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="excel">Excel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* 出力内容 */}
        <div className="space-y-3">
          <Label className="text-base font-medium">出力内容</Label>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeScoredAnswers"
                checked={exportOptions.includeScoredAnswers}
                onCheckedChange={(checked) => 
                  updateExportOption('includeScoredAnswers', checked)
                }
              />
              <Label htmlFor="includeScoredAnswers">
                採点済み答案（PDF）
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeGradingData"
                checked={exportOptions.includeGradingData}
                onCheckedChange={(checked) => 
                  updateExportOption('includeGradingData', checked)
                }
              />
              <Label htmlFor="includeGradingData">
                採点データ（Excel）
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeIndividualReports"
                checked={exportOptions.includeIndividualReports}
                onCheckedChange={(checked) => 
                  updateExportOption('includeIndividualReports', checked)
                }
              />
              <Label htmlFor="includeIndividualReports">
                個人成績表（PDF）
              </Label>
            </div>
          </div>
        </div>

        {exportOptions.includeScoredAnswers && (
          <>
            <Separator />
            <ScoringMarkSettings
              config={scoringMarkConfig}
              onChange={setScoringMarkConfig}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}