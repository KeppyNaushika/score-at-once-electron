"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AreaType } from "@prisma/client"
import { Trash2, Edit3 } from "lucide-react"

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
  [AreaType.QUESTION_ANSWER]: '📋',
  [AreaType.STUDENT_NAME]: '📄',
  [AreaType.STUDENT_ID]: '🔢',
  [AreaType.TOTAL_SCORE]: '🏆',
  [AreaType.SUBTOTAL_SCORE]: '🔢',
  [AreaType.MARK]: '✏️',
  [AreaType.COMMENT]: '💬',
  [AreaType.OTHER]: '📎',
}

type RegionDetailsEditorProps = {
  regions: any[]
  setRegions: React.Dispatch<React.SetStateAction<any[]>>
  disabled: boolean
}

const RegionDetailsEditor = ({
  regions,
  setRegions,
  disabled,
}: RegionDetailsEditorProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const handleRegionChange = (index: number, field: string, value: any) => {
    const newRegions = [...regions]
    if (field === "points" && value !== "") {
      newRegions[index] = { ...newRegions[index], [field]: parseFloat(value) }
    } else if (field === "points" && value === "") {
      newRegions[index] = { ...newRegions[index], [field]: null }
    } else {
      newRegions[index] = { ...newRegions[index], [field]: value }
    }
    setRegions(newRegions)
  }

  const removeRegion = (index: number) => {
    const newRegions = regions.filter((_, i) => i !== index)
    setRegions(newRegions)
    setSelectedIndex(null)
  }

  if (regions.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-4">🎨</div>
        <h3 className="text-lg font-medium mb-2">領域を作成してください</h3>
        <p className="text-muted-foreground">
          前のステップに戻って、模範解答上で領域を作成してください。
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">作成した領域の詳細設定</h3>
        <p className="text-sm text-muted-foreground">
          各領域をクリックして、種類・ラベル・配点などを設定してください。
        </p>
      </div>

      <div className="space-y-4">
        {regions.map((region, index) => {
          const isSelected = selectedIndex === index
          const icon = typeIcons[region.type as AreaType] || typeIcons[AreaType.OTHER]
          
          return (
            <Card 
              key={region.id || `region-${index}`}
              className={`cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'
              }`}
              onClick={() => setSelectedIndex(isSelected ? null : index)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{icon}</span>
                    <span className="text-base">
                      {region.label || `領域 ${index + 1}`}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({areaTypeToJapanese[region.type as AreaType] || "その他"})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedIndex(index)
                      }}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeRegion(index)
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              
              {isSelected && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">ラベル</Label>
                      <Input
                        value={region.label || ""}
                        onChange={(e) => handleRegionChange(index, "label", e.target.value)}
                        disabled={disabled}
                        placeholder="領域名を入力"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">種類</Label>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {[AreaType.QUESTION_ANSWER, AreaType.STUDENT_NAME, AreaType.STUDENT_ID, AreaType.TOTAL_SCORE].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleRegionChange(index, "type", type)}
                            disabled={disabled}
                            className={`p-2 text-xs border rounded transition-colors ${
                              region.type === type
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'hover:bg-accent border-border'
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
                          onChange={(e) => handleRegionChange(index, "questionNumber", e.target.value)}
                          disabled={disabled}
                          placeholder="1, 2a, 3-1 など"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">配点</Label>
                        <Input
                          type="number"
                          value={region.points ?? ""}
                          onChange={(e) => handleRegionChange(index, "points", e.target.value)}
                          disabled={disabled}
                          placeholder="10"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
                    <div className="grid grid-cols-2 gap-4">
                      <div>位置: ({(region.x * 100).toFixed(1)}%, {(region.y * 100).toFixed(1)}%)</div>
                      <div>サイズ: {(region.width * 100).toFixed(1)}% × {(region.height * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">💡 ヒント</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 設問領域には必ず設問番号と配点を設定してください</li>
          <li>• 氏名・学籍番号領域は答案の識別に使用されます</li>
          <li>• すべての設定が完了したら「保存」ボタンをクリックしてください</li>
        </ul>
      </div>
    </div>
  )
}

export default RegionDetailsEditor