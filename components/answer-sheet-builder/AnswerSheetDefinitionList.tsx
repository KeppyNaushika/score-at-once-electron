"use client"

import { Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

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
import { useAuth } from "@/contexts/AuthContext"

import { useAnswerSheetDefinitions } from "./hooks/useAnswerSheetDefinitions"

type SortKey = "name" | "updatedAt" | "questionCount" | "totalPoints"
type SortDir = "asc" | "desc"

/**
 * 解答用紙定義の一覧表示・作成・複製・削除を行うコンポーネント。
 */
export function AnswerSheetDefinitionList() {
  const { user } = useAuth()
  const router = useRouter()
  const { definitions, isLoading, deleteDefinition, duplicateDefinition } =
    useAnswerSheetDefinitions(user?.id)

  const [sortKey, setSortKey] = useState<SortKey>("updatedAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      } else {
        setSortKey(key)
        setSortDir(key === "name" ? "asc" : "desc")
      }
    },
    [sortKey]
  )

  const sorted = [...definitions].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1
    switch (sortKey) {
      case "name":
        return dir * a.name.localeCompare(b.name)
      case "updatedAt":
        return dir * (a.updatedAt ?? "").localeCompare(b.updatedAt ?? "")
      case "questionCount":
        return dir * ((a.questionCount ?? 0) - (b.questionCount ?? 0))
      case "totalPoints":
        return dir * ((a.totalPoints ?? 0) - (b.totalPoints ?? 0))
      default:
        return 0
    }
  })

  const handleCreate = useCallback(async () => {
    if (!user?.id) return
    const api = window.electronAPI?.answerSheetBuilder
    if (!api) return

    const newId = crypto.randomUUID()
    const { createDefaultDefinition } = await import("./constants")
    const def = createDefaultDefinition()
    def.id = newId

    const result = await api.saveDefinition(def, user.id)
    if (result.success) {
      router.push(`/answer-sheet-builder/${newId}`)
    }
  }, [user?.id, router])

  const handleEdit = useCallback(
    (id: string) => {
      router.push(`/answer-sheet-builder/${id}`)
    },
    [router]
  )

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (!confirm(`「${name}」を削除しますか？`)) return
      await deleteDefinition(id)
    },
    [deleteDefinition]
  )

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ""
    return sortDir === "asc" ? " ↑" : " ↓"
  }

  const formatDate = (iso?: string) => {
    if (!iso) return "-"
    const d = new Date(iso)
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">解答用紙定義</h2>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新規作成
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
          <p className="mb-2">解答用紙定義がありません</p>
          <Button variant="outline" size="sm" onClick={handleCreate}>
            <Plus className="mr-1 h-4 w-4" />
            最初の定義を作成
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("name")}
                >
                  名前{sortIndicator("name")}
                </TableHead>
                <TableHead className="w-24">用紙</TableHead>
                <TableHead
                  className="w-20 cursor-pointer text-right select-none"
                  onClick={() => toggleSort("questionCount")}
                >
                  設問数{sortIndicator("questionCount")}
                </TableHead>
                <TableHead
                  className="w-24 cursor-pointer text-right select-none"
                  onClick={() => toggleSort("totalPoints")}
                >
                  合計配点{sortIndicator("totalPoints")}
                </TableHead>
                <TableHead
                  className="w-40 cursor-pointer select-none"
                  onClick={() => toggleSort("updatedAt")}
                >
                  更新日時{sortIndicator("updatedAt")}
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((def) => (
                <TableRow
                  key={def.id}
                  className="cursor-pointer"
                  onClick={() => handleEdit(def.id)}
                >
                  <TableCell className="font-medium">{def.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {def.paperSize ?? "-"}{" "}
                    {def.orientation === "landscape" ? "横" : "縦"}
                  </TableCell>
                  <TableCell className="text-right">
                    {def.questionCount ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {def.totalPoints != null ? `${def.totalPoints}点` : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(def.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem onClick={() => handleEdit(def.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          編集
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => duplicateDefinition(def.id)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          複製
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(def.id, def.name)}
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
  )
}
