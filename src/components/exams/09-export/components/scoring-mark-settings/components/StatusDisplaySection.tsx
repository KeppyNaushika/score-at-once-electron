"use client"

import Image from "next/image"

import { statusLabels } from "@/components/exams/09-export/components/scoring-mark-settings/constants/scoringMarkConstants"
import { getMarkImagePath } from "@/components/exams/09-export/components/scoring-mark-settings/utils/scoringMarkUtils"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { AnswerOverlayVisibility } from "@/types/scoringOverlay.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

interface StatusDisplaySectionProps {
  visibility: Record<ScoringStatus, AnswerOverlayVisibility>
  onMarkStatusChange: (status: ScoringStatus, show: boolean) => void
  onScoreStatusChange: (status: ScoringStatus, show: boolean) => void
}

export function StatusDisplaySection({
  visibility,
  onMarkStatusChange,
  onScoreStatusChange,
}: StatusDisplaySectionProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 左側：採点マーク表示対象 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">📌 採点マーク表示対象</Label>
        <div className="space-y-2">
          {(Object.keys(statusLabels) as ScoringStatus[]).map((status) => {
            const markImagePath = getMarkImagePath(status)
            return (
              <div
                key={`mark-${status}`}
                className="flex items-center space-x-3"
              >
                <Checkbox
                  id={`mark-${status}`}
                  checked={visibility[status].showMark}
                  onCheckedChange={(checked) =>
                    onMarkStatusChange(status, checked === true)
                  }
                />
                <div className="flex items-center space-x-2">
                  {markImagePath === null ? (
                    // 類型評価は記号（A/B/C など）を文字で印刷する。見本は記号の例
                    <span className="flex h-6 w-6 items-center justify-center text-base font-bold text-red-600">
                      A
                    </span>
                  ) : (
                    <Image
                      src={markImagePath}
                      alt={statusLabels[status]}
                      className="h-6 w-6"
                      width={24}
                      height={24}
                      unoptimized
                    />
                  )}
                  <Label
                    htmlFor={`mark-${status}`}
                    className="cursor-pointer text-sm"
                  >
                    {statusLabels[status]}
                  </Label>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 右側：点数表示対象 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">🔢 点数表示対象</Label>
        <div className="space-y-2">
          {(Object.keys(statusLabels) as ScoringStatus[]).map((status) => (
            <div
              key={`score-${status}`}
              className="flex items-center space-x-3"
            >
              <Checkbox
                id={`score-${status}`}
                checked={visibility[status].showScore}
                onCheckedChange={(checked) =>
                  onScoreStatusChange(status, checked === true)
                }
              />
              <div className="flex items-center space-x-2">
                <span className="flex h-6 w-6 items-center justify-center rounded border text-sm font-bold text-red-600">
                  10
                </span>
                <Label
                  htmlFor={`score-${status}`}
                  className="cursor-pointer text-sm"
                >
                  {statusLabels[status]}
                </Label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
