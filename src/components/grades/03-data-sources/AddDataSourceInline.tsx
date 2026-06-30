"use client"

import { Plus } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type DataSourceType = "exam_total" | "subtotal" | "crop_region" | "coursework"

interface AddDataSourceInlineProps {
  gradeItemId: string
  onCreate: (data: {
    gradeItemId: string
    type: string
    examId?: string
    subtotalId?: string
    cropRegionId?: string
    courseworkItemId?: string
    name: string
    weight: number
  }) => Promise<{ success: boolean }>
  onCreated: () => void
}

interface ExamOption {
  id: string
  examName: string
  examDate: Date | null
}

interface SubtotalGroupOption {
  id: string
  name: string
  subtotals: { id: string; name: string; order: number }[]
}

interface CropRegionOption {
  id: string
  label: string
  points: number | null
}

interface CourseworkOption {
  id: string
  name: string
  date: string | null
  items: {
    id: string
    name: string
    maxScore: number
    inputMode: string
    order: number
  }[]
}

export function AddDataSourceInline({
  gradeItemId,
  onCreate,
  onCreated,
}: AddDataSourceInlineProps) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<DataSourceType>("exam_total")
  const [exams, setExams] = useState<ExamOption[]>([])
  const [selectedExamId, setSelectedExamId] = useState("")
  const [subtotalGroups, setSubtotalGroups] = useState<SubtotalGroupOption[]>(
    []
  )
  const [selectedSubtotalGroupId, setSelectedSubtotalGroupId] = useState("")
  const [selectedSubtotalId, setSelectedSubtotalId] = useState("")
  const [cropRegions, setCropRegions] = useState<CropRegionOption[]>([])
  const [selectedCropRegionId, setSelectedCropRegionId] = useState("")
  // coursework型: 資料→評価項目の2段選択
  const [courseworks, setCourseworks] = useState<CourseworkOption[]>([])
  const [selectedCourseworkId, setSelectedCourseworkId] = useState("")
  const [selectedCourseworkItemId, setSelectedCourseworkItemId] = useState("")
  const [name, setName] = useState("")
  const [weight, setWeight] = useState("")
  const [adding, setAdding] = useState(false)

  // 全試験候補をロード
  useEffect(() => {
    if (!open) return
    const load = async () => {
      const result = await window.electronAPI.grade.getExamCandidates()
      if (result.success && result.exams) {
        setExams(result.exams)
      }
    }
    load()
  }, [open])

  // 試験外成績資料の候補をロード
  useEffect(() => {
    if (!open) return
    const load = async () => {
      const result = await window.electronAPI.coursework.getCandidates()
      if (result.success && result.courseworks) {
        setCourseworks(result.courseworks)
      }
    }
    load()
  }, [open])

  // 試験選択時にSubtotalGroups/CropRegionsをロード
  useEffect(() => {
    if (!selectedExamId) {
      setSubtotalGroups([])
      setCropRegions([])
      return
    }
    const load = async () => {
      const [sgResult, crResult] = await Promise.all([
        window.electronAPI.grade.getExamSubtotalGroups(selectedExamId),
        window.electronAPI.grade.getExamCropRegions(selectedExamId),
      ])
      if (sgResult.success && sgResult.subtotalGroups) {
        setSubtotalGroups(sgResult.subtotalGroups)
      }
      if (crResult.success && crResult.cropRegions) {
        setCropRegions(crResult.cropRegions)
      }
    }
    load()
  }, [selectedExamId])

  // 換算満点の初期値を元データの満点から補完（満点自体は保存せず元データ追従）
  const autoSeedWeight = useCallback(async () => {
    if (type === "coursework") return
    if (!selectedExamId) return

    const data: {
      type: string
      examId?: string
      subtotalId?: string
      cropRegionId?: string
    } = { type }

    if (type === "exam_total") {
      data.examId = selectedExamId
    } else if (type === "subtotal") {
      data.examId = selectedExamId
      data.subtotalId = selectedSubtotalId
    } else if (type === "crop_region") {
      data.cropRegionId = selectedCropRegionId
    }

    if (data.examId || data.cropRegionId) {
      const result =
        await window.electronAPI.grade.calculateSourceMaxScore(data)
      // 満点が未確定（0）の段階では weight を埋めない。
      if (
        !weight &&
        result.success &&
        result.maxScore !== undefined &&
        result.maxScore > 0
      ) {
        setWeight(String(result.maxScore))
      }
    }
  }, [type, selectedExamId, selectedSubtotalId, selectedCropRegionId, weight])

  useEffect(() => {
    autoSeedWeight()
  }, [autoSeedWeight])

  // coursework型: 評価項目選択時に換算満点・名前を補完
  useEffect(() => {
    if (type !== "coursework") return
    const coursework = courseworks.find((c) => c.id === selectedCourseworkId)
    const item = coursework?.items.find(
      (i) => i.id === selectedCourseworkItemId
    )
    if (coursework && item) {
      setWeight((prev) => (prev ? prev : String(item.maxScore)))
      setName(`${coursework.name}(${item.name})`)
    }
  }, [type, selectedCourseworkId, selectedCourseworkItemId, courseworks])

  // 名前の自動設定（試験系）
  useEffect(() => {
    if (type === "coursework") return
    const exam = exams.find((p) => p.id === selectedExamId)
    if (!exam) return

    if (type === "exam_total") {
      setName(`${exam.examName}(合計)`)
    } else if (type === "subtotal" && selectedSubtotalId) {
      const sg = subtotalGroups.find((g) =>
        g.subtotals.some((s) => s.id === selectedSubtotalId)
      )
      const subtotal = sg?.subtotals.find((s) => s.id === selectedSubtotalId)
      if (subtotal) {
        setName(`${exam.examName}(${subtotal.name})`)
      }
    } else if (type === "crop_region" && selectedCropRegionId) {
      const cr = cropRegions.find((r) => r.id === selectedCropRegionId)
      if (cr) {
        setName(`${exam.examName}(${cr.label})`)
      }
    }
  }, [
    type,
    selectedExamId,
    selectedSubtotalId,
    selectedCropRegionId,
    exams,
    subtotalGroups,
    cropRegions,
  ])

  const handleAdd = async () => {
    if (!name.trim() || !weight) return
    setAdding(true)
    try {
      const data: Parameters<typeof onCreate>[0] = {
        gradeItemId,
        type,
        name: name.trim(),
        weight: Number(weight),
      }
      if (type !== "coursework") {
        data.examId = selectedExamId || undefined
      }
      if (type === "subtotal") {
        data.subtotalId = selectedSubtotalId || undefined
      }
      if (type === "crop_region") {
        data.cropRegionId = selectedCropRegionId || undefined
      }
      if (type === "coursework") {
        data.courseworkItemId = selectedCourseworkItemId || undefined
      }
      const result = await onCreate(data)
      if (result.success) {
        resetForm()
        onCreated()
      }
    } finally {
      setAdding(false)
    }
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
    setName("")
    setWeight("")
  }

  const selectedSubtotals =
    subtotalGroups.find((sg) => sg.id === selectedSubtotalGroupId)?.subtotals ??
    []

  const selectedCourseworkItems =
    courseworks.find((c) => c.id === selectedCourseworkId)?.items ?? []

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
          onValueChange={(v) => {
            setType(v as DataSourceType)
            setSelectedExamId("")
            setSelectedSubtotalGroupId("")
            setSelectedSubtotalId("")
            setSelectedCropRegionId("")
            setSelectedCourseworkId("")
            setSelectedCourseworkItemId("")
            setName("")
            setWeight("")
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
              {exams.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.examName}
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
              onValueChange={(v) => {
                setSelectedSubtotalGroupId(v)
                setSelectedSubtotalId("")
              }}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue placeholder="観点グループ" />
              </SelectTrigger>
              <SelectContent>
                {subtotalGroups.map((sg) => (
                  <SelectItem key={sg.id} value={sg.id}>
                    {sg.name}
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
                  {selectedSubtotals.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
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
              {cropRegions.map((cr) => (
                <SelectItem key={cr.id} value={cr.id}>
                  {cr.label} ({cr.points ?? 0}点)
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
              onValueChange={(v) => {
                setSelectedCourseworkId(v)
                // 資料を切り替えたら項目選択と補完値をリセット（古い名前/換算満点の残留を防ぐ）
                setSelectedCourseworkItemId("")
                setName("")
                setWeight("")
              }}
            >
              <SelectTrigger className="h-8 w-48">
                <SelectValue placeholder="資料を選択" />
              </SelectTrigger>
              <SelectContent>
                {courseworks.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCourseworkItems.length > 0 && (
              <Select
                value={selectedCourseworkItemId}
                onValueChange={setSelectedCourseworkItemId}
              >
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="評価項目" />
                </SelectTrigger>
                <SelectContent>
                  {selectedCourseworkItems.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
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
          onChange={(e) => setName(e.target.value)}
          className="h-8 flex-1"
          placeholder="名前"
        />
        <Input
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
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
            adding ||
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
