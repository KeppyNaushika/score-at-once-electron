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

type DataSourceType = "project_total" | "subtotal" | "crop_region" | "manual"

interface AddDataSourceInlineProps {
  gradeItemId: string
  onCreate: (data: {
    gradeItemId: string
    type: string
    examId?: string
    subtotalId?: string
    cropRegionId?: string
    name: string
    maxScore: number
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

export function AddDataSourceInline({
  gradeItemId,
  onCreate,
  onCreated,
}: AddDataSourceInlineProps) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<DataSourceType>("project_total")
  const [exams, setExams] = useState<ExamOption[]>([])
  const [selectedExamId, setSelectedExamId] = useState("")
  const [subtotalGroups, setSubtotalGroups] = useState<SubtotalGroupOption[]>(
    []
  )
  const [selectedSubtotalGroupId, setSelectedSubtotalGroupId] = useState("")
  const [selectedSubtotalId, setSelectedSubtotalId] = useState("")
  const [cropRegions, setCropRegions] = useState<CropRegionOption[]>([])
  const [selectedCropRegionId, setSelectedCropRegionId] = useState("")
  const [name, setName] = useState("")
  const [maxScore, setMaxScore] = useState("")
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

  // 満点自動計算
  const autoCalcMaxScore = useCallback(async () => {
    if (type === "manual") return
    if (!selectedExamId) return

    const data: {
      type: string
      examId?: string
      subtotalId?: string
      cropRegionId?: string
    } = { type }

    if (type === "project_total") {
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
      if (result.success && result.maxScore !== undefined) {
        setMaxScore(String(result.maxScore))
        if (!weight) setWeight(String(result.maxScore))
      }
    }
  }, [type, selectedExamId, selectedSubtotalId, selectedCropRegionId, weight])

  useEffect(() => {
    autoCalcMaxScore()
  }, [autoCalcMaxScore])

  // 名前の自動設定
  useEffect(() => {
    if (type === "manual") return
    const exam = exams.find((p) => p.id === selectedExamId)
    if (!exam) return

    if (type === "project_total") {
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
    if (!name.trim() || !maxScore || !weight) return
    setAdding(true)
    try {
      const data: Parameters<typeof onCreate>[0] = {
        gradeItemId,
        type,
        name: name.trim(),
        maxScore: Number(maxScore),
        weight: Number(weight),
      }
      if (type !== "manual") {
        data.examId = selectedExamId || undefined
      }
      if (type === "subtotal") {
        data.subtotalId = selectedSubtotalId || undefined
      }
      if (type === "crop_region") {
        data.cropRegionId = selectedCropRegionId || undefined
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
    setType("project_total")
    setSelectedExamId("")
    setSelectedSubtotalGroupId("")
    setSelectedSubtotalId("")
    setSelectedCropRegionId("")
    setName("")
    setMaxScore("")
    setWeight("")
  }

  const selectedSubtotals =
    subtotalGroups.find((sg) => sg.id === selectedSubtotalGroupId)?.subtotals ??
    []

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
            setName("")
            setMaxScore("")
            setWeight("")
          }}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="project_total">全設問合計</SelectItem>
            <SelectItem value="subtotal">小計点</SelectItem>
            <SelectItem value="crop_region">設問</SelectItem>
            <SelectItem value="manual">外部成績</SelectItem>
          </SelectContent>
        </Select>

        {/* 試験試験選択 */}
        {type !== "manual" && (
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
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 flex-1"
          placeholder="名前"
        />
        <Input
          value={maxScore}
          onChange={(e) => setMaxScore(e.target.value)}
          className="h-8 w-20"
          type="number"
          placeholder="満点"
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
          disabled={!name.trim() || !maxScore || !weight || adding}
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
