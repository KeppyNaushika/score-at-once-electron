"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { FolderOutput, Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { exportStudentArchiveMutation } from "@/queries/archive"
import { studentListQuery } from "@/queries/student"
import type { StudentWithMemberships } from "@/types/prismaExtensions"

interface ClassroomInfo {
  id: string
  name: string
}

interface StudentArchiveExportDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedStudentIds: Set<string>
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_STUDENTS: StudentWithMemberships[] = []

export function StudentArchiveExportDialog({
  isOpen,
  onClose,
  selectedStudentIds,
}: StudentArchiveExportDialogProps) {
  const [selectedClassroomIds, setSelectedClassroomIds] = useState<Set<string>>(
    new Set()
  )
  const [isExporting, setIsExporting] = useState(false)
  const exportStudentArchive = useMutation(exportStudentArchiveMutation())

  // 生徒は共有キャッシュから引き、選択生徒に紐づく学級はそこから導く
  const { data: students = EMPTY_STUDENTS, isPending: isLoading } =
    useQuery(studentListQuery())
  const relatedClassrooms: ClassroomInfo[] = useMemo(() => {
    const classroomById = new Map<string, string>()
    for (const student of students) {
      if (!selectedStudentIds.has(student.id)) continue
      for (const membership of student.memberships) {
        if (!classroomById.has(membership.classroom.id)) {
          classroomById.set(membership.classroom.id, membership.classroom.name)
        }
      }
    }
    return Array.from(classroomById.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((classroomA, classroomB) =>
        classroomA.name.localeCompare(classroomB.name)
      )
  }, [students, selectedStudentIds])

  // 既定は全学級。開き直すたび・対象が変わるたびに選び直す
  const [seededClassrooms, setSeededClassrooms] = useState<ClassroomInfo[]>([])
  if (isOpen && seededClassrooms !== relatedClassrooms) {
    setSeededClassrooms(relatedClassrooms)
    setSelectedClassroomIds(
      new Set(relatedClassrooms.map((classroom) => classroom.id))
    )
  }

  const toggleClassroom = (classroomId: string) => {
    setSelectedClassroomIds((prev) => {
      const next = new Set(prev)
      if (next.has(classroomId)) {
        next.delete(classroomId)
      } else {
        next.add(classroomId)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedClassroomIds.size === relatedClassrooms.length) {
      setSelectedClassroomIds(new Set())
    } else {
      setSelectedClassroomIds(
        new Set(relatedClassrooms.map((classroom) => classroom.id))
      )
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await exportStudentArchive.mutateAsync({
        studentIds: Array.from(selectedStudentIds),
        classroomIds:
          selectedClassroomIds.size === relatedClassrooms.length
            ? undefined
            : Array.from(selectedClassroomIds),
      })

      // 保存先を選ばずに閉じたのは失敗ではないので、何も言わない
      if (!result.canceled) {
        toast.success(
          `${selectedStudentIds.size}名の生徒データをエクスポートしました`
        )
        onClose()
      }
    } catch (error) {
      console.error("Failed to export:", error)
      toast.error("エクスポート中にエラーが発生しました")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            生徒データの書き出し（{selectedStudentIds.size}名）
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : relatedClassrooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              選択した生徒に紐づく学級はありません。
              <br />
              生徒データのみがエクスポートされます。
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                エクスポートする学級を選択してください。
                <br />
                <span className="text-muted-foreground">
                  学級の情報と所属関係が一緒にエクスポートされます。
                </span>
              </p>

              <div className="max-h-60 overflow-y-auto rounded-lg border border-border/50">
                {/* 全選択 */}
                <label className="flex items-center gap-3 border-b px-4 py-2.5 hover:bg-muted/50">
                  <Checkbox
                    checked={
                      selectedClassroomIds.size === relatedClassrooms.length
                        ? true
                        : selectedClassroomIds.size > 0
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-sm font-medium">すべて選択</span>
                </label>

                {relatedClassrooms.map((classroom) => (
                  <label
                    key={classroom.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedClassroomIds.has(classroom.id)}
                      onCheckedChange={() => toggleClassroom(classroom.id)}
                    />
                    <span className="text-sm">{classroom.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            キャンセル
          </Button>
          <Button onClick={handleExport} disabled={isExporting || isLoading}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                書き出し中...
              </>
            ) : (
              <>
                <FolderOutput className="mr-2 h-4 w-4" />
                書き出し
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
