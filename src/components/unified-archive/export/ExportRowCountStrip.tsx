"use client"

import { EntityOverviewStatStrip } from "@/components/common/entity-overview/EntityOverviewStatStrip"
import type {
  EntityOverviewStat,
  EntityOverviewStatTone,
} from "@/components/common/entity-overview/types"

import { archiveTableLabel } from "../archiveTableLabels"
import { MAJOR_TABLES } from "./exportLabels"

/** 表ごとの色（試験・資料・成績算出・解答用紙・生徒のまとまりで色相を分ける） */
const TABLE_TONES: Readonly<Record<string, EntityOverviewStatTone>> = {
  Exam: "blue",
  ExamStudent: "blue",
  QuestionScore: "green",
  StudentAnswerImage: "orange",
  Coursework: "teal",
  CourseworkScore: "teal",
  Grade: "rose",
  GradeItem: "rose",
  AsbDefinition: "purple",
  Student: "indigo",
  Classroom: "indigo",
  StudentClassroomMembership: "indigo",
  User: "purple",
}

interface ExportRowCountStripProps {
  /** 表名 → 範囲に入る行の数 */
  rowCounts: Readonly<Record<string, number>>
  /** 当てている行を外したときの、表名 → 行の数の増減（減るなら負）。当てていなければ null */
  rowCountDeltas: Readonly<Record<string, number>> | null
}

/**
 * 書き出す内容を、試験の概要と同じ要約の帯で1行に並べる。入るものが無い表は出さない。
 * 行に当てているときは、外すと減る数を赤字で添える（例: 9 -3）
 */
export function ExportRowCountStrip({
  rowCounts,
  rowCountDeltas,
}: ExportRowCountStripProps) {
  const stats = MAJOR_TABLES.flatMap((table): EntityOverviewStat[] => {
    const rowCount = rowCounts[table] ?? 0
    if (rowCount === 0) return []
    const delta = rowCountDeltas?.[table] ?? 0
    return [
      {
        label: archiveTableLabel(table),
        value: (
          <>
            <span className="tabular-nums">{rowCount}</span>
            {delta !== 0 && (
              <span className="ml-1 text-destructive tabular-nums">
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
          </>
        ),
        tone: TABLE_TONES[table],
      },
    ]
  })

  return (
    <EntityOverviewStatStrip
      stats={stats}
      className="min-w-0 flex-nowrap overflow-x-auto border-t-0 pt-0 whitespace-nowrap"
    />
  )
}
