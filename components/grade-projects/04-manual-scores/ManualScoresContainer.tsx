"use client"

import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { useCallback, useMemo, useRef } from "react"

import { EditableTable } from "@/components/common/EditableTable"
import { Button } from "@/components/ui/button"
import { useManualScores } from "@/hooks/grade-projects/useManualScores"

interface ManualScoresContainerProps {
  gradeProjectId: string
}

interface ManualScoreRow {
  _studentId: string
  attendanceNumber: string
  className: string
  studentName: string
  [key: string]: string
}

/**
 * 外部成績入力コンテナ
 *
 * EditableTable を使用し、各生徒のスコアをExcelコピペ対応で一括入力できる。
 * 変更はデバウンスで自動保存される。
 */
export function ManualScoresContainer({
  gradeProjectId,
}: ManualScoresContainerProps) {
  const { manualDataSources, studentScores, loading, bulkUpdateScores } =
    useManualScores(gradeProjectId)

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
        row[dataSource.id] =
          student.scores[dataSource.id] != null
            ? String(student.scores[dataSource.id])
            : ""
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

    const scoreCols: ColumnDef<ManualScoreRow>[] = manualDataSources.map(
      (dataSource) => ({
        id: dataSource.id,
        header: `${dataSource.name} (/${dataSource.maxScore})`,
        accessorKey: dataSource.id,
        size: 100,
        meta: { placeholder: `0-${dataSource.maxScore}` },
      })
    )

    return [...readOnlyCols, ...scoreCols]
  }, [manualDataSources])

  const handleDataChange = useCallback(
    (newData: ManualScoreRow[]) => {
      const prev = prevDataRef.current
      const changes: {
        dataSourceId: string
        studentId: string
        score: number | null
      }[] = []

      for (let i = 0; i < newData.length; i++) {
        const newRow = newData[i]
        const oldRow = prev[i]
        if (!oldRow || !newRow) continue

        const studentId = newRow._studentId
        for (const dataSource of manualDataSources) {
          const newVal = newRow[dataSource.id]
          const oldVal = oldRow[dataSource.id]
          if (newVal === oldVal) continue

          // バリデーション
          const trimmed = (newVal ?? "").trim()
          if (trimmed === "") {
            changes.push({
              dataSourceId: dataSource.id,
              studentId,
              score: null,
            })
          } else {
            const num = Number(trimmed)
            if (!isNaN(num) && num >= 0 && num <= Number(dataSource.maxScore)) {
              changes.push({
                dataSourceId: dataSource.id,
                studentId,
                score: num,
              })
            }
            // 無効な値は無視（EditableTableがセル値を保持するので自然にリセットされる）
          }
        }
      }

      if (changes.length > 0) {
        bulkUpdateScores(changes)
      }
    },
    [manualDataSources, bulkUpdateScores]
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
            <Link href={`/grade-projects/${gradeProjectId}/05-boundaries`}>
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
        各生徒の外部成績（提出物・授業態度等）を入力してください。変更は自動保存されます。
      </p>

      <EditableTable
        data={tableData}
        columns={columns}
        onDataChange={handleDataChange}
        allowInsertRow={false}
        allowDeleteRow={false}
      />

      <div className="mt-6 flex justify-end">
        <Button asChild>
          <Link href={`/grade-projects/${gradeProjectId}/05-boundaries`}>
            次へ: 成績境界
          </Link>
        </Button>
      </div>
    </div>
  )
}
