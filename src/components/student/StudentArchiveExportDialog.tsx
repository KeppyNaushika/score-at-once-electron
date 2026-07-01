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

interface ClassInfo {
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
  const [relatedClasses, setRelatedClasses] = useState<ClassInfo[]>([])
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(
    new Set()
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // 選択生徒に紐づく学級を取得
  useEffect(() => {
    if (!isOpen || selectedStudentIds.size === 0) return

    const fetchClasses = async () => {
      setIsLoading(true)
      try {
        const allStudents = await window.electronAPI.fetchStudents()
        const selectedStudents = allStudents.filter((s: { id: string }) =>
          selectedStudentIds.has(s.id)
        )

        // 紐づく学級を収集
        const classMap = new Map<string, string>()
        for (const student of selectedStudents) {
          for (const m of student.memberships || []) {
            if (m.classroom && !classMap.has(m.classroom.id)) {
              classMap.set(m.classroom.id, m.classroom.name)
            }
          }
        }

        const classes = Array.from(classMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))

        setRelatedClasses(classes)
        // デフォルト: 全学級を選択
        setSelectedClassIds(new Set(classes.map((c) => c.id)))
      } catch (error) {
        console.error("Failed to fetch classes:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchClasses()
  }, [isOpen, selectedStudentIds])

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev)
      if (next.has(classId)) {
        next.delete(classId)
      } else {
        next.add(classId)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedClassIds.size === relatedClasses.length) {
      setSelectedClassIds(new Set())
    } else {
      setSelectedClassIds(new Set(relatedClasses.map((c) => c.id)))
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await window.electronAPI.studentArchive.exportStudents({
        studentIds: Array.from(selectedStudentIds),
        classIds:
          selectedClassIds.size === relatedClasses.length
            ? undefined
            : Array.from(selectedClassIds),
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
          ) : relatedClasses.length === 0 ? (
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
                      selectedClassIds.size === relatedClasses.length
                        ? true
                        : selectedClassIds.size > 0
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-sm font-medium">すべて選択</span>
                </label>

                {relatedClasses.map((cls) => (
                  <label
                    key={cls.id}
                    className="hover:bg-muted/50 flex items-center gap-3 px-4 py-2.5"
                  >
                    <Checkbox
                      checked={selectedClassIds.has(cls.id)}
                      onCheckedChange={() => toggleClass(cls.id)}
                    />
                    <span className="text-sm">{cls.name}</span>
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
