"use client"

import { FolderOutput, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
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

interface ClassroomInfo {
  id: string
  name: string
}

interface StudentArchiveExportDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedStudentIds: Set<string>
}

export function StudentArchiveExportDialog({
  isOpen,
  onClose,
  selectedStudentIds,
}: StudentArchiveExportDialogProps) {
  const [relatedClassrooms, setRelatedClassrooms] = useState<ClassroomInfo[]>(
    []
  )
  const [selectedClassroomIds, setSelectedClassroomIds] = useState<Set<string>>(
    new Set()
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // 選択生徒に紐づく学級を取得
  useEffect(() => {
    if (!isOpen || selectedStudentIds.size === 0) return

    const fetchClassrooms = async () => {
      setIsLoading(true)
      try {
        const allStudents = await window.electronAPI.fetchStudents()
        const selectedStudents = allStudents.filter((student: { id: string }) =>
          selectedStudentIds.has(student.id)
        )

        // 紐づく学級を収集
        const classroomMap = new Map<string, string>()
        for (const student of selectedStudents) {
          for (const membership of student.memberships || []) {
            if (
              membership.classroom &&
              !classroomMap.has(membership.classroom.id)
            ) {
              classroomMap.set(
                membership.classroom.id,
                membership.classroom.name
              )
            }
          }
        }

        const classrooms = Array.from(classroomMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((entryA, entryB) => entryA.name.localeCompare(entryB.name))

        setRelatedClassrooms(classrooms)
        // デフォルト: 全学級を選択
        setSelectedClassroomIds(
          new Set(classrooms.map((classroom) => classroom.id))
        )
      } catch (error) {
        console.error("Failed to fetch classrooms:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchClassrooms()
  }, [isOpen, selectedStudentIds])

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
      const result = await window.electronAPI.studentArchive.exportStudents({
        studentIds: Array.from(selectedStudentIds),
        classroomIds:
          selectedClassroomIds.size === relatedClassrooms.length
            ? undefined
            : Array.from(selectedClassroomIds),
      })

      if (result.success) {
        toast.success(
          `${selectedStudentIds.size}名の生徒データをエクスポートしました`
        )
        onClose()
      } else if (result.error !== "キャンセルされました") {
        toast.error(`エクスポートに失敗しました: ${result.error}`)
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
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : relatedClassrooms.length === 0 ? (
            <p className="text-muted-foreground text-sm">
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

              <div className="border-border/50 max-h-60 overflow-y-auto rounded-lg border">
                {/* 全選択 */}
                <label className="hover:bg-muted/50 flex items-center gap-3 border-b px-4 py-2.5">
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
                    className="hover:bg-muted/50 flex items-center gap-3 px-4 py-2.5"
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
