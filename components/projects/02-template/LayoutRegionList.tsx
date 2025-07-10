"use client"

import { LayoutRegionArea } from "@/types/common.types"

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
    QUESTION_ANSWER: "📋",
    STUDENT_NAME: "📄",
    STUDENT_ID: "🔢",
    TOTAL_SCORE: "🏆",
    SUBTOTAL_SCORE: "🔢",
    MARK: "✏️",
    COMMENT: "💬",
    OTHER: "📎",
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

  return (
    <div className="flex h-full flex-col">
      <div className="bg-background flex-shrink-0 border-b p-4">
        <h3 className="text-lg font-medium">領域一覧 ({areas.length})</h3>
        {areas.length > 0 && (
          <p className="text-muted-foreground mt-1 text-xs">
            領域をクリックして詳細情報を編集
          </p>
        )}
      </div>

      <div className="scrollbar-overlay flex-1 overflow-auto p-4">
        {areas.length === 0 ? (
          <div className="text-muted-foreground border-muted-foreground/25 rounded-lg border-2 border-dashed py-8 text-center">
            <div className="mb-3 text-3xl">🎨</div>
            <p className="text-base font-medium">領域を作成してください</p>
            <p className="mt-2 text-sm">
              左の模範解答上でマウスをドラッグして領域を作成できます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {areas.map((area, index) => {
              const isSelected = selectedAreaIndex === index
              const icon =
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
                      ? "bg-primary text-primary-foreground border-primary shadow-lg"
                      : "bg-background hover:bg-accent border-border"
                  }`}
                >
                  <div className="mb-1 flex items-center space-x-2">
                    <span className="text-lg">{icon}</span>
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

export default LayoutRegionList
