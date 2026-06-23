"use client"

import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { useCallback, useMemo, useRef } from "react"

import { EditableTable } from "@/components/common/EditableTable"
import { Button } from "@/components/ui/button"
import type { ManualCellPatch } from "@/hooks/grades/useManualScores"
import { useManualScores } from "@/hooks/grades/useManualScores"
import type { GradeDataSourceWithDetails } from "@/types/grade.types"

interface ManualScoresContainerProps {
  gradeId: string
}

interface ManualScoreRow {
  _studentId: string
  attendanceNumber: string
  className: string
  studentName: string
  [key: string]: string
}

/** データソースごとの列ID（value列はds.id、補助列は接尾辞付き） */
const adjColId = (dsId: string) => `${dsId}::adj`
const reasonColId = (dsId: string) => `${dsId}::reason`
const commentColId = (dsId: string) => `${dsId}::comment`

/**
 * 外部成績入力コンテナ
 *
 * EditableTable を使用し、各生徒の成績（数値 or 文字評価）・加減点・理由・コメントを
 * Excelコピペ対応で一括入力できる。変更はデバウンスで自動保存される。
 */
export function ManualScoresContainer({ gradeId }: ManualScoresContainerProps) {
  const { manualDataSources, studentScores, loading, bulkUpdateCells } =
    useManualScores(gradeId)

  // 前回のテーブルデータを保持（diff検出用）
  const prevDataRef = useRef<ManualScoreRow[]>([])

  const tableData = useMemo(() => {
    const data = studentScores.map((student): ManualScoreRow => {
      const row: ManualScoreRow = {
        _studentId: student.studentId,
        attendanceNumber:
          student.attendanceNumber != null
            ? String(student.attendanceNumber)
            : "-",
        className: student.className ?? "-",
        studentName: `${student.lastName} ${student.firstName}`,
      }
      for (const dataSource of manualDataSources) {
        const cell = student.cells[dataSource.id]
        // value列: 文字モードは評価記号、数値モードはスコア
        if (dataSource.inputMode === "letter") {
          row[dataSource.id] = cell?.letterValue ?? ""
        } else {
          row[dataSource.id] = cell?.score != null ? String(cell.score) : ""
        }
        row[adjColId(dataSource.id)] =
          cell?.adjustment != null ? String(cell.adjustment) : ""
        row[reasonColId(dataSource.id)] = cell?.adjustmentReason ?? ""
        row[commentColId(dataSource.id)] = cell?.comment ?? ""
      }
      return row
    })
    prevDataRef.current = data
    return data
  }, [studentScores, manualDataSources])

  const columns = useMemo((): ColumnDef<ManualScoreRow>[] => {
    const readOnlyCols: ColumnDef<ManualScoreRow>[] = [
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

    const scoreCols: ColumnDef<ManualScoreRow>[] = manualDataSources.flatMap(
      (dataSource): ColumnDef<ManualScoreRow>[] => {
        const isLetter = dataSource.inputMode === "letter"
        const validLabels = dataSource.letterScales
          .map((ls) => ls.label)
          .join("/")
        return [
          {
            id: dataSource.id,
            header: isLetter
              ? `${dataSource.name} (評価)`
              : `${dataSource.name} (/${dataSource.maxScore})`,
            accessorKey: dataSource.id,
            size: 110,
            meta: {
              placeholder: isLetter
                ? validLabels || "評価記号"
                : `0-${dataSource.maxScore}`,
            },
          },
          {
            id: adjColId(dataSource.id),
            header: `${dataSource.name}·加減点`,
            accessorKey: adjColId(dataSource.id),
            size: 90,
            meta: { placeholder: "±0" },
          },
          {
            id: reasonColId(dataSource.id),
            header: `${dataSource.name}·理由`,
            accessorKey: reasonColId(dataSource.id),
            size: 120,
            meta: { placeholder: "期限超過 等" },
          },
          {
            id: commentColId(dataSource.id),
            header: `${dataSource.name}·コメント`,
            accessorKey: commentColId(dataSource.id),
            size: 160,
            meta: { placeholder: "通知書に表示" },
          },
        ]
      }
    )

    return [...readOnlyCols, ...scoreCols]
  }, [manualDataSources])

  const handleDataChange = useCallback(
    (newData: ManualScoreRow[]) => {
      const prev = prevDataRef.current
      const changes: {
        dataSourceId: string
        studentId: string
        patch: ManualCellPatch
      }[] = []

      const pushPatch = (
        dataSource: GradeDataSourceWithDetails,
        studentId: string,
        patch: ManualCellPatch
      ) => {
        changes.push({ dataSourceId: dataSource.id, studentId, patch })
      }

      for (let i = 0; i < newData.length; i++) {
        const newRow = newData[i]
        const oldRow = prev[i]
        if (!oldRow || !newRow) continue

        const studentId = newRow._studentId
        for (const dataSource of manualDataSources) {
          const validLabels = new Set(
            dataSource.letterScales.map((ls) => ls.label)
          )

          // value列（数値 or 文字評価）
          const valId = dataSource.id
          if (newRow[valId] !== oldRow[valId]) {
            const trimmed = (newRow[valId] ?? "").trim()
            if (dataSource.inputMode === "letter") {
              if (trimmed === "") {
                pushPatch(dataSource, studentId, { letterValue: null })
              } else if (validLabels.has(trimmed)) {
                pushPatch(dataSource, studentId, { letterValue: trimmed })
              }
              // 未定義の評価記号は無視
            } else {
              if (trimmed === "") {
                pushPatch(dataSource, studentId, { score: null })
              } else {
                const num = Number(trimmed)
                if (
                  !isNaN(num) &&
                  num >= 0 &&
                  num <= Number(dataSource.maxScore)
                ) {
                  pushPatch(dataSource, studentId, { score: num })
                }
                // 範囲外・無効値は無視
              }
            }
          }

          // 加減点列
          const adjId = adjColId(dataSource.id)
          if (newRow[adjId] !== oldRow[adjId]) {
            const trimmed = (newRow[adjId] ?? "").trim()
            if (trimmed === "") {
              pushPatch(dataSource, studentId, { adjustment: null })
            } else {
              const num = Number(trimmed)
              if (!isNaN(num) && isFinite(num)) {
                pushPatch(dataSource, studentId, { adjustment: num })
              }
              // 無効値は無視
            }
          }

          // 理由列
          const rsnId = reasonColId(dataSource.id)
          if (newRow[rsnId] !== oldRow[rsnId]) {
            const val = (newRow[rsnId] ?? "").trim()
            pushPatch(dataSource, studentId, {
              adjustmentReason: val === "" ? null : val,
            })
          }

          // コメント列
          const cmtId = commentColId(dataSource.id)
          if (newRow[cmtId] !== oldRow[cmtId]) {
            const val = (newRow[cmtId] ?? "").trim()
            pushPatch(dataSource, studentId, {
              comment: val === "" ? null : val,
            })
          }
        }
      }

      if (changes.length > 0) {
        bulkUpdateCells(changes)
      }
    },
    [manualDataSources, bulkUpdateCells]
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (manualDataSources.length === 0) {
    return (
      <div className="p-6">
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed">
          <p className="text-muted-foreground mb-2">
            外部成績データソースがありません
          </p>
          <p className="text-muted-foreground text-sm">
            データソース設定で「外部成績」を追加してください
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <Button asChild>
            <Link href={`/grades/${gradeId}/05-boundaries`}>
              次へ: 成績境界
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold">外部成績入力</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        各生徒の外部成績（提出物・授業態度等）を入力してください。文字評価のデータソースは
        評価記号（例:
        A/B/C）で入力します。加減点・理由・コメントも記入できます。
        変更は自動保存されます。
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
          <Link href={`/grades/${gradeId}/05-boundaries`}>次へ: 成績境界</Link>
        </Button>
      </div>
    </div>
  )
}
