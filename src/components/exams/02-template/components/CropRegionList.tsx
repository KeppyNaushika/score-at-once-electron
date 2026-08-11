"use client"

import {
  Ellipsis,
  FileText,
  Hash,
  ListOrdered,
  MessageSquare,
  Palette,
  Pencil,
  Trophy,
  User,
} from "lucide-react"
import type { ComponentType } from "react"

import type { CropRegionArea } from "@/components/exams/02-template/types"

type CropRegionListProps = {
  areas: CropRegionArea[]
  selectedAreaIndex: number | null
  onSelectArea: (index: number) => void
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

const typeLabels = {
  QUESTION_ANSWER: "設問",
  STUDENT_NAME: "氏名",
  STUDENT_ID: "番号",
  TOTAL_SCORE: "合計",
  SUBTOTAL_SCORE: "小計",
  MARK: "マーク",
  COMMENT: "コメント",
  OTHER: "その他",
}

const CropRegionList = ({
  areas,
  selectedAreaIndex,
  onSelectArea,
  disabled,
}: CropRegionListProps) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b bg-background p-4">
        <h3 className="text-lg font-medium">領域一覧 ({areas.length})</h3>
        {areas.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            領域をクリックして詳細情報を編集
          </p>
        )}
      </div>

      <div className="scrollbar-overlay flex-1 overflow-auto p-4">
        {areas.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 py-8 text-center text-muted-foreground">
            <Palette className="mx-auto mb-3 h-10 w-10 text-muted-foreground/70" />
            <p className="text-base font-medium">領域を作成してください</p>
            <p className="mt-2 text-sm">
              左の模範解答上でマウスをドラッグして領域を作成できます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {areas.map((area, index) => {
              const isSelected = selectedAreaIndex === index
              const IconComponent =
                typeIcons[area.type as keyof typeof typeIcons] ||
                typeIcons["OTHER"]
              const typeLabel =
                typeLabels[area.type as keyof typeof typeLabels] ||
                typeLabels["OTHER"]

              return (
                <button
                  key={area.id || `new-${index}`}
                  type="button"
                  onClick={() => onSelectArea(index)}
                  disabled={disabled}
                  className={`w-full rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-lg"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                >
                  <div className="mb-1 flex items-center space-x-2">
                    <IconComponent
                      className={`h-4 w-4 shrink-0 ${
                        isSelected
                          ? "text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {area.label || `領域 ${index + 1}`}
                      </div>
                      <div className="text-xs opacity-75">
                        {typeLabel}
                        {area.type === "QUESTION_ANSWER" &&
                          area.points &&
                          ` (${area.points}点)`}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs opacity-60">
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
