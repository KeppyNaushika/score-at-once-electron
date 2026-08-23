"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { BarChart3, GraduationCap, Users } from "lucide-react"
import { useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  examClassroomsQuery,
  updateExamClassroomMutation,
} from "@/queries/examClassroom"

interface StatisticsClassroomSelectorProps {
  examId: string
}

/**
 * 統計対象学級の選択（Phase 3）
 *
 * 試験に登録された学級ごとに「教員集計(teacherStatistics)」「生徒表示(studentReport)」を切り替える。
 * - 教員集計: Excel の学級平均行に出す学級
 * - 生徒表示: 個人成績表の学級比較に出す学級（生徒に渡るので慎重に）
 * どちらも複数選択可（1人の生徒が複数学級の平均に数えられる）。受験生徒画面(05)の再採番とは別軸。
 */
export function StatisticsClassroomSelector({
  examId,
}: StatisticsClassroomSelectorProps) {
  const { data: classrooms = [], isPending: loading } = useQuery({
    ...examClassroomsQuery(examId),
    enabled: Boolean(examId),
  })
  const { mutateAsync: updateExamClassroom } = useMutation(
    updateExamClassroomMutation(examId)
  )

  /**
   * 押した直後の値を手元に持つ。
   *
   * キャッシュには書かない（＝楽観更新ではない）。DB の値が返ってくるまで
   * チェックが動かないと、取り消そうとした2度目のクリックが1度目と同じ値を
   * 送ってしまい、黙って失われる。持つのはこのコンポーネントだけ。
   */
  const [pressed, setPressed] = useState<
    Record<string, { teacherStatistics?: boolean; studentReport?: boolean }>
  >({})

  /**
   * 書いた値が返ってきたら手元の覚えを捨てる。
   *
   * 捨てないと、他の教員が同じ学級の設定を変えても手元の値が勝ち続ける。
   * レンダー中の setState は同じコンポーネント宛てなので自分で止まる。
   */
  const settled = classrooms.filter((examClassroom) => {
    const pressedFlags = pressed[examClassroom.id]
    if (!pressedFlags) return false
    return (
      (pressedFlags.teacherStatistics === undefined ||
        pressedFlags.teacherStatistics === examClassroom.teacherStatistics) &&
      (pressedFlags.studentReport === undefined ||
        pressedFlags.studentReport === examClassroom.studentReport)
    )
  })
  if (settled.length > 0) {
    setPressed((previous) => {
      const next = { ...previous }
      for (const examClassroom of settled) delete next[examClassroom.id]
      return next
    })
  }

  /** チェックは1回で確定するので即時に書く。失敗の通知と取り直しは共通の後始末が担う */
  const setFlag = async (
    examClassroomId: string,
    patch: { teacherStatistics?: boolean; studentReport?: boolean }
  ) => {
    setPressed((previous) => ({
      ...previous,
      [examClassroomId]: { ...previous[examClassroomId], ...patch },
    }))
    try {
      await updateExamClassroom({ id: examClassroomId, ...patch })
    } catch {
      // 書けなかったときは DB の値が変わらないので、上の「一致したら捨てる」では
      // 手元の覚えが永久に残る。チェックが入ったまま「保存済み」に見えるので、
      // ここで捨てて DB の値へ戻す（失敗の通知は共通の後始末が出す）
      setPressed((previous) => {
        const next = { ...previous }
        delete next[examClassroomId]
        return next
      })
    }
  }

  if (loading) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        読み込み中...
      </p>
    )
  }

  if (classrooms.length === 0) {
    return (
      <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">
        <p>統計対象にできる学級がありません</p>
        <p className="mt-1">受験生徒画面で学級を登録してください</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs text-muted-foreground">
        学級ごとに平均点を出す対象を選びます。
        <span className="font-medium text-foreground">教員集計</span>
        はExcelの学級平均行、
        <span className="font-medium text-foreground">生徒表示</span>
        は個人成績表の学級比較に出ます（生徒に渡るので慎重に）。
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>学級</TableHead>
              <TableHead className="text-center">生徒数</TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <BarChart3 className="h-4 w-4" />
                  <span>教員集計</span>
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <GraduationCap className="h-4 w-4" />
                  <span>生徒表示</span>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classrooms.map((examClassroom) => {
              // 書いた値が返ってきたら手元の覚えは役目を終える
              const pressedFlags = pressed[examClassroom.id]
              const teacherStatistics =
                pressedFlags?.teacherStatistics ??
                examClassroom.teacherStatistics
              const studentReport =
                pressedFlags?.studentReport ?? examClassroom.studentReport

              return (
                <TableRow key={examClassroom.id}>
                  <TableCell className="font-medium">
                    {examClassroom.classroom.name}
                    {examClassroom.classroom.grade != null && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {examClassroom.classroom.grade}年
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {examClassroom.classroom.memberships.length}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={teacherStatistics}
                      onCheckedChange={(checked) => {
                        void setFlag(examClassroom.id, {
                          teacherStatistics: checked === true,
                        })
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={studentReport}
                      onCheckedChange={(checked) => {
                        void setFlag(examClassroom.id, {
                          studentReport: checked === true,
                        })
                      }}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
