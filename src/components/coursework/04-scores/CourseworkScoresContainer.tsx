"use client"

import { useMutation, useQueries, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useCallback, useMemo } from "react"

import { EditableTable } from "@/components/common/EditableTable"
import { useGradeLock } from "@/components/common/grade-lock/GradeLockProvider"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import {
  courseworkWorkflowSteps,
  nextStepLabel,
  workflowStep,
  workflowStepHref,
} from "@/lib/shared/workflowSteps"
import { parsePreference } from "@/lib/userPreferences"
import {
  type CourseworkClassroomRow,
  courseworkClassroomsQuery,
  courseworkDetailQuery,
  type CourseworkScoreRow,
  courseworkScoresQuery,
  courseworkStudentsQuery,
  upsertCourseworkScoresMutation,
} from "@/queries/coursework"
import {
  setUserPreferenceMutation,
  userPreferenceQuery,
} from "@/queries/settings"
import type { CourseworkStudentWithMemberships } from "@/types/coursework.types"

import { FullWidthPasteDialog } from "./components/FullWidthPasteDialog"
import {
  buildCourseworkStudentRows,
  sortCourseworkItems,
} from "./courseworkScoreTable"
import { useCourseworkScoreColumns } from "./hooks/useCourseworkScoreColumns"
import { useFullWidthPasteConfirmation } from "./hooks/useFullWidthPasteConfirmation"
import {
  countFilledAuxiliaryCells,
  diffScoreTableRows,
  type ScoreRow,
  toScoreTableRows,
} from "./scoreTableRows"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_STUDENTS: CourseworkStudentWithMemberships[] = []
const EMPTY_CLASSROOMS: CourseworkClassroomRow[] = []

/**
 * 評価項目ごとの点数を、評価項目の id で引ける形に集める。点数は自分の評価項目
 * （courseworkItemId）を持つので、問い合わせの並び（添字）に頼らない。参照が
 * 変わらないよう外に置く（`combine` は関数が同じなら結果を使い回す）
 */
const groupScoresByItem = (
  queries: { data?: CourseworkScoreRow[] }[]
): ReadonlyMap<string, CourseworkScoreRow[]> => {
  const scoresByItem = new Map<string, CourseworkScoreRow[]>()
  queries
    .flatMap((query) => query.data ?? [])
    .forEach((courseworkScore) => {
      const itemScores = scoresByItem.get(courseworkScore.courseworkItemId)
      if (itemScores) itemScores.push(courseworkScore)
      else scoresByItem.set(courseworkScore.courseworkItemId, [courseworkScore])
    })
  return scoresByItem
}

interface CourseworkScoresContainerProps {
  courseworkId: string
}

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
  // 成績算出が使う資料は資料ごとロックされる（layout）。点数の書き込みは main が
  // 止めるが、ロック中は点数の列も読み取り専用にして、打てるように見せない
  // （EditableTable は読み取り専用の列への入力・貼り付けを捨てるので、書き込みまで届かない）
  const { locked: scoresLocked } = useGradeLock()
  // 「点数だけ表示」は利用者の設定（既定は隠す。理由は userPreferences.ts）。
  // 隠すのは列だけで、行の値（加減点・理由・コメント）は持ったまま。貼り付けも
  // 行を写してから配るので、隠した列の値は変わらない
  const currentUser = useCurrentUser()
  const { data: storedScoreOnly } = useQuery(
    userPreferenceQuery(currentUser.id, "courseworkScoresScoreOnly")
  )
  const scoreOnly = parsePreference(
    "courseworkScoresScoreOnly",
    storedScoreOnly ?? null
  )
  const { mutate: setPreference } = useMutation(
    setUserPreferenceMutation(currentUser.id)
  )

  const items = useMemo(
    () => sortCourseworkItems(coursework?.items ?? []),
    [coursework]
  )
  // 評価項目ごとの点数。資料ページと同じキーなので取得は共有される
  const scoresByItem = useQueries({
    queries: items.map((item) => courseworkScoresQuery(item.id)),
    combine: groupScoresByItem,
  })
  const studentRows = useMemo(() => {
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
  }, [items, scoresByItem, courseworkStudents, courseworkClassrooms])

  const { confirmPastedText, isAsking, answerPendingPaste } =
    useFullWidthPasteConfirmation()

  const tableData = useMemo(
    () => toScoreTableRows(studentRows, items),
    [studentRows, items]
  )

  /** 隠している列（加減点・理由・コメント）に入力があるマスの数 */
  const hiddenFilledCellCount = useMemo(
    () => (scoreOnly ? countFilledAuxiliaryCells(studentRows, items) : 0),
    [scoreOnly, studentRows, items]
  )

  const columns = useCourseworkScoreColumns(items, scoreOnly, scoresLocked)

  const handleDataChange = useCallback(
    (nextRows: ScoreRow[]) => {
      // 変更前の値は今描画しているテーブルデータそのもの
      const changes = diffScoreTableRows(tableData, nextRows, items)
      if (changes.length === 0) return
      upsertScores.mutate(
        changes.map((change) => ({
          courseworkItemId: change.courseworkItemId,
          courseworkStudentId: change.courseworkStudentId,
          ...change.patch,
        }))
      )
    },
    [items, tableData, upsertScores]
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
            {`「${workflowStep(courseworkWorkflowSteps, "03-items").label}」の段で評価項目を追加してください`}
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <Button asChild>
            <Link
              href={workflowStepHref(
                `/coursework/${courseworkId}`,
                courseworkWorkflowSteps,
                "03-items"
              )}
            >
              {workflowStep(courseworkWorkflowSteps, "03-items").title}へ
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
        A/B/C）で入力します。加減点・理由・コメントは、「点数だけ表示」を切ると記入できます。変更は自動保存されます。
      </p>

      <div className="mb-4 space-y-1">
        <div className="flex items-center gap-2">
          <Switch
            id="coursework-score-only"
            checked={scoreOnly}
            onCheckedChange={(checked) =>
              setPreference({
                key: "courseworkScoresScoreOnly",
                value: checked,
              })
            }
          />
          <Label htmlFor="coursework-score-only">
            点数だけ表示（加減点・理由・コメントを隠す）
          </Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Excel
          から点数を複数列まとめて貼るときは、点数だけ表示にしてください。加減点などの列が並んでいると、2列目以降が加減点の列に入ります。隠している間も、入力済みの加減点・理由・コメントは消えません。
        </p>
        {hiddenFilledCellCount > 0 && (
          <p className="text-sm text-amber-700">
            隠している列に入力があります（{hiddenFilledCellCount}
            件）。見るときは「点数だけ表示」を切ってください。
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <EditableTable
          data={tableData}
          columns={columns}
          onDataChange={handleDataChange}
          allowDeleteRow={false}
          transformPastedText={confirmPastedText}
        />
      </div>

      <FullWidthPasteDialog open={isAsking} onAnswer={answerPendingPaste} />

      <div className="mt-6 flex justify-end">
        <Button asChild>
          <Link
            href={workflowStepHref(
              `/coursework/${courseworkId}`,
              courseworkWorkflowSteps,
              "05-results"
            )}
          >
            {nextStepLabel(courseworkWorkflowSteps, "05-results")}
          </Link>
        </Button>
      </div>
    </div>
  )
}
