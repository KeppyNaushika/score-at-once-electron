"use client"

import {
  BarChart3,
  Check,
  CheckSquare,
  Eye,
  Search,
  Square,
  UserCheck,
  Users,
  UserX,
} from "lucide-react"
import { useState } from "react"

import { Student } from "@/app/exams/[examId]/08-export/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  IndividualReportData,
  IndividualReportOptions,
} from "@/electron-src/lib/export/individual-report/types"

import type { ExcelPreviewData } from "../hooks/useExcelPreview"
import { ExcelPreview } from "./ExcelPreview"
import type { ExportTabType } from "./ExportOptionsCard"
import { IndividualReportPreview } from "./individual-report/IndividualReportPreview"
import { ScoredAnswerPreview } from "./ScoredAnswerPreview"
import { StatClassSelector } from "./StatClassSelector"

interface StudentSelectionCardProps {
  examId?: string
  students: Student[]
  availableClasses: Array<{ id: string; name: string }>
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedClasses: string[]
  setSelectedClasses: (classes: string[]) => void
  selectedStatuses: string[]
  setSelectedStatuses: (statuses: string[]) => void
  selectedStudents: Set<string>
  setSelectedStudents: (students: Set<string>) => void
  // プレビュー関連
  exportTab?: ExportTabType
  previewData?: IndividualReportData | null
  isPreviewLoading?: boolean
  previewError?: string | null
  previewStudentId?: string
  onPreviewStudentChange?: (studentId: string) => void
  previewStudentList?: Array<{ id: string; name: string }>
  individualReportOptions?: IndividualReportOptions
  // 採点済み答案プレビュー
  scoredAnswerPreviewUrls?: string[]
  isScoredAnswerPreviewLoading?: boolean
  scoredAnswerPreviewError?: string | null
  scoredAnswerPreviewStudentId?: string | null
  onScoredAnswerPreviewStudentChange?: (studentId: string) => void
  // Excelプレビュー
  excelPreviewData?: ExcelPreviewData | null
  isExcelPreviewLoading?: boolean
  excelPreviewError?: string | null
}

export function StudentSelectionCard({
  examId,
  students,
  availableClasses,
  searchTerm,
  setSearchTerm,
  selectedClasses,
  setSelectedClasses,
  selectedStatuses,
  setSelectedStatuses,
  selectedStudents,
  setSelectedStudents,
  exportTab,
  previewData,
  isPreviewLoading,
  previewError,
  previewStudentId,
  onPreviewStudentChange,
  previewStudentList,
  individualReportOptions,
  scoredAnswerPreviewUrls,
  isScoredAnswerPreviewLoading,
  scoredAnswerPreviewError,
  scoredAnswerPreviewStudentId,
  onScoredAnswerPreviewStudentChange,
  excelPreviewData,
  isExcelPreviewLoading,
  excelPreviewError,
}: StudentSelectionCardProps) {
  const [activeTab, setActiveTab] = useState<
    "class-stats" | "selection" | "preview"
  >("selection")

  // exportTabからpreviewTypeを導出
  const previewType =
    exportTab === "individual-reports"
      ? "individual-report"
      : exportTab === "grading-data"
        ? "excel"
        : "scored-answers"

  const toggleStudentSelection = (studentId: string) => {
    const newSelection = new Set(selectedStudents)
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId)
    } else {
      newSelection.add(studentId)
    }
    setSelectedStudents(newSelection)
  }

  const selectAllFiltered = () => {
    const allFilteredIds = students.map((student) => student.id)
    setSelectedStudents(new Set([...selectedStudents, ...allFilteredIds]))
  }

  const deselectAllFiltered = () => {
    const filteredIds = new Set(students.map((student) => student.id))
    const newSelection = new Set(
      [...selectedStudents].filter((id) => !filteredIds.has(id))
    )
    setSelectedStudents(newSelection)
  }

  const toggleClassFilter = (classroomId: string) => {
    if (selectedClasses.includes(classroomId)) {
      setSelectedClasses(selectedClasses.filter((id) => id !== classroomId))
    } else {
      setSelectedClasses([...selectedClasses, classroomId])
    }
  }

  const toggleStatusFilter = (status: string) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(
        selectedStatuses.filter((selectedStatus) => selectedStatus !== status)
      )
    } else {
      setSelectedStatuses([...selectedStatuses, status])
    }
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) =>
        setActiveTab(v as "class-stats" | "selection" | "preview")
      }
      className="flex h-full flex-col"
    >
      {/* タブヘッダー */}
      <TabsList className="mb-2 grid w-full grid-cols-3">
        <TabsTrigger value="class-stats" className="gap-1">
          <BarChart3 className="h-4 w-4" />
          統計対象学級
        </TabsTrigger>
        <TabsTrigger value="selection" className="gap-1">
          <Users className="h-4 w-4" />
          生徒選択
        </TabsTrigger>
        <TabsTrigger value="preview" className="gap-1">
          <Eye className="h-4 w-4" />
          プレビュー
        </TabsTrigger>
      </TabsList>

      {/* 統計対象学級タブ（教員集計 / 生徒表示の学級選択） */}
      <TabsContent
        value="class-stats"
        className="mt-0 min-h-0 flex-1 overflow-auto"
      >
        {examId ? (
          <StatClassSelector examId={examId} />
        ) : (
          <p className="text-muted-foreground p-4 text-center text-sm">
            試験が読み込まれていません
          </p>
        )}
      </TabsContent>

      {/* 生徒選択タブ */}
      <TabsContent
        value="selection"
        className="mt-0 flex min-h-0 flex-1 flex-col"
      >
        {/* 1行目: 検索のみ */}
        <div className="mb-2 flex items-center">
          {/* 検索 */}
          <div className="relative w-full">
            <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="名前または学籍番号で検索"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        {/* 2行目: 学級 | 状態 | 選択 */}
        <div className="mb-2 flex items-center justify-between">
          {/* 学級フィルタ */}
          <div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs whitespace-nowrap"
                >
                  学級({selectedClasses.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2">
                <div className="space-y-1">
                  <h4 className="mb-2 text-sm font-medium">学級を選択</h4>
                  {availableClasses.map((classroom) => (
                    <Button
                      key={classroom.id}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full justify-between px-2"
                      onClick={() => toggleClassFilter(classroom.id)}
                    >
                      <span className="text-sm">{classroom.name}</span>
                      {selectedClasses.includes(classroom.id) && (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* 状態フィルタ（アイコン付き）*/}
          <div className="flex gap-1">
            {[
              { value: "participating", label: "受験", icon: UserCheck },
              { value: "expected", label: "見込", icon: Users },
              { value: "absent", label: "欠席", icon: UserX },
            ].map((status) => {
              const Icon = status.icon
              return (
                <Button
                  key={status.value}
                  variant={
                    selectedStatuses.includes(status.value)
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => toggleStatusFilter(status.value)}
                >
                  <Icon className="mr-1 h-3 w-3" />
                  {status.label}
                </Button>
              )
            })}
          </div>

          {/* 一括選択 */}
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

        {/* 3行目: 生徒リスト - 残りの高さを使用 */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
            <span>生徒一覧</span>
            <span>
              {selectedStudents.size}人選択中 / {students.length}人表示中
            </span>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto rounded-md border p-1.5">
            {students.map((student) => (
              <div
                key={student.id}
                className="hover:bg-muted flex items-center space-x-2 rounded p-1"
              >
                <Checkbox
                  id={`student-${student.id}`}
                  checked={selectedStudents.has(student.id)}
                  onCheckedChange={() => toggleStudentSelection(student.id)}
                  className="h-4 w-4"
                />
                <Label
                  htmlFor={`student-${student.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs">
                      {student.lastName} {student.firstName}
                    </span>
                    <div className="flex items-center gap-1">
                      {student.customOrder !== null &&
                        student.customOrder !== undefined && (
                          <span className="text-muted-foreground bg-muted rounded px-1 text-xs">
                            {student.customOrder}
                          </span>
                        )}
                      <span className="text-muted-foreground text-xs">
                        {student.studentNumber}
                      </span>
                    </div>
                  </div>
                </Label>
              </div>
            ))}
          </div>
        </div>
      </TabsContent>

      {/* プレビュータブ */}
      <TabsContent
        value="preview"
        className="mt-0 flex min-h-0 flex-1 flex-col"
      >
        {/* 個人成績表・採点済み答案の場合は生徒選択を表示 */}
        {(previewType === "individual-report" ||
          previewType === "scored-answers") &&
          previewStudentList &&
          previewStudentList.length > 0 && (
            <div className="mb-2 flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">生徒:</Label>
              <Select
                value={
                  previewType === "scored-answers"
                    ? scoredAnswerPreviewStudentId || ""
                    : previewStudentId || ""
                }
                onValueChange={(v) =>
                  previewType === "scored-answers"
                    ? onScoredAnswerPreviewStudentChange?.(v)
                    : onPreviewStudentChange?.(v)
                }
              >
                <SelectTrigger className="h-8 flex-1">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {previewStudentList.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

        {/* プレビューコンテンツ */}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-md border bg-gray-100 p-2">
          {previewType === "individual-report" ? (
            // 個人成績表プレビュー
            isPreviewLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-muted-foreground text-sm">読み込み中...</p>
              </div>
            ) : previewError ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-destructive text-sm">{previewError}</p>
              </div>
            ) : previewData && individualReportOptions ? (
              <div className="mx-auto">
                <IndividualReportPreview
                  report={previewData}
                  options={individualReportOptions}
                  scale={0.45}
                />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  {selectedStudents.size === 0
                    ? "生徒を選択してください"
                    : "プレビューする生徒を選択してください"}
                </p>
              </div>
            )
          ) : previewType === "scored-answers" ? (
            // 採点済み答案プレビュー
            <ScoredAnswerPreview
              imageUrls={scoredAnswerPreviewUrls || []}
              isLoading={isScoredAnswerPreviewLoading || false}
              error={scoredAnswerPreviewError || null}
            />
          ) : previewType === "excel" ? (
            // Excelプレビュー
            isExcelPreviewLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-muted-foreground text-sm">読み込み中...</p>
              </div>
            ) : excelPreviewError ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-destructive text-sm">{excelPreviewError}</p>
              </div>
            ) : excelPreviewData ? (
              <ExcelPreview data={excelPreviewData} />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  {selectedStudents.size === 0
                    ? "生徒を選択してください"
                    : "データの取得中..."}
                </p>
              </div>
            )
          ) : null}
        </div>
      </TabsContent>
    </Tabs>
  )
}
