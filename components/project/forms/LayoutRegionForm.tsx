"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AreaType } from "@prisma/client"

// AreaTypeの日本語表示マッピング
const areaTypeToJapanese: Record<AreaType, string> = {
  STUDENT_NAME: "氏名",
  STUDENT_ID: "生徒番号",
  QUESTION_ANSWER: "設問解答",
  TOTAL_SCORE: "合計点",
  SUBTOTAL_SCORE: "小計",
  MARK: "マーク",
  COMMENT: "コメント",
  OTHER: "その他",
}

type LayoutRegionFormProps = {
  selectedArea: any | null
  selectedAreaIndex: number | null
  onAreaChange: (index: number, field: string, value: any) => void
  onRemoveArea: (index: number) => void
  disabled: boolean
}

const LayoutRegionForm = ({
  selectedArea,
  selectedAreaIndex,
  onAreaChange,
  onRemoveArea,
  disabled,
}: LayoutRegionFormProps) => {
  if (!selectedArea || selectedAreaIndex === null) return null

  return (
    <div className="space-y-4 border-t p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">選択中の領域</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemoveArea(selectedAreaIndex)}
          disabled={disabled}
          className="text-destructive hover:text-destructive"
        >
          削除
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs font-medium">ラベル</Label>
          <Input
            value={selectedArea.label || ""}
            onChange={(e) =>
              onAreaChange(selectedAreaIndex, "label", e.target.value)
            }
            disabled={disabled}
            className="h-8 text-sm"
            placeholder="領域名を入力"
          />
        </div>

        <div>
          <Label className="text-xs font-medium">種類</Label>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {[
              AreaType.QUESTION_ANSWER,
              AreaType.STUDENT_NAME,
              AreaType.STUDENT_ID,
              AreaType.TOTAL_SCORE,
            ].map((type) => (
              <button
                key={type}
                onClick={() => onAreaChange(selectedAreaIndex, "type", type)}
                disabled={disabled}
                className={`rounded border p-1 text-xs transition-colors ${
                  selectedArea.type === type
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-accent border-border"
                }`}
              >
                {areaTypeToJapanese[type]}
              </button>
            ))}
          </div>
        </div>

        {selectedArea.type === AreaType.QUESTION_ANSWER && (
          <>
            <div>
              <Label className="text-xs font-medium">設問番号</Label>
              <Input
                value={selectedArea.questionNumber || ""}
                onChange={(e) =>
                  onAreaChange(
                    selectedAreaIndex,
                    "questionNumber",
                    e.target.value,
                  )
                }
                disabled={disabled}
                className="h-8 text-sm"
                placeholder="1, 2a, 3-1 など"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">配点</Label>
              <Input
                type="number"
                value={selectedArea.points ?? ""}
                onChange={(e) =>
                  onAreaChange(selectedAreaIndex, "points", e.target.value)
                }
                disabled={disabled}
                className="h-8 text-sm"
                placeholder="10"
              />
            </div>
          </>
        )}

        <div className="text-muted-foreground space-y-1 text-xs">
          <div>
            位置: ({(selectedArea.x * 100).toFixed(1)}%,{" "}
            {(selectedArea.y * 100).toFixed(1)}%)
          </div>
          <div>
            サイズ: {(selectedArea.width * 100).toFixed(1)}% ×{" "}
            {(selectedArea.height * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  )
}

export default LayoutRegionForm
