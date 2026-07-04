"use client"

import {
  CheckSquare,
  Eye,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Search,
  Square,
  Users,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useGradeResults } from "@/hooks/grades/useGradeResults"

import { ExcelExportTab } from "./ExcelExportTab"
import { generateGradeReportBatchHtml } from "./generateGradeReportHtml"
import { GradeExcelPreview } from "./GradeExcelPreview"
import { IndividualReportTab } from "./IndividualReportTab"
import { PreviewPane } from "./PreviewPane"
import {
  DEFAULT_GRADE_REPORT_OPTIONS,
  type GradeExportTabType,
  type GradeReportOptions,
} from "./types"

interface ExportContainerProps {
  gradeId: string
}

export function ExportContainer({ gradeId }: ExportContainerProps) {
  const { result, loading, error, recalculate } = useGradeResults(gradeId)

  // 生徒選択（共有ステート）
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(
    new Set()
  )
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClass, setSelectedClass] = useState<string>("__all__")
  const [selectionTab, setSelectionTab] = useState<"selection" | "preview">(
    "selection"
  )
  const [previewStudentId, setPreviewStudentId] = useState("")

  // 個人成績通知書オプション
  const [reportOptions, setReportOptionsState] = useState<GradeReportOptions>(
    DEFAULT_GRADE_REPORT_OPTIONS
  )
  const settingsInitializedRef = useRef(false)

  // マウント時にDB設定をロード
  useEffect(() => {
    if (settingsInitializedRef.current) return
    settingsInitializedRef.current = true

    const loadSettings = async () => {
      if (!window.electronAPI?.grade) return
      try {
        const result = await window.electronAPI.grade.getExportSettings(gradeId)
        if (result.success && result.settings?.reportOptions) {
          const saved = result.settings
            .reportOptions as Partial<GradeReportOptions>
          // ネストした列選択は新フィールド欠落を防ぐためデフォルトと深くマージ
          setReportOptionsState({
            ...DEFAULT_GRADE_REPORT_OPTIONS,
            ...saved,
            itemGradeColumns: {
              ...DEFAULT_GRADE_REPORT_OPTIONS.itemGradeColumns,
              ...saved.itemGradeColumns,
            },
            sourceBreakdownColumns: {
              ...DEFAULT_GRADE_REPORT_OPTIONS.sourceBreakdownColumns,
              ...saved.sourceBreakdownColumns,
            },
            footer: {
              ...DEFAULT_GRADE_REPORT_OPTIONS.footer,
              ...saved.footer,
            },
          })
        }
      } catch (error) {
        console.error("成績算出エクスポート設定の読み込みに失敗:", error)
      }
    }
    loadSettings()
  }, [gradeId])

  // 変更時にDBへ保存するラッパー
  const setReportOptions = useCallback(
    (
      options:
        GradeReportOptions | ((prev: GradeReportOptions) => GradeReportOptions)
    ) => {
      setReportOptionsState((prev) => {
        const newOptions =
          typeof options === "function" ? options(prev) : options

        // バックグラウンドで保存（read-modify-write）
        if (window.electronAPI?.grade) {
          window.electronAPI.grade
            .getExportSettings(gradeId)
            .then((result) => {
              const currentSettings =
                result.success && result.settings ? result.settings : {}
              return window.electronAPI.grade.saveExportSettings(gradeId, {
                ...currentSettings,
                reportOptions: newOptions,
              })
            })
            .catch((error: unknown) => {
              console.error("成績算出エクスポート設定の保存に失敗:", error)
            })
        }

        return newOptions
      })
    },
    [gradeId]
  )

  // 出力タブ
  const [exportTab, setExportTab] = useState<GradeExportTabType>("excel")

  const studentsRef = useMemo(() => result?.students ?? [], [result])

  // result が来たら全員選択を初期化
  useMemo(() => {
    if (studentsRef.length > 0 && selectedStudents.size === 0) {
      setSelectedStudents(
        new Set(studentsRef.map((student) => student.studentId))
      )
      setPreviewStudentId(studentsRef[0]?.studentId ?? "")
    }
  }, [studentsRef]) // eslint-disable-line react-hooks/exhaustive-deps

  const classNames = useMemo(() => {
    const names = new Set<string>()
    for (const student of studentsRef) {
      if (student.className) names.add(student.className)
    }
    return Array.from(names).sort()
  }, [studentsRef])

  const filteredStudents = useMemo(() => {
    return studentsRef.filter((student) => {
      if (selectedClass !== "__all__" && student.className !== selectedClass)
        return false
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const name = `${student.lastName} ${student.firstName}`.toLowerCase()
        const studentNumberLower = student.studentNumber?.toLowerCase() ?? ""
        if (!name.includes(term) && !studentNumberLower.includes(term))
          return false
      }
      return true
    })
  }, [studentsRef, selectedClass, searchTerm])

  const selectAllFiltered = () => {
    const ids = filteredStudents.map((student) => student.studentId)
    setSelectedStudents((prev) => new Set([...prev, ...ids]))
  }

  const deselectAllFiltered = () => {
    const filteredIds = new Set(
      filteredStudents.map((student) => student.studentId)
    )
    setSelectedStudents(
      (prev) => new Set([...prev].filter((id) => !filteredIds.has(id)))
    )
  }

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedStudentIds = useMemo(() => {
    return studentsRef
      .filter((student) => selectedStudents.has(student.studentId))
      .map((student) => student.studentId)
  }, [studentsRef, selectedStudents])

  const previewHtml = useMemo(() => {
    if (!result || !previewStudentId || exportTab !== "individual-report")
      return ""
    return generateGradeReportBatchHtml(
      result,
      [previewStudentId],
      reportOptions
    )
  }, [result, previewStudentId, reportOptions, exportTab])

  // ─── ローディング / エラー ───────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">成績データを読み込み中...</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={recalculate}>
          <RefreshCw className="mr-2 h-4 w-4" />
          再計算
        </Button>
      </div>
    )
  }
  if (!result) return null

  // ─── メインレイアウト ────────────────────────────────────────────
  // ExportMainView と同じ構造:
  //   root: flex h-full flex-col
  //   header: shrink-0
  //   content wrapper: min-h-0 flex-1 (padding はここ)
  //   grid: h-full  ← グリッドセルが h-full を使うために必須
  //   grid cells: h-full min-h-0
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ヘッダー */}
      <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">出力: {result.gradeName}</h2>
          <p className="text-muted-foreground text-sm">
            {result.classNames.join("、") || "学級未登録"} /{" "}
            {result.students.length}名
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={recalculate}>
          <RefreshCw className="mr-2 h-4 w-4" />
          再計算
        </Button>
      </div>

      {/* コンテンツ: padding はここに集約 */}
      <div className="min-h-0 flex-1 p-6">
        <div className="grid h-full grid-cols-1 grid-rows-[1fr] gap-6 lg:grid-cols-2">
          {/* ───── 左列: 生徒選択 + プレビュー ───── */}
          <div className="h-full min-h-0">
            <Tabs
              value={selectionTab}
              onValueChange={(value) =>
                setSelectionTab(value as "selection" | "preview")
              }
              className="flex h-full flex-col rounded-lg border p-4"
            >
              <TabsList className="mb-2 grid w-full shrink-0 grid-cols-2">
                <TabsTrigger value="selection" className="gap-1">
                  <Users className="h-4 w-4" />
                  生徒選択
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-1">
                  <Eye className="h-4 w-4" />
                  プレビュー
                </TabsTrigger>
              </TabsList>

              {/* ── 生徒選択タブ ── */}
              <TabsContent
                value="selection"
                className="mt-0 flex min-h-0 flex-1 flex-col"
              >
                <div className="mb-2 shrink-0">
                  <div className="relative">
                    <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
                    <Input
                      placeholder="名前または学籍番号で検索"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8 pl-8 text-sm"
                    />
                  </div>
                </div>

                <div className="mb-2 flex shrink-0 items-center justify-between">
                  {classNames.length > 1 && (
                    <Select
                      value={selectedClass}
                      onValueChange={setSelectedClass}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">全学級</SelectItem>
                        {classNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={selectAllFiltered}
                    >
                      <CheckSquare className="mr-1 h-3 w-3" />
                      全選択
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={deselectAllFiltered}
                    >
                      <Square className="mr-1 h-3 w-3" />
                      全解除
                    </Button>
                  </div>
                </div>

                {/* 生徒リスト（このdivだけスクロール） */}
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="text-muted-foreground mb-1 flex shrink-0 items-center justify-between text-xs">
                    <span>生徒一覧</span>
                    <span>
                      {selectedStudents.size}人選択中 /{" "}
                      {filteredStudents.length}人表示中
                    </span>
                  </div>
                  <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto rounded-md border p-1.5">
                    {filteredStudents.map((student) => (
                      <div
                        key={student.studentId}
                        className="hover:bg-muted flex items-center space-x-2 rounded p-1"
                      >
                        <Checkbox
                          id={`student-${student.studentId}`}
                          checked={selectedStudents.has(student.studentId)}
                          onCheckedChange={() =>
                            toggleStudent(student.studentId)
                          }
                          className="h-4 w-4"
                        />
                        <Label
                          htmlFor={`student-${student.studentId}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs">
                              {student.lastName} {student.firstName}
                            </span>
                            <div className="flex items-center gap-1">
                              {student.attendanceNumber != null && (
                                <span className="text-muted-foreground bg-muted rounded px-1 text-xs">
                                  {student.attendanceNumber}
                                </span>
                              )}
                              {student.className && (
                                <span className="text-muted-foreground text-xs">
                                  {student.className}
                                </span>
                              )}
                            </div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* ── プレビュータブ ── */}
              <TabsContent
                value="preview"
                className="mt-0 flex min-h-0 flex-1 flex-col"
              >
                {exportTab === "excel" ? (
                  selectedStudentIds.length === 0 ? (
                    <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border bg-gray-100">
                      <p className="text-muted-foreground text-sm">
                        生徒を選択してください
                      </p>
                    </div>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-auto rounded-md border p-2">
                      <GradeExcelPreview
                        result={result}
                        selectedStudentIds={selectedStudentIds}
                      />
                    </div>
                  )
                ) : selectedStudentIds.length === 0 ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border bg-gray-100">
                    <p className="text-muted-foreground text-sm">
                      生徒を選択してください
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-2 flex shrink-0 items-center gap-2">
                      <Label className="shrink-0 text-xs">生徒:</Label>
                      <Select
                        value={previewStudentId}
                        onValueChange={setPreviewStudentId}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {result.students
                            .filter((student) =>
                              selectedStudents.has(student.studentId)
                            )
                            .map((student) => (
                              <SelectItem
                                key={student.studentId}
                                value={student.studentId}
                              >
                                {student.attendanceNumber ?? "-"}{" "}
                                {student.lastName} {student.firstName}
                                {student.className
                                  ? ` (${student.className})`
                                  : ""}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {previewHtml && <PreviewPane html={previewHtml} />}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* ───── 右列: 出力設定 ───── */}
          {/* overflow-y-auto で設定が長くなっても右列だけスクロール */}
          <div className="h-full min-h-0 overflow-y-auto">
            <div className="rounded-lg border p-4">
              <Tabs
                value={exportTab}
                onValueChange={(value) =>
                  setExportTab(value as GradeExportTabType)
                }
              >
                <TabsList className="mb-4 w-full">
                  <TabsTrigger
                    value={"excel" satisfies GradeExportTabType}
                    className="flex-1"
                  >
                    <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                    Excel出力
                  </TabsTrigger>
                  <TabsTrigger
                    value={"individual-report" satisfies GradeExportTabType}
                    className="flex-1"
                  >
                    <FileText className="mr-1.5 h-4 w-4" />
                    個人成績通知書
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value={"excel" satisfies GradeExportTabType}
                  className="mt-0"
                >
                  <ExcelExportTab
                    gradeId={gradeId}
                    selectedStudentIds={selectedStudentIds}
                  />
                </TabsContent>

                <TabsContent
                  value={"individual-report" satisfies GradeExportTabType}
                  className="mt-0"
                >
                  <IndividualReportTab
                    result={result}
                    selectedStudentIds={selectedStudentIds}
                    options={reportOptions}
                    onOptionsChange={setReportOptions}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
