"use client"

import Image from "next/image"

import { statusLabels } from "@/components/exams/08-export/components/scoring-mark-settings/constants/scoringMarkConstants"
import type { ScoringStatus } from "@/components/exams/08-export/components/scoring-mark-settings/types/scoringMarkTypes"
import { getMarkImagePath } from "@/components/exams/08-export/components/scoring-mark-settings/utils/scoringMarkUtils"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface StatusDisplaySectionProps {
  showMarkForStatus: Record<ScoringStatus, boolean>
  showScoreForStatus: Record<ScoringStatus, boolean>
  useTransparent: boolean
  onMarkStatusChange: (status: ScoringStatus, show: boolean) => void
  onScoreStatusChange: (status: ScoringStatus, show: boolean) => void
}

export function StatusDisplaySection({
  showMarkForStatus,
  showScoreForStatus,
  useTransparent,
  onMarkStatusChange,
  onScoreStatusChange,
}: StatusDisplaySectionProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 左側：採点マーク表示対象 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">📌 採点マーク表示対象</Label>
        <div className="space-y-2">
          {(Object.keys(statusLabels) as ScoringStatus[]).map((status) => (
            <div key={`mark-${status}`} className="flex items-center space-x-3">
              <Checkbox
                id={`mark-${status}`}
                checked={showMarkForStatus[status]}
                onCheckedChange={(checked) =>
                  onMarkStatusChange(status, checked as boolean)
                }
              />
              <div className="flex items-center space-x-2">
                <Image
                  src={getMarkImagePath(status, useTransparent)}
                  alt={statusLabels[status]}
                  className="h-6 w-6"
                  width={24}
                  height={24}
                  unoptimized
                />
                <Label
                  htmlFor={`mark-${status}`}
                  className="cursor-pointer text-sm"
                >
                  {statusLabels[status]}
                </Label>
              </div>
            </div>
          ))}
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
                checked={showScoreForStatus[status]}
                onCheckedChange={(checked) =>
                  onScoreStatusChange(status, checked as boolean)
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
