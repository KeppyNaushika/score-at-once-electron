"use client"

import { useMutation, useQueries, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"

import {
  type EditableColumnDef,
  EditableTable,
} from "@/components/common/EditableTable"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  type CourseworkClassroomRow,
  courseworkClassroomsQuery,
  courseworkDetailQuery,
  courseworkScoresQuery,
  courseworkStudentsQuery,
  upsertCourseworkScoresMutation,
} from "@/queries/coursework"
import type {
  CourseworkItemWithLetterScales,
  CourseworkStudentWithMemberships,
} from "@/types/coursework.types"

import {
  containsFullWidth,
  isUnknownLetterValue,
  letterValueOf,
  toHalfWidth,
} from "../courseworkLetterValues"
import {
  buildCourseworkStudentRows,
  type CourseworkCellPatch,
  sortCourseworkItems,
} from "./courseworkScoreTable"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_STUDENTS: CourseworkStudentWithMemberships[] = []
const EMPTY_CLASSROOMS: CourseworkClassroomRow[] = []

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
 * 数値の表記ゆれを吸収する（全角英数・全角記号を半角へ、前後の空白を落とす）。
 *
 * `１０` は 10 のことであって別の数ではないので、数値として読むために寄せる。
 * **文字評価には通さない。** 評語は `Ａ` と `A` が別の評語でありうるので、
 * 表記を寄せるかどうかは貼り付けのときに人へ尋ねる（`transformPastedText`）。
 */
const normalizeInput = (value: string): string => toHalfWidth(value).trim()

/** 評価項目ごとの列ID（value列はitem.id、補助列は接尾辞付き） */
const adjColId = (itemId: string) => `${itemId}::adj`
const reasonColId = (itemId: string) => `${itemId}::reason`
const commentColId = (itemId: string) => `${itemId}::comment`

/**
 * 試験外成績資料の点数入力コンテナ
 *
 * EditableTable を用い、行＝名簿生徒・列＝評価項目（value／加減点／理由／コメント）で
 * Excelコピペ対応の一括入力を提供する。変更は自動保存される。
 *
 * **入力は自由。** 文字評価は変換表に無い評語もそのまま保存する（弾くと、教員が
 * 打った「認定」がどこにも残らず、後から拾えない）。変換表に無いことに気づく口は
 * 2つだけ持つ: このマスが赤いことと、評価項目（03）での列挙。
 */
export function CourseworkScoresContainer({
  courseworkId,
}: CourseworkScoresContainerProps) {
  const { data: coursework, isPending: loading } = useQuery(
    courseworkDetailQuery(courseworkId)
  )
  const { data: courseworkStudents = EMPTY_STUDENTS } = useQuery(
    courseworkStudentsQuery(courseworkId)
  )
  const { data: courseworkClassrooms = EMPTY_CLASSROOMS } = useQuery(
    courseworkClassroomsQuery(courseworkId)
  )
  const upsertScores = useMutation(upsertCourseworkScoresMutation())

  const items = useMemo(
    () => sortCourseworkItems(coursework?.items ?? []),
    [coursework]
  )
  // 評価項目ごとの点数。資料ページと同じキーなので取得は共有される
  const scoreQueries = useQueries({
    queries: items.map((item) => courseworkScoresQuery(item.id)),
  })
  const studentRows = useMemo(() => {
    const scoresByItem = new Map(
      items.map((item, index) => [item.id, scoreQueries[index]?.data ?? []])
    )
    const registeredClassroomIds = new Set(
      courseworkClassrooms.map(
        (courseworkClassroom) => courseworkClassroom.classroomId
      )
    )
    return buildCourseworkStudentRows(
      items,
      courseworkStudents,
      registeredClassroomIds,
      scoresByItem
    )
  }, [items, scoreQueries, courseworkStudents, courseworkClassrooms])

  const bulkUpdateCells = useCallback(
    (
      changes: {
        courseworkItemId: string
        courseworkStudentId: string
        patch: CourseworkCellPatch
      }[]
    ) => {
      if (changes.length === 0) return
      upsertScores.mutate(
        changes.map((change) => ({
          courseworkItemId: change.courseworkItemId,
          courseworkStudentId: change.courseworkStudentId,
          ...change.patch,
        }))
      )
    },
    [upsertScores]
  )

  /**
   * 全角の確認を待っている貼り付け。
   *
   * `answer` を呼ぶと `transformPastedText` の約束が果たされ、表への配布が進む。
   * 尋ねるのは貼り付け1回につき1度で、設定としては持たない（効く瞬間にだけ尋ねる）。
   */
  const [pendingPaste, setPendingPaste] = useState<{
    answer: (toHalfWidthChars: boolean) => void
  } | null>(null)

  const confirmPastedText = useCallback(
    (pastedText: string) =>
      new Promise<string>((resolve) => {
        if (!containsFullWidth(pastedText)) {
          resolve(pastedText)
          return
        }
        setPendingPaste({
          answer: (toHalfWidthChars: boolean) => {
            setPendingPaste(null)
            resolve(toHalfWidthChars ? toHalfWidth(pastedText) : pastedText)
          },
        })
      }),
    []
  )

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
              // 文字評価は入力どおり保存する。赤は「変換表に無い」という注意で、
              // 変換表を1つも作っていない段階では判定しない（全マスが赤くても
              // 直しようがない）。数値は有限の数値なら有効で、満点超過も負数も
              // 許容する（配点の枠を超えて成績へ加減できる仕様）。
              invalidValuePolicy: isLetter ? "keep" : "reject",
              validate: (value: string) => {
                if (isLetter) return !isUnknownLetterValue(item, value)
                const normalized = normalizeInput(value)
                if (normalized === "") return true
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
          // value列（数値 or 文字評価）
          const valueColumnId = item.id
          if (newRow[valueColumnId] !== oldRow[valueColumnId]) {
            if (item.inputMode === "letter") {
              // 入力された文字をそのまま保存する。変換表に無い評語も保存し、
              // 気づく口は「マスが赤いこと」と「評価項目の画面での列挙」が持つ
              const letterValue = letterValueOf(newRow[valueColumnId] ?? "")
              pushPatch(item, courseworkStudentId, {
                letterValue: letterValue === "" ? null : letterValue,
              })
            } else {
              const trimmed = normalizeInput(newRow[valueColumnId] ?? "")
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
          transformPastedText={confirmPastedText}
        />
      </div>

      {/*
        全角を黙って半角へ変えない。`Ａ` と `A` が別の評語でありうるので、
        寄せてよいかを貼り付けのたびに（1回だけ）尋ねる。閉じただけのときは
        「そのまま」と同じ扱いにする（黙って変換する方には倒さない）。
      */}
      <AlertDialog
        open={pendingPaste !== null}
        onOpenChange={(open) => {
          if (!open) pendingPaste?.answer(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>全角文字が検知されました</AlertDialogTitle>
            <AlertDialogDescription>
              半角文字でよろしいですか？「そのまま貼り付ける」を選ぶと、貼り付けた文字のまま入力します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => pendingPaste?.answer(false)}>
              そのまま貼り付ける
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingPaste?.answer(true)}>
              半角にする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
