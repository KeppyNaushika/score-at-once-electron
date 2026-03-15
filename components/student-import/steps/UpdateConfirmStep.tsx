"use client"

import { ChevronRight } from "lucide-react"
import { useEffect, useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { StudentImportWizard } from "@/hooks/student-import/useStudentImportWizard"
import type { MatchedItem, UpdateStrategy } from "@/types/examArchive.types"

interface UpdateConfirmStepProps {
  wizard: StudentImportWizard
}

interface FieldChange {
  field: string
  fieldLabel: string
  currentValue: unknown
  newValue: unknown
}

interface UpdateableItem {
  key: string
  displayLabel: string
  importData: Record<string, unknown>
  existingData: Record<string, unknown>
  fieldChanges: FieldChange[]
}

const STUDENT_FIELD_LABELS: Record<string, string> = {
  studentNumber: "学籍番号",
  lastName: "姓",
  firstName: "名",
  lastNameKana: "姓カナ",
  firstNameKana: "名カナ",
  enrollmentYear: "入学年度",
}

const CLASS_FIELD_LABELS: Record<string, string> = {
  name: "学級名",
  classCode: "学級コード",
  grade: "学年",
  description: "説明",
}

function detectFieldChanges(
  importData: Record<string, unknown>,
  existingData: Record<string, unknown>,
  fieldLabels: Record<string, string>
): FieldChange[] {
  const changes: FieldChange[] = []
  for (const [field, label] of Object.entries(fieldLabels)) {
    const importVal = importData[field]
    const existingVal = existingData[field]
    if (importVal !== existingVal && importVal !== undefined) {
      changes.push({
        field,
        fieldLabel: label,
        currentValue: existingVal,
        newValue: importVal,
      })
    }
  }
  return changes
}

function extractUpdateableItems(
  matchedItems: MatchedItem[],
  category: "student" | "class",
  fieldLabels: Record<string, string>
): UpdateableItem[] {
  const items: UpdateableItem[] = []
  for (const item of matchedItems) {
    const changes = detectFieldChanges(
      item.importData,
      item.existingData,
      fieldLabels
    )
    if (changes.length > 0) {
      items.push({
        key: `${category}:${item.importId}`,
        displayLabel: item.displayLabel,
        importData: item.importData,
        existingData: item.existingData,
        fieldChanges: changes,
      })
    }
  }
  return items
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "（未設定）"
  return String(value)
}

export function UpdateConfirmStep({ wizard }: UpdateConfirmStepProps) {
  const { state, setFieldUpdateDecision, setBulkUpdateStrategy, goToNextStep } =
    wizard

  const { student, class: classResult } = state.fileOverviewData ?? {
    student: { byId: [], noMatch: [] },
    class: { byId: [], noMatch: [] },
  }

  // 同一人物と判定されたアイテム（byId + by二次照合で same_person のもの）のフィールド変更を検出
  const updateableItems = useMemo(() => {
    const allStudentMatched = [
      ...student.byId,
      ...(student.byStudentNumber ?? []),
      ...(student.byName ?? []),
    ]
    const allClassMatched = [...classResult.byId, ...(classResult.byName ?? [])]

    return [
      ...extractUpdateableItems(
        allStudentMatched,
        "student",
        STUDENT_FIELD_LABELS
      ),
      ...extractUpdateableItems(allClassMatched, "class", CLASS_FIELD_LABELS),
    ]
  }, [student, classResult])

  // 初期値を設定（keep_existing をデフォルトに）
  useEffect(() => {
    for (const item of updateableItems) {
      for (const change of item.fieldChanges) {
        if (!state.updateDecisions[item.key]?.[change.field]) {
          setFieldUpdateDecision(item.key, change.field, "keep_existing")
        }
      }
    }
  }, [updateableItems, state.updateDecisions, setFieldUpdateDecision])

  if (!state.fileOverviewData) return null

  if (updateableItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <div className="text-center">
          <h3 className="text-lg font-semibold">更新するデータはありません</h3>
          <p className="text-muted-foreground mt-2 text-sm">
            紐づけたデータに差異はありませんでした
          </p>
        </div>
        <Button onClick={goToNextStep} className="gap-2">
          次へ
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">情報の更新確認</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          紐づけたデータに違いがあります。どちらの情報を使うか選んでください
        </p>
      </div>

      {/* 一括操作 */}
      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBulkUpdateStrategy("keep_existing")}
        >
          すべてこのPCの値を使う
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBulkUpdateStrategy("use_import")}
        >
          すべてファイルの値を使う
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBulkUpdateStrategy("use_newer")}
        >
          すべて新しい方を使う
        </Button>
      </div>

      {/* アイテム一覧 */}
      <div className="space-y-4">
        {updateableItems.map((item) => (
          <div
            key={item.key}
            className="border-border/50 rounded-lg border p-4"
          >
            <h4 className="mb-3 font-medium">{item.displayLabel}</h4>
            <div className="space-y-3">
              {item.fieldChanges.map((change) => {
                const currentStrategy =
                  state.updateDecisions[item.key]?.[change.field] ??
                  "keep_existing"

                return (
                  <div
                    key={change.field}
                    className="bg-muted/30 rounded-md p-3"
                  >
                    <div className="mb-2 text-sm font-medium">
                      {change.fieldLabel}
                    </div>
                    <RadioGroup
                      value={currentStrategy}
                      onValueChange={(value: string) =>
                        setFieldUpdateDecision(
                          item.key,
                          change.field,
                          value as UpdateStrategy
                        )
                      }
                      className="space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value="keep_existing"
                          id={`${item.key}-${change.field}-keep`}
                        />
                        <Label
                          htmlFor={`${item.key}-${change.field}-keep`}
                          className="text-sm"
                        >
                          このPC: {formatValue(change.currentValue)}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value="use_import"
                          id={`${item.key}-${change.field}-import`}
                        />
                        <Label
                          htmlFor={`${item.key}-${change.field}-import`}
                          className="text-sm"
                        >
                          ファイル: {formatValue(change.newValue)}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value="use_newer"
                          id={`${item.key}-${change.field}-newer`}
                        />
                        <Label
                          htmlFor={`${item.key}-${change.field}-newer`}
                          className="text-sm"
                        >
                          新しい方を使う
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center pt-4">
        <Button onClick={goToNextStep} className="gap-2">
          次へ
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
