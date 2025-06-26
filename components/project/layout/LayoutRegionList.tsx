"use client"

import { AreaType } from "@prisma/client"
import { LayoutRegionArea } from "../../../types/common.types"

type LayoutRegionListProps = {
  areas: LayoutRegionArea[]
  selectedAreaIndex: number | null
  onSelectArea: (index: number) => void
  disabled: boolean
}

const LayoutRegionList = ({
  areas,
  selectedAreaIndex,
  onSelectArea,
  disabled,
}: LayoutRegionListProps) => {
  const typeIcons = {
    [AreaType.QUESTION_ANSWER]: "📋",
    [AreaType.STUDENT_NAME]: "📄",
    [AreaType.STUDENT_ID]: "🔢",
    [AreaType.TOTAL_SCORE]: "🏆",
    [AreaType.SUBTOTAL_SCORE]: "🔢",
    [AreaType.MARK]: "✏️",
    [AreaType.COMMENT]: "💬",
    [AreaType.OTHER]: "📎",
  }

  const typeLabels = {
    [AreaType.QUESTION_ANSWER]: "設問",
    [AreaType.STUDENT_NAME]: "氏名",
    [AreaType.STUDENT_ID]: "番号",
    [AreaType.TOTAL_SCORE]: "合計",
    [AreaType.SUBTOTAL_SCORE]: "小計",
    [AreaType.MARK]: "マーク",
    [AreaType.COMMENT]: "コメント",
    [AreaType.OTHER]: "その他",
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium">作成した領域 ({areas.length})</h3>
        {areas.length > 0 && (
          <p className="text-muted-foreground text-xs">
            領域をクリックして詳細情報を編集
          </p>
        )}
      </div>

      {areas.length === 0 ? (
        <div className="text-muted-foreground border-muted-foreground/25 rounded-lg border-2 border-dashed py-8 text-center">
          <div className="mb-3 text-3xl">🎨</div>
          <p className="text-base font-medium">領域を作成してください</p>
          <p className="mt-2 text-sm">
            上の模範解答上でマウスをドラッグして領域を作成できます
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {areas.map((area, index) => {
            const isSelected = selectedAreaIndex === index
            const icon =
              typeIcons[area.type as AreaType] || typeIcons[AreaType.OTHER]
            const typeLabel =
              typeLabels[area.type as AreaType] || typeLabels[AreaType.OTHER]

            return (
              <button
                key={area.id || `new-${index}`}
                type="button"
                onClick={() => onSelectArea(index)}
                disabled={disabled}
                className={`rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-lg"
                    : "bg-background hover:bg-accent border-border"
                }`}
              >
                <div className="mb-1 flex items-center space-x-2">
                  <span className="text-lg">{icon}</span>
                  <div>
                    <div className="text-sm font-medium">
                      {area.label || `領域 ${index + 1}`}
                    </div>
                    <div className="text-xs opacity-75">
                      {typeLabel}
                      {area.type === AreaType.QUESTION_ANSWER &&
                        area.points &&
                        ` (${area.points}点)`}
                    </div>
                  </div>
                </div>
                <div className="text-xs opacity-60">
                  {(area.x * 100).toFixed(0)}%, {(area.y * 100).toFixed(0)}%
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default LayoutRegionList
