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

import { Student } from "@/components/exams/08-export/types"
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
import type { ReturnStudentDiff } from "@/electron-src/lib/prisma/returnSnapshot"

import type { ExcelPreviewData } from "../hooks/useExcelPreview"
import { ExcelPreview } from "./ExcelPreview"
import type { ExportTabType } from "./ExportOptionsCard"
import { IndividualReportPreview } from "./individual-report/IndividualReportPreview"
import { ReturnDiffPanel } from "./ReturnDiffPanel"
import { ScoredAnswerPreview } from "./ScoredAnswerPreview"
import { StatisticsClassroomSelector } from "./StatisticsClassroomSelector"

interface StudentSelectionCardProps {
  examId?: string
  students: Student[]
  availableClassrooms: Array<{ id: string; name: string }>
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedClassrooms: string[]
  setSelectedClassrooms: (classrooms: string[]) => void
  selectedStatuses: string[]
  setSelectedStatuses: (statuses: string[]) => void
  selectedStudents: Set<string>
  toggleStudent: (examStudentId: string) => void
  addStudents: (examStudentIds: string[]) => void
  removeStudents: (examStudentIds: string[]) => void
  // 答案返却・差分（生徒選択タブ内に表示）
  /** 表示フィルタ前の全生徒（差分の件数・詳細を表示フィルタと独立させるため） */
  allStudents: Student[]
  selectedExamStudentIds: string[]
  onSelectExamStudentIds: (examStudentIds: string[]) => void
  diffByExamStudent: Map<string, ReturnStudentDiff>
  changedExamStudentIds: Set<string>
  hasAnySnapshot: boolean
  capturingReturn: boolean
  captureReturn: (examStudentIds: string[]) => Promise<boolean>
  // プレビュー関連
  exportTab?: ExportTabType
  previewData?: IndividualReportData | null
  isPreviewLoading?: boolean
  previewError?: string | null
  previewStudentId?: string
  onPreviewStudentChange?: (examStudentId: string) => void
  previewStudentList?: Array<{ id: string; name: string }>
  individualReportOptions?: IndividualReportOptions
  // 採点済み答案プレビュー
  scoredAnswerPreviewUrls?: string[]
  isScoredAnswerPreviewLoading?: boolean
  scoredAnswerPreviewError?: string | null
  scoredAnswerPreviewStudentId?: string | null
  onScoredAnswerPreviewStudentChange?: (examStudentId: string) => void
  // Excelプレビュー
  excelPreviewData?: ExcelPreviewData | null
  isExcelPreviewLoading?: boolean
  excelPreviewError?: string | null
}

export function StudentSelectionCard({
  examId,
  students,
  availableClassrooms,
  searchTerm,
  setSearchTerm,
  selectedClassrooms,
  setSelectedClassrooms,
  selectedStatuses,
  setSelectedStatuses,
  selectedStudents,
  toggleStudent,
  addStudents,
  removeStudents,
  allStudents,
  selectedExamStudentIds,
  onSelectExamStudentIds,
  diffByExamStudent,
  changedExamStudentIds,
  hasAnySnapshot,
  capturingReturn,
  captureReturn,
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

  const selectAllFiltered = () => {
    addStudents(students.map((examStudent) => examStudent.id))
  }

  const deselectAllFiltered = () => {
    removeStudents(students.map((examStudent) => examStudent.id))
  }

  const toggleClassroomFilter = (classroomId: string) => {
    if (selectedClassrooms.includes(classroomId)) {
      setSelectedClassrooms(
        selectedClassrooms.filter((id) => id !== classroomId)
      )
    } else {
      setSelectedClassrooms([...selectedClassrooms, classroomId])
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
          <StatisticsClassroomSelector examId={examId} />
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
                  学級({selectedClassrooms.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2">
                <div className="space-y-1">
                  <h4 className="mb-2 text-sm font-medium">学級を選択</h4>
                  {availableClassrooms.map((classroom) => (
                    <Button
                      key={classroom.id}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full justify-between px-2"
                      onClick={() => toggleClassroomFilter(classroom.id)}
                    >
                      <span className="text-sm">{classroom.name}</span>
                      {selectedClassrooms.includes(classroom.id) && (
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

        {/* 答案返却・差分（生徒一覧の上） */}
        <div className="mb-2 shrink-0">
          <ReturnDiffPanel
            students={allStudents}
            selectedExamStudentIds={selectedExamStudentIds}
            onSelectExamStudentIds={onSelectExamStudentIds}
            diffByExamStudent={diffByExamStudent}
            changedExamStudentIds={changedExamStudentIds}
            hasAnySnapshot={hasAnySnapshot}
            capturing={capturingReturn}
            capture={captureReturn}
          />
        </div>

        {/* 3行目: 生徒リスト - 残りの高さを使用 */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
            <span>生徒一覧</span>
            <span>
              {selectedStudents.size}人選択中 / {students.length}人表示中
            </span>
          </div>
          <div className="relative flex-1 space-y-0.5 overflow-y-auto rounded-md border p-1.5">
            {students.map((examStudent) => (
              <div
                key={examStudent.id}
                className="hover:bg-muted flex items-center space-x-2 rounded p-1"
              >
                <Checkbox
                  id={`student-${examStudent.id}`}
                  checked={selectedStudents.has(examStudent.id)}
                  onCheckedChange={() => toggleStudent(examStudent.id)}
                  className="h-4 w-4"
                />
                <Label
                  htmlFor={`student-${examStudent.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs">
                      {examStudent.student.lastName}{" "}
                      {examStudent.student.firstName}
                    </span>
                    <div className="flex items-center gap-1">
                      {examStudent.customOrder !== null &&
                        examStudent.customOrder !== undefined && (
                          <span className="text-muted-foreground bg-muted rounded px-1 text-xs">
                            {examStudent.customOrder}
                          </span>
                        )}
                      <span className="text-muted-foreground text-xs">
                        {examStudent.student.studentNumber}
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
