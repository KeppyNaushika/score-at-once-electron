"use client"

import {
  Ellipsis,
  FileText,
  Hash,
  ListOrdered,
  MessageSquare,
  Pencil,
  SquareDashedMousePointer,
  Trophy,
  User,
} from "lucide-react"
import type { ComponentType } from "react"

import type { CropRegionArea } from "@/components/exams/02-template/types"
import { CROP_REGION_AREA_TYPE_LABELS } from "@/lib/cropRegionAreaTypeLabels"
import { toCropRegionAreaType } from "@/types/cropRegionAreaType.types"

type CropRegionListProps = {
  areas: CropRegionArea[]
  selectedCropRegionId: string | null
  onSelectArea: (cropRegionId: string) => void
  disabled: boolean
}

type IconType = ComponentType<{ className?: string }>

const typeIcons: Record<string, IconType> = {
  QUESTION_ANSWER: FileText,
  STUDENT_NAME: User,
  STUDENT_ID: Hash,
  TOTAL_SCORE: Trophy,
  SUBTOTAL_SCORE: ListOrdered,
  MARK: Pencil,
  COMMENT: MessageSquare,
  OTHER: Ellipsis,
}

const CropRegionList = ({
  areas,
  selectedCropRegionId,
  onSelectArea,
  disabled,
}: CropRegionListProps) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b bg-background p-3">
        <h3 className="text-sm font-medium">領域一覧 ({areas.length})</h3>
        {areas.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            クリックで選択できます。ラベルや配点は「3. 領域設定」で編集します
          </p>
        )}
      </div>

      <div className="scrollbar-overlay flex-1 overflow-auto p-3">
        {areas.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 py-8 text-center text-muted-foreground">
            <SquareDashedMousePointer className="mx-auto mb-2 h-8 w-8 text-muted-foreground/70" />
            <p className="text-sm font-medium">領域を作成してください</p>
            <p className="mt-1 text-xs">
              左の模範解答上でマウスをドラッグして領域を作成できます
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {areas.map((area, index) => {
              const isSelected = selectedCropRegionId === area.id
              const IconComponent =
                typeIcons[area.type as keyof typeof typeIcons] ||
                typeIcons["OTHER"]
              const typeLabel =
                CROP_REGION_AREA_TYPE_LABELS[toCropRegionAreaType(area.type)]

              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => onSelectArea(area.id)}
                  disabled={disabled}
                  className={`w-full rounded-md border px-2 py-1.5 text-left transition-all hover:shadow-md ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-lg"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <IconComponent
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isSelected
                          ? "text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">
                        {area.label || `領域 ${index + 1}`}
                      </div>
                      <div className="text-[11px] opacity-75">
                        {typeLabel}
                        {area.type === "QUESTION_ANSWER" &&
                          area.points &&
                          ` (${area.points}点)`}
                      </div>
                    </div>
                  </div>
                  <div className="pl-5.5 text-[11px] opacity-60">
                    位置: {(area.x * 100).toFixed(0)}%,{" "}
                    {(area.y * 100).toFixed(0)}%
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default CropRegionList
