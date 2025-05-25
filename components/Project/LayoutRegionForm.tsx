"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Prisma, AreaType } from "@prisma/client"

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
  selectedArea:
    | (Omit<
        Prisma.LayoutRegionCreateWithoutProjectLayoutInput,
        "masterImage"
      > & { id?: string; masterImageId: string })
    | null
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
    <Card>
      <CardHeader>
        <CardTitle>選択中エリア編集</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor={`area-label-${selectedAreaIndex}`}>ラベル</Label>
          <Input
            id={`area-label-${selectedAreaIndex}`}
            value={selectedArea.label || ""}
            onChange={(e) =>
              onAreaChange(selectedAreaIndex, "label", e.target.value)
            }
            disabled={disabled}
          />
        </div>
        <div>
          <Label>種類</Label>
          <div className="mt-1 grid grid-cols-4 gap-2">
            {(Object.keys(AreaType) as Array<keyof typeof AreaType>).map(
              (key) => (
                <Button
                  key={key}
                  variant={
                    selectedArea.type === AreaType[key] ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    onAreaChange(selectedAreaIndex, "type", AreaType[key])
                  }
                  disabled={disabled}
                >
                  {areaTypeToJapanese[AreaType[key]]} {/* 日本語表示に変更 */}
                </Button>
              ),
            )}
          </div>
        </div>
        {selectedArea.type === AreaType.QUESTION_ANSWER && (
          <>
            <div>
              <Label htmlFor={`area-qn-${selectedAreaIndex}`}>設問番号</Label>
              <Input
                id={`area-qn-${selectedAreaIndex}`}
                value={selectedArea.questionNumber || ""}
                onChange={(e) =>
                  onAreaChange(
                    selectedAreaIndex,
                    "questionNumber",
                    e.target.value,
                  )
                }
                disabled={disabled}
              />
            </div>
            <div>
              <Label htmlFor={`area-points-${selectedAreaIndex}`}>配点</Label>
              <Input
                id={`area-points-${selectedAreaIndex}`}
                type="number"
                value={selectedArea.points ?? ""} // nullの場合は空文字
                onChange={(e) =>
                  onAreaChange(selectedAreaIndex, "points", e.target.value)
                }
                disabled={disabled}
              />
            </div>
          </>
        )}
        {selectedArea.type === AreaType.SUBTOTAL_SCORE && (
          <div>
            <Label htmlFor={`area-src-ids-${selectedAreaIndex}`}>
              集計元エリアID (JSON)
            </Label>
            <Textarea
              id={`area-src-ids-${selectedAreaIndex}`}
              value={selectedArea.sourceAreaIdsJson || ""}
              onChange={(e) =>
                onAreaChange(
                  selectedAreaIndex,
                  "sourceAreaIdsJson",
                  e.target.value,
                )
              }
              placeholder='["id1", "id2"]'
              disabled={disabled}
            />
          </div>
        )}
        <Button
          variant="destructive"
          onClick={() => onRemoveArea(selectedAreaIndex)}
          disabled={disabled}
          className="w-full"
        >
          このエリアを削除
        </Button>
      </CardContent>
    </Card>
  )
}

export default LayoutRegionForm
