"use client"

import {
  ExportOptions,
  PdfOrientation,
} from "@/app/projects/[projectId]/08-export/types"
import ScoringMarkSettings, { ScoringMarkConfig } from "./ScoringMarkSettings"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

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
  const handleOrientationChange = (value: PdfOrientation) => {
    setExportOptions({
      ...exportOptions,
      pdfOrientation: value,
    })
  }

  return (
    <div className="space-y-4">
      {/* PDF用紙の向き設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">PDF用紙設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">用紙の向き</Label>
            <RadioGroup
              value={exportOptions.pdfOrientation}
              onValueChange={handleOrientationChange}
              className="mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="portrait" id="portrait" />
                <Label htmlFor="portrait" className="text-sm">
                  A4縦 (ポートレート)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="landscape" id="landscape" />
                <Label htmlFor="landscape" className="text-sm">
                  A4横 (ランドスケープ)
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* 採点マーク設定 */}
      <ScoringMarkSettings
        config={scoringMarkConfig}
        onChange={setScoringMarkConfig}
      />
    </div>
  )
}
