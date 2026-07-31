"use client"

import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { useCallback, useMemo, useRef } from "react"

import { EditableTable } from "@/components/common/EditableTable"
import { Button } from "@/components/ui/button"
import type { CourseworkItemWithLetterScales } from "@/types/coursework.types"

import {
  type CourseworkCellPatch,
  useCourseworkScores,
} from "./hooks/useCourseworkScores"

interface CourseworkScoresContainerProps {
  courseworkId: string
}

interface ScoreRow {
  _courseworkStudentId: string
  attendanceNumber: string
  className: string
  studentName: string
  [key: string]: string
}

/** 評価項目ごとの列ID（value列はitem.id、補助列は接尾辞付き） */
const adjColId = (itemId: string) => `${itemId}::adj`
const reasonColId = (itemId: string) => `${itemId}::reason`
const commentColId = (itemId: string) => `${itemId}::comment`

/**
 * 試験外成績資料の点数入力コンテナ
 *
 * EditableTable を用い、行＝名簿生徒・列＝評価項目（value／加減点／理由／コメント）で
 * Excelコピペ対応の一括入力を提供する。文字評価項目は変換表のラベルで検証する。
 * 変更はデバウンスで自動保存される。
 */
export function CourseworkScoresContainer({
  courseworkId,
}: CourseworkScoresContainerProps) {
  const { items, studentRows, loading, bulkUpdateCells } =
    useCourseworkScores(courseworkId)

  // 前回のテーブルデータを保持（diff検出用）
  const prevDataRef = useRef<ScoreRow[]>([])

  const tableData = useMemo(() => {
    const data = studentRows.map((row): ScoreRow => {
      const tableRow: ScoreRow = {
        _courseworkStudentId: row.courseworkStudentId,
        attendanceNumber:
          row.attendanceNumber != null ? String(row.attendanceNumber) : "-",
        className: row.className ?? "-",
        studentName: `${row.lastName} ${row.firstName}`,
      }
      for (const item of items) {
        const cell = row.cells[item.id]
        if (item.inputMode === "letter") {
          tableRow[item.id] = cell?.letterValue ?? ""
        } else {
          tableRow[item.id] = cell?.score != null ? String(cell.score) : ""
        }
        tableRow[adjColId(item.id)] =
          cell?.adjustment != null ? String(cell.adjustment) : ""
        tableRow[reasonColId(item.id)] = cell?.adjustmentReason ?? ""
        tableRow[commentColId(item.id)] = cell?.comment ?? ""
      }
      return tableRow
    })
    prevDataRef.current = data
    return data
  }, [studentRows, items])

  const columns = useMemo((): ColumnDef<ScoreRow>[] => {
    const readOnlyCols: ColumnDef<ScoreRow>[] = [
      {
        id: "attendanceNumber",
        header: "出席番号",
        accessorKey: "attendanceNumber",
        size: 70,
        meta: { readOnly: true },
        cell: ({ getValue }) => (
          <span className="text-sm">{String(getValue())}</span>
        ),
      },
      {
        id: "className",
        header: "学級",
        accessorKey: "className",
        size: 80,
        meta: { readOnly: true },
        cell: ({ getValue }) => (
          <span className="text-sm">{String(getValue())}</span>
        ),
      },
      {
        id: "studentName",
        header: "氏名",
        accessorKey: "studentName",
        size: 120,
        meta: { readOnly: true },
        cell: ({ getValue }) => (
          <span className="text-sm">{String(getValue())}</span>
        ),
      },
    ]

    const scoreCols: ColumnDef<ScoreRow>[] = items.flatMap(
      (item): ColumnDef<ScoreRow>[] => {
        const isLetter = item.inputMode === "letter"
        const validLabels = item.letterScales
          .map((letterScale) => letterScale.label)
          .join("/")
        const validLabelSet = new Set(
          item.letterScales.map((letterScale) => letterScale.label)
        )
        return [
          {
            id: item.id,
            header: isLetter
              ? `${item.name} (評価)`
              : `${item.name} (/${item.maxScore})`,
            accessorKey: item.id,
            size: 110,
            meta: {
              placeholder: isLetter
                ? validLabels || "評価記号"
                : `0-${item.maxScore}`,
              // 文字評価は定義済みラベル、数値は0〜満点の範囲のみ有効
              validate: (value: string) => {
                const trimmed = value.trim()
                if (trimmed === "") return true
                if (isLetter) return validLabelSet.has(trimmed)
                const parsedValue = Number(trimmed)
                return (
                  !isNaN(parsedValue) &&
                  parsedValue >= 0 &&
                  parsedValue <= item.maxScore
                )
              },
            },
          },
          {
            id: adjColId(item.id),
            header: `${item.name}·加減点`,
            accessorKey: adjColId(item.id),
            size: 90,
            meta: {
              placeholder: "±0",
              // 加減点は有限の数値のみ有効
              validate: (value: string) => {
                const trimmed = value.trim()
                if (trimmed === "") return true
                const parsedValue = Number(trimmed)
                return !isNaN(parsedValue) && isFinite(parsedValue)
              },
            },
          },
          {
            id: reasonColId(item.id),
            header: `${item.name}·理由`,
            accessorKey: reasonColId(item.id),
            size: 120,
            meta: { placeholder: "期限超過 等" },
          },
          {
            id: commentColId(item.id),
            header: `${item.name}·コメント`,
            accessorKey: commentColId(item.id),
            size: 160,
            meta: { placeholder: "通知書に表示" },
          },
        ]
      }
    )

    return [...readOnlyCols, ...scoreCols]
  }, [items])

  const handleDataChange = useCallback(
    (newData: ScoreRow[]) => {
      const prev = prevDataRef.current
      const changes: {
        courseworkItemId: string
        courseworkStudentId: string
        patch: CourseworkCellPatch
      }[] = []

      const pushPatch = (
        item: CourseworkItemWithLetterScales,
        courseworkStudentId: string,
        patch: CourseworkCellPatch
      ) => {
        changes.push({
          courseworkItemId: item.id,
          courseworkStudentId,
          patch,
        })
      }

      for (let i = 0; i < newData.length; i++) {
        const newRow = newData[i]
        const oldRow = prev[i]
        if (!oldRow || !newRow) continue

        const courseworkStudentId = newRow._courseworkStudentId
        for (const item of items) {
          const validLabels = new Set(
            item.letterScales.map((letterScale) => letterScale.label)
          )

          // value列（数値 or 文字評価）
          const valueColumnId = item.id
          if (newRow[valueColumnId] !== oldRow[valueColumnId]) {
            const trimmed = (newRow[valueColumnId] ?? "").trim()
            if (item.inputMode === "letter") {
              if (trimmed === "") {
                pushPatch(item, courseworkStudentId, { letterValue: null })
              } else if (validLabels.has(trimmed)) {
                pushPatch(item, courseworkStudentId, { letterValue: trimmed })
              }
              // 未定義の評価記号は無視
            } else {
              if (trimmed === "") {
                pushPatch(item, courseworkStudentId, { score: null })
              } else {
                const parsedValue = Number(trimmed)
                if (
                  !isNaN(parsedValue) &&
                  parsedValue >= 0 &&
                  parsedValue <= item.maxScore
                ) {
                  pushPatch(item, courseworkStudentId, { score: parsedValue })
                }
                // 範囲外・無効値は無視
              }
            }
          }

          // 加減点列
          const adjustmentColumnId = adjColId(item.id)
          if (newRow[adjustmentColumnId] !== oldRow[adjustmentColumnId]) {
            const trimmed = (newRow[adjustmentColumnId] ?? "").trim()
            if (trimmed === "") {
              pushPatch(item, courseworkStudentId, { adjustment: null })
            } else {
              const parsedValue = Number(trimmed)
              if (!isNaN(parsedValue) && isFinite(parsedValue)) {
                pushPatch(item, courseworkStudentId, {
                  adjustment: parsedValue,
                })
              }
              // 無効値は無視
            }
          }

          // 理由列
          const reasonColumnId = reasonColId(item.id)
          if (newRow[reasonColumnId] !== oldRow[reasonColumnId]) {
            const reasonValue = (newRow[reasonColumnId] ?? "").trim()
            pushPatch(item, courseworkStudentId, {
              adjustmentReason: reasonValue === "" ? null : reasonValue,
            })
          }

          // コメント列
          const commentColumnId = commentColId(item.id)
          if (newRow[commentColumnId] !== oldRow[commentColumnId]) {
            const commentValue = (newRow[commentColumnId] ?? "").trim()
            pushPatch(item, courseworkStudentId, {
              comment: commentValue === "" ? null : commentValue,
            })
          }
        }
      }

      if (changes.length > 0) {
        bulkUpdateCells(changes)
      }
    },
    [items, bulkUpdateCells]
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-6">
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed">
          <p className="mb-2 text-muted-foreground">評価項目がありません</p>
          <p className="text-sm text-muted-foreground">
            「評価項目」ステップで評価項目を追加してください
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <Button asChild>
            <Link href={`/coursework/${courseworkId}/03-items`}>
              評価項目へ
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold">点数入力</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        各生徒の評価項目ごとの点数を入力してください。文字評価の項目は評価記号（例:
        A/B/C）で入力します。加減点・理由・コメントも記入できます。変更は自動保存されます。
      </p>

      <div className="overflow-x-auto">
        <EditableTable
          data={tableData}
          columns={columns}
          onDataChange={handleDataChange}
          allowInsertRow={false}
          allowDeleteRow={false}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <Button asChild>
          <Link href={`/coursework/${courseworkId}/05-results`}>
            次へ: 結果
          </Link>
        </Button>
      </div>
    </div>
  )
}
