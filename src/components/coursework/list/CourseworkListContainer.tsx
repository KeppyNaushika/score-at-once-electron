"use client"

import { ClipboardEdit, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CourseworkSummary } from "@/types/coursework.types"

import { CourseworkCreateDialog } from "./CourseworkCreateDialog"

/**
 * 試験外成績資料（Coursework）の一覧コンテナ
 *
 * テーブル形式で資料一覧を表示し、各資料への遷移・新規作成・削除を提供する。
 * 成績算出から参照中の資料は削除をブロックし、参照元をトーストで通知する。
 */
export function CourseworkListContainer() {
  const router = useRouter()
  const [courseworks, setCourseworks] = useState<CourseworkSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const loadCourseworks = useCallback(async () => {
    try {
      const result = await window.electronAPI.coursework.getAll()
      if (result.success && result.courseworks) {
        setCourseworks(result.courseworks)
      }
    } catch (error) {
      console.error("Error loading courseworks:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCourseworks()
  }, [loadCourseworks])

  const handleCreated = (id: string) => {
    setShowCreateDialog(false)
    router.push(`/coursework/${id}/01-setup`)
  }

  const handleDelete = async (coursework: CourseworkSummary) => {
    try {
      const result = await window.electronAPI.coursework.delete(coursework.id)
      if (result.success) {
        setCourseworks((prev) => prev.filter((cw) => cw.id !== coursework.id))
        toast.success("資料を削除しました", { description: coursework.name })
      } else if (result.usedBy && result.usedBy.length > 0) {
        toast.error("削除できません", {
          description: `次の成績算出で参照されています: ${result.usedBy.join("、")}`,
        })
      } else {
        toast.error("削除に失敗しました", { description: result.error })
      }
    } catch (error) {
      console.error("Error deleting coursework:", error)
      toast.error("削除に失敗しました")
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-w-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            variant="outline"
            className="rounded-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4">
        {courseworks.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed">
            <p className="text-muted-foreground mb-2">
              試験外成績資料がありません
            </p>
            <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              最初の資料を作成
            </Button>
          </div>
        ) : (
          <div className="border-border/50 h-full overflow-hidden rounded-xl border shadow-sm">
            <Table wrapperClassName="h-full">
              <TableHeader className="bg-card sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead>資料名</TableHead>
                  <TableHead className="w-40 text-center">実施日</TableHead>
                  <TableHead className="w-40 text-center">編集</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseworks.map((coursework) => (
                  <TableRow key={coursework.id} className="group">
                    <TableCell>
                      <div>
                        <div className="font-medium">{coursework.name}</div>
                        <div className="text-muted-foreground text-sm">
                          {coursework.description || "説明なし"}
                          {" / "}
                          生徒: {coursework._count.students}名 / 評価項目:{" "}
                          {coursework._count.items}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-muted-foreground text-center text-sm">
                      {coursework.date
                        ? new Date(coursework.date).toLocaleDateString("ja-JP")
                        : "-"}
                    </TableCell>

                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        onClick={() =>
                          router.push(`/coursework/${coursework.id}/01-setup`)
                        }
                        className="rounded-lg"
                      >
                        <ClipboardEdit className="mr-1 h-4 w-4" />
                        編集
                      </Button>
                    </TableCell>

                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(coursework)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CourseworkCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleCreated}
      />
    </div>
  )
}
