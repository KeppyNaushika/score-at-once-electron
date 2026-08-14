"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type CourseworkCandidate,
  courseworkCandidatesQuery,
} from "@/queries/coursework"
import {
  createDataSourceMutation,
  gradeExamCandidatesQuery,
  gradeExamCropRegionsQuery,
  gradeExamSubtotalGroupsQuery,
} from "@/queries/grade"
import type { GradeDataSourceInput } from "@/types/grade.types"

import { useDataSourceDefaults } from "./hooks/useDataSourceDefaults"
import {
  type AddDataSourceSelection,
  type AddDataSourceType,
  COURSEWORK_WHOLE,
  type CropRegionOption,
  type ExamOption,
  isSameSelection,
  type SubtotalGroupOption,
  toAddDataSourceType,
} from "./types"

/** 試験未選択時に渡す空配列。毎レンダー新しい配列を作ると算出フックが回り続けるため定数にする */
const EMPTY_SUBTOTAL_GROUPS: SubtotalGroupOption[] = []
const EMPTY_CROP_REGIONS: CropRegionOption[] = []
const EMPTY_EXAMS: ExamOption[] = []
const EMPTY_COURSEWORKS: CourseworkCandidate[] = []

interface AddDataSourceInlineProps {
  gradeId: string
  gradeItemId: string
}

export function AddDataSourceInline({
  gradeId,
  gradeItemId,
}: AddDataSourceInlineProps) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<AddDataSourceType>("exam_total")
  const [selectedExamId, setSelectedExamId] = useState("")
  const [selectedSubtotalGroupId, setSelectedSubtotalGroupId] = useState("")
  const [selectedSubtotalId, setSelectedSubtotalId] = useState("")
  const [selectedCropRegionId, setSelectedCropRegionId] = useState("")
  // coursework型: 資料→評価項目の2段選択
  const [selectedCourseworkId, setSelectedCourseworkId] = useState("")
  const [selectedCourseworkItemId, setSelectedCourseworkItemId] = useState("")
  // 名前と換算満点は選択内容から導く。ユーザーが手入力したときだけ下書きが優先される。
  // 「どの選択に対して入力したか」を同梱することで、選択が変われば下書きは自動的に無効になる
  // （Select ごとに破棄を呼ぶ形にすると、呼び忘れた経路で前の設問の名前が残る）
  const [draft, setDraft] = useState<{
    selection: AddDataSourceSelection
    name: string
    weight: string
  } | null>(null)
  const createDataSource = useMutation(createDataSourceMutation(gradeId))

  // 候補は開いたときだけ取る
  const { data: exams = EMPTY_EXAMS } = useQuery({
    ...gradeExamCandidatesQuery(),
    enabled: open,
  })
  const { data: courseworks = EMPTY_COURSEWORKS } = useQuery({
    ...courseworkCandidatesQuery(),
    enabled: open,
  })

  // 試験に紐づく選択肢。どの試験の結果かはキーが持つので、
  // 切り替え直後に前の試験の選択肢が残ることはない
  const { data: subtotalGroups = EMPTY_SUBTOTAL_GROUPS } = useQuery({
    ...gradeExamSubtotalGroupsQuery(selectedExamId),
    enabled: Boolean(selectedExamId),
  })
  const { data: cropRegions = EMPTY_CROP_REGIONS } = useQuery({
    ...gradeExamCropRegionsQuery(selectedExamId),
    enabled: Boolean(selectedExamId),
  })

  const selection = useMemo(
    () => ({
      type,
      examId: selectedExamId,
      subtotalId: selectedSubtotalId,
      cropRegionId: selectedCropRegionId,
      courseworkId: selectedCourseworkId,
      courseworkItemId: selectedCourseworkItemId,
    }),
    [
      type,
      selectedExamId,
      selectedSubtotalId,
      selectedCropRegionId,
      selectedCourseworkId,
      selectedCourseworkItemId,
    ]
  )

  const { defaultName, defaultWeight } = useDataSourceDefaults({
    selection,
    exams,
    subtotalGroups,
    cropRegions,
    courseworks,
  })

  const activeDraft =
    draft && isSameSelection(draft.selection, selection) ? draft : null

  // 空文字は「消しただけ」で確定した入力ではないので既定値へ戻す。
  // そうしないと欄を空にしたまま既定値が復活せず、追加ボタンが押せない袋小路になる
  const name = activeDraft?.name || defaultName
  const weight = activeDraft?.weight || defaultWeight

  const editDraft = (edited: { name?: string; weight?: string }) => {
    setDraft({
      selection,
      name: activeDraft?.name ?? "",
      weight: activeDraft?.weight ?? "",
      ...edited,
    })
  }

  const handleAdd = async () => {
    if (!name.trim() || !weight) return
    // 資料全体が選ばれた場合は coursework_total 型（資料IDを参照）へ切り替える
    const isWhole =
      type === "coursework" && selectedCourseworkItemId === COURSEWORK_WHOLE
    const dataSourceInput: GradeDataSourceInput = {
      gradeItemId,
      type: isWhole ? "coursework_total" : type,
      name: name.trim(),
      weight: Number(weight),
    }
    if (type !== "coursework") {
      dataSourceInput.examId = selectedExamId || undefined
    }
    if (type === "subtotal") {
      dataSourceInput.subtotalId = selectedSubtotalId || undefined
    }
    if (type === "crop_region") {
      dataSourceInput.cropRegionId = selectedCropRegionId || undefined
    }
    if (type === "coursework") {
      if (isWhole) {
        dataSourceInput.courseworkId = selectedCourseworkId || undefined
      } else {
        dataSourceInput.courseworkItemId = selectedCourseworkItemId || undefined
      }
    }
    await createDataSource.mutateAsync(dataSourceInput)
    resetForm()
  }

  const resetForm = () => {
    setOpen(false)
    setType("exam_total")
    setSelectedExamId("")
    setSelectedSubtotalGroupId("")
    setSelectedSubtotalId("")
    setSelectedCropRegionId("")
    setSelectedCourseworkId("")
    setSelectedCourseworkItemId("")
    setDraft(null)
  }

  const selectedSubtotals =
    subtotalGroups.find(
      (subtotalGroup) => subtotalGroup.id === selectedSubtotalGroupId
    )?.subtotals ?? []

  const selectedCourseworkItems =
    courseworks.find((coursework) => coursework.id === selectedCourseworkId)
      ?.items ?? []

  // coursework型は評価項目を必須選択にするための判定（満点は元データ追従で入力欄なし）
  const isCoursework = type === "coursework"

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-1 h-3 w-3" />
        データソース追加
      </Button>
    )
  }

  return (
    <div className="space-y-3 rounded border border-dashed p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Type選択 */}
        <Select
          value={type}
          onValueChange={(value) => {
            setType(toAddDataSourceType(value))
            setSelectedExamId("")
            setSelectedSubtotalGroupId("")
            setSelectedSubtotalId("")
            setSelectedCropRegionId("")
            setSelectedCourseworkId("")
            setSelectedCourseworkItemId("")
          }}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="exam_total">全設問合計</SelectItem>
            <SelectItem value="subtotal">小計点</SelectItem>
            <SelectItem value="crop_region">設問</SelectItem>
            <SelectItem value="coursework">試験外成績資料</SelectItem>
          </SelectContent>
        </Select>

        {/* 試験試験選択 */}
        {type !== "coursework" && (
          <Select value={selectedExamId} onValueChange={setSelectedExamId}>
            <SelectTrigger className="h-8 w-48">
              <SelectValue placeholder="試験を選択" />
            </SelectTrigger>
            <SelectContent>
              {exams.map((examOption) => (
                <SelectItem key={examOption.id} value={examOption.id}>
                  {examOption.examName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Subtotal選択 (subtotalタイプ) */}
        {type === "subtotal" && selectedExamId && subtotalGroups.length > 0 && (
          <>
            <Select
              value={selectedSubtotalGroupId}
              onValueChange={(value) => {
                setSelectedSubtotalGroupId(value)
                setSelectedSubtotalId("")
              }}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue placeholder="観点グループ" />
              </SelectTrigger>
              <SelectContent>
                {subtotalGroups.map((subtotalGroup) => (
                  <SelectItem key={subtotalGroup.id} value={subtotalGroup.id}>
                    {subtotalGroup.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSubtotals.length > 0 && (
              <Select
                value={selectedSubtotalId}
                onValueChange={setSelectedSubtotalId}
              >
                <SelectTrigger className="h-8 w-36">
                  <SelectValue placeholder="観点" />
                </SelectTrigger>
                <SelectContent>
                  {selectedSubtotals.map((subtotal) => (
                    <SelectItem key={subtotal.id} value={subtotal.id}>
                      {subtotal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}

        {/* CropRegion選択 */}
        {type === "crop_region" && selectedExamId && cropRegions.length > 0 && (
          <Select
            value={selectedCropRegionId}
            onValueChange={setSelectedCropRegionId}
          >
            <SelectTrigger className="h-8 w-48">
              <SelectValue placeholder="設問を選択" />
            </SelectTrigger>
            <SelectContent>
              {cropRegions.map((cropRegion) => (
                <SelectItem key={cropRegion.id} value={cropRegion.id}>
                  {cropRegion.label} ({cropRegion.points ?? 0}点)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* coursework型: 資料→評価項目の2段選択 */}
        {type === "coursework" && (
          <>
            <Select
              value={selectedCourseworkId}
              onValueChange={(value) => {
                setSelectedCourseworkId(value)
                // 資料を切り替えたら評価項目の選択をやり直させる
                setSelectedCourseworkItemId("")
              }}
            >
              <SelectTrigger className="h-8 w-48">
                <SelectValue placeholder="資料を選択" />
              </SelectTrigger>
              <SelectContent>
                {courseworks.map((coursework) => (
                  <SelectItem key={coursework.id} value={coursework.id}>
                    {coursework.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCourseworkId && (
              <Select
                value={selectedCourseworkItemId}
                onValueChange={setSelectedCourseworkItemId}
              >
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="評価項目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COURSEWORK_WHOLE}>（資料全体）</SelectItem>
                  {selectedCourseworkItems.map((courseworkItem) => (
                    <SelectItem
                      key={courseworkItem.id}
                      value={courseworkItem.id}
                    >
                      {courseworkItem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => editDraft({ name: e.target.value })}
          className="h-8 flex-1"
          placeholder="名前"
        />
        <Input
          value={weight}
          onChange={(e) => editDraft({ weight: e.target.value })}
          className="h-8 w-20"
          type="text"
          placeholder="換算満点"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={
            !name.trim() ||
            !weight ||
            createDataSource.isPending ||
            (isCoursework && !selectedCourseworkItemId)
          }
        >
          追加
        </Button>
        <Button variant="ghost" size="sm" onClick={resetForm}>
          取消
        </Button>
      </div>
    </div>
  )
}
