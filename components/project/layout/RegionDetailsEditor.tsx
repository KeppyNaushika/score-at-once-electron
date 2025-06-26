"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal"
import { AreaType } from "@prisma/client"
import { AlertTriangle, Trash2 } from "lucide-react"
import { useState } from "react"
import { LayoutRegionArea } from "../../../types/common.types"

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

type RegionDetailsEditorProps = {
  regions: LayoutRegionArea[]
  setRegions: React.Dispatch<React.SetStateAction<LayoutRegionArea[]>>
  disabled: boolean
}

const RegionDetailsEditor = ({
  regions,
  setRegions,
  disabled,
}: RegionDetailsEditorProps) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [regionToDelete, setRegionToDelete] = useState<number | null>(null)

  const handleRegionChange = (index: number, field: keyof LayoutRegionArea, value: string | number | null) => {
    const newRegions = [...regions]
    if (field === "points" && value !== "") {
      newRegions[index] = { ...newRegions[index], [field]: parseFloat(value as string) }
    } else if (field === "points" && value === "") {
      newRegions[index] = { ...newRegions[index], [field]: null }
    } else {
      newRegions[index] = { ...newRegions[index], [field]: value }
    }
    setRegions(newRegions)
  }

  const handleDeleteRegion = (index: number) => {
    setRegionToDelete(index)
    setDeleteModalOpen(true)
  }

  const confirmDeleteRegion = () => {
    if (regionToDelete !== null) {
      const newRegions = regions.filter((_, i) => i !== regionToDelete)
      setRegions(newRegions)
      setDeleteModalOpen(false)
      setRegionToDelete(null)
    }
  }

  if (regions.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="mb-4 text-4xl">🎨</div>
        <h3 className="mb-2 text-lg font-medium">領域を作成してください</h3>
        <p className="text-muted-foreground">
          前のステップに戻って、模範解答上で領域を作成してください。
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="mb-2 text-lg font-semibold">作成した領域の詳細設定</h3>
        <p className="text-muted-foreground text-sm">
          各領域をクリックして、種類・ラベル・配点などを設定してください。
        </p>
      </div>

      <div className="space-y-4">
        {regions.map((region, index) => {
          const icon =
            typeIcons[region.type as AreaType] || typeIcons[AreaType.OTHER]

          return (
            <Card
              key={region.id || `region-${index}`}
              className="transition-all"
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{icon}</span>
                    <span className="text-base">
                      {region.label || `領域 ${index + 1}`}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      ({areaTypeToJapanese[region.type as AreaType] || "その他"}
                      )
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRegion(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">ラベル</Label>
                    <Input
                      value={region.label || ""}
                      onChange={(e) =>
                        handleRegionChange(index, "label", e.target.value)
                      }
                      disabled={disabled}
                      placeholder="領域名を入力"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">種類</Label>
                    <div className="mt-1 grid grid-cols-3 gap-1">
                      {Object.values(AreaType).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() =>
                            handleRegionChange(index, "type", type)
                          }
                          disabled={disabled}
                          className={`rounded border p-2 text-xs transition-colors ${
                            region.type === type
                              ? "bg-primary text-primary-foreground border-primary"
                              : "hover:bg-accent border-border"
                          }`}
                        >
                          {areaTypeToJapanese[type]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {region.type === AreaType.QUESTION_ANSWER && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">設問番号</Label>
                      <Input
                        value={region.questionNumber || ""}
                        onChange={(e) =>
                          handleRegionChange(
                            index,
                            "questionNumber",
                            e.target.value,
                          )
                        }
                        disabled={disabled}
                        placeholder="1, 2a, 3-1 など"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">配点</Label>
                      <Input
                        type="number"
                        value={region.points ?? ""}
                        onChange={(e) =>
                          handleRegionChange(index, "points", e.target.value)
                        }
                        disabled={disabled}
                        placeholder="10"
                      />
                    </div>
                  </div>
                )}

                <div className="text-muted-foreground bg-muted/30 rounded p-3 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      位置: ({(region.x * 100).toFixed(1)}%,{" "}
                      {(region.y * 100).toFixed(1)}%)
                    </div>
                    <div>
                      サイズ: {(region.width * 100).toFixed(1)}% ×{" "}
                      {(region.height * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h4 className="mb-2 font-medium text-blue-900">💡 ヒント</h4>
        <ul className="space-y-1 text-sm text-blue-700">
          <li>• 設問領域には必ず設問番号と配点を設定してください</li>
          <li>• 氏名・学籍番号領域は答案の識別に使用されます</li>
          <li>• 変更は自動的に保存されます</li>
        </ul>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span>領域の削除確認</span>
            </ModalTitle>
            <ModalDescription className="space-y-2">
              <p>この領域を削除しますか？</p>
              <div className="rounded border border-orange-200 bg-orange-50 p-3">
                <p className="text-sm font-medium text-orange-700">⚠️ 注意</p>
                <p className="mt-1 text-sm text-orange-600">
                  この領域に関連付けられた採点データがある場合、それらも一緒に削除されます。
                  この操作は元に戻すことができません。
                </p>
              </div>
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={confirmDeleteRegion}>
              削除する
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

export default RegionDetailsEditor
