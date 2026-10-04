"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { answerSheetDefinitionListQuery } from "@/queries/answerSheetBuilder"
import { courseworkListQuery } from "@/queries/coursework"
import { examListQuery } from "@/queries/exam"
import { gradeListQuery } from "@/queries/grade"
import { classroomListQuery, studentListQuery } from "@/queries/student"
import { subtotalGroupListQuery } from "@/queries/subtotal"
import { tagListQuery } from "@/queries/tag"
import { userListQuery } from "@/queries/user"

import { buildArchiveEntityCatalog } from "./archiveEntityCatalog"
import { ExportDialogBody } from "./ExportDialogBody"
import type { UnifiedArchiveExportInitialSelection } from "./types"

interface UnifiedArchiveExportPanelProps {
  initialSelection: UnifiedArchiveExportInitialSelection
  onExportingChange: (isExporting: boolean) => void
  onClose: () => void
}

/**
 * 統合アーカイブの書き出しの中身（選ぶ一覧・下見・書き出し）。書き出しダイアログと
 * データ書き出しのページが同じものを使う。実体の名前を引くために、既存の一覧を取って
 * から描く。親は縦の flex で高さを決めること（中の一覧が本文の中でスクロールする）
 */
export function UnifiedArchiveExportPanel({
  initialSelection,
  onExportingChange,
  onClose,
}: UnifiedArchiveExportPanelProps) {
  const currentUser = useCurrentUser()
  const { data: exams } = useQuery(examListQuery(currentUser.id))
  const { data: courseworks } = useQuery(courseworkListQuery())
  const { data: grades } = useQuery(gradeListQuery())
  const { data: answerSheetDefinitions } = useQuery(
    answerSheetDefinitionListQuery()
  )
  const { data: students } = useQuery(studentListQuery())
  const { data: classrooms } = useQuery(classroomListQuery())
  const { data: subtotalGroups } = useQuery(subtotalGroupListQuery())
  const { data: tags } = useQuery(tagListQuery())
  const { data: users } = useQuery(userListQuery())

  const catalog = useMemo(
    () =>
      buildArchiveEntityCatalog({
        exams: exams ?? [],
        courseworks: courseworks ?? [],
        grades: grades ?? [],
        answerSheetDefinitions: answerSheetDefinitions ?? [],
        students: students ?? [],
        classrooms: classrooms ?? [],
        subtotalGroups: subtotalGroups ?? [],
        tags: tags ?? [],
        users: users ?? [],
      }),
    [
      exams,
      courseworks,
      grades,
      answerSheetDefinitions,
      students,
      classrooms,
      subtotalGroups,
      tags,
      users,
    ]
  )

  return (
    <ExportDialogBody
      catalog={catalog}
      initialSelection={initialSelection}
      onExportingChange={onExportingChange}
      onClose={onClose}
    />
  )
}
