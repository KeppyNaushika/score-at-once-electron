"use client"

import { BarChart3, GraduationCap, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ExamClassroomWithMemberships } from "@/types/electron/examClassroomApi"

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
  const [classrooms, setClassrooms] = useState<ExamClassroomWithMemberships[]>(
    []
  )
  const [loading, setLoading] = useState(true)

  const fetchClassrooms = useCallback(async () => {
    if (!examId) return
    setLoading(true)
    try {
      const result = await window.electronAPI.examClassroom.getAll(examId)
      setClassrooms(result ?? [])
    } catch (err) {
      console.error("Failed to load exam classrooms:", err)
    } finally {
      setLoading(false)
    }
  }, [examId])

  useEffect(() => {
    fetchClassrooms()
  }, [fetchClassrooms])

  const updateFlag = useCallback(
    async (
      examClassroomId: string,
      patch: { teacherStatistics?: boolean; studentReport?: boolean }
    ) => {
      // 楽観的更新
      setClassrooms((prev) =>
        prev.map((examClassroom) =>
          examClassroom.id === examClassroomId
            ? { ...examClassroom, ...patch }
            : examClassroom
        )
      )
      try {
        await window.electronAPI.examClassroom.update({
          id: examClassroomId,
          ...patch,
        })
      } catch (err) {
        console.error("Failed to update exam class flags:", err)
        // 失敗時は再取得して整合
        fetchClassrooms()
      }
    },
    [fetchClassrooms]
  )

  if (loading) {
    return (
      <p className="text-muted-foreground p-4 text-center text-sm">
        読み込み中...
      </p>
    )
  }

  if (classrooms.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border py-8 text-center text-sm">
        <p>統計対象にできる学級がありません</p>
        <p className="mt-1">受験生徒画面で学級を登録してください</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground px-1 text-xs">
        学級ごとに平均点を出す対象を選びます。
        <span className="text-foreground font-medium">教員集計</span>
        はExcelの学級平均行、
        <span className="text-foreground font-medium">生徒表示</span>
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
            {classrooms.map((examClassroom) => (
              <TableRow key={examClassroom.id}>
                <TableCell className="font-medium">
                  {examClassroom.classroom.name}
                  {examClassroom.classroom.grade != null && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {examClassroom.classroom.grade}年
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-center text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {examClassroom.classroom.memberships.length}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={examClassroom.teacherStatistics}
                    onCheckedChange={(checked) =>
                      updateFlag(examClassroom.id, {
                        teacherStatistics: checked === true,
                      })
                    }
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={examClassroom.studentReport}
                    onCheckedChange={(checked) =>
                      updateFlag(examClassroom.id, {
                        studentReport: checked === true,
                      })
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
