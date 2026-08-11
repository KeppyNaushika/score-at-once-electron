"use client"

import Link from "next/link"
import { useCallback, useMemo } from "react"

import {
  type EditableColumnDef,
  EditableTable,
} from "@/components/common/EditableTable"
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

/**
 * 表記ゆれを吸収する（全角英数・全角記号を半角へ、前後の空白を落とす）。
 *
 * Excel から貼り付けた `１０` や `ａ` は間違いではなく表記の違いなので、弾かずに
 * 受け入れる。文字評価の照合では変換表のラベル側にも同じ正規化を通すこと
 * （入力側だけ半角化すると、ラベルが全角で登録されている場合に一致しなくなる）。
 */
const normalizeInput = (value: string): string =>
  value
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (fullWidthChar) =>
      String.fromCharCode(fullWidthChar.charCodeAt(0) - 0xfee0)
    )
    .replace(/[－ー−]/g, "-")
    .replace(/[．]/g, ".")
    .trim()

/** 文字評価の照合キー（両側に同じ正規化を通し、大小文字は無視する） */
const letterKey = (value: string): string => normalizeInput(value).toUpperCase()

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
    return data
  }, [studentRows, items])

  const columns = useMemo((): EditableColumnDef<ScoreRow>[] => {
    const readOnlyCols: EditableColumnDef<ScoreRow>[] = [
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

    const scoreCols: EditableColumnDef<ScoreRow>[] = items.flatMap(
      (item): EditableColumnDef<ScoreRow>[] => {
        const isLetter = item.inputMode === "letter"
        const validLabels = item.letterScales
          .map((letterScale) => letterScale.label)
          .join("/")
        // 照合は正規化キーで行い、保存する値は変換表のラベルそのものにする
        const labelByKey = new Map(
          item.letterScales.map((letterScale) => [
            letterKey(letterScale.label),
            letterScale.label,
          ])
        )
        return [
          {
            id: item.id,
            header: isLetter
              ? `${item.name} (評価)`
              : `${item.name} (満点${item.maxScore})`,
            accessorKey: item.id,
            size: 110,
            meta: {
              placeholder: isLetter ? validLabels || "評価記号" : "数値",
              // 文字評価は変換表のラベル、数値は有限の数値なら有効。
              // 満点超過も負数も許容する（配点の枠を超えて成績へ加減できる仕様）。
              validate: (value: string) => {
                const normalized = normalizeInput(value)
                if (normalized === "") return true
                if (isLetter) return labelByKey.has(letterKey(value))
                const parsedValue = Number(normalized)
                return !isNaN(parsedValue) && isFinite(parsedValue)
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
                const normalized = normalizeInput(value)
                if (normalized === "") return true
                const parsedValue = Number(normalized)
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
      // 変更前の値は今描画しているテーブルデータそのもの
      const prev = tableData
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
          const labelByKey = new Map(
            item.letterScales.map((letterScale) => [
              letterKey(letterScale.label),
              letterScale.label,
            ])
          )

          // value列（数値 or 文字評価）
          const valueColumnId = item.id
          if (newRow[valueColumnId] !== oldRow[valueColumnId]) {
            const trimmed = normalizeInput(newRow[valueColumnId] ?? "")
            if (item.inputMode === "letter") {
              if (trimmed === "") {
                pushPatch(item, courseworkStudentId, { letterValue: null })
              } else {
                const label = labelByKey.get(letterKey(newRow[valueColumnId]))
                if (label !== undefined) {
                  pushPatch(item, courseworkStudentId, { letterValue: label })
                }
                // 変換表に無い記号は無視
              }
            } else {
              if (trimmed === "") {
                pushPatch(item, courseworkStudentId, { score: null })
              } else {
                const parsedValue = Number(trimmed)
                // 満点超過・負数も入力どおり保存する
                if (!isNaN(parsedValue) && isFinite(parsedValue)) {
                  pushPatch(item, courseworkStudentId, { score: parsedValue })
                }
                // 数値として読めない値は無視
              }
            }
          }

          // 加減点列
          const adjustmentColumnId = adjColId(item.id)
          if (newRow[adjustmentColumnId] !== oldRow[adjustmentColumnId]) {
            const trimmed = normalizeInput(newRow[adjustmentColumnId] ?? "")
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
    [items, tableData, bulkUpdateCells]
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
