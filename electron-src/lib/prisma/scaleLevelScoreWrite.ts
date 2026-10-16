/**
 * 類型評価の設問で、自分の採点行に類型を付ける・外す（docs/vlm-grading-design.md §4-8-2・§4-8-6）。
 *
 * 類型を付けた行は `status` を `evaluated`、`scaleLevelId` をその類型、`partialScore` を null にする。
 * 点は書かない（読むときに類型の点数を引く）。外すと `unscored` に戻し、類型も null にする。
 *
 * 点の採点の書き込み（`questionScoreWrite.ts`）とは口を分ける。あちらは判定と部分点の
 * 「1つの決定」を受け、類型を書かない（書くときは類型を null に戻す）。ここは類型だけを受ける。
 *
 * 付けられるのは、その設問が使っている類型評価の類型だけ。採点者は認証ストアの操作者で、
 * renderer から利用者 id を受け取らない（ルーブリック採点の書き込みと同じ）。
 *
 * 採点項目を当てているマスで類型のキーを押すと、項目より優先する手での上書きになる
 * （`overridesRubric`。点の採点の書き込みの `rubricOverrideFor` と同じ決め方。§4-5・§4-8-6）
 *
 * 監査ログは正誤と同じく採点行1件ごとに残す（生徒と設問を対象に持ち、採点と部分点の前後を差分にする）。
 * まとめて付けても、誰の何を何から何にしたかを引けるようにするため
 */

import prisma from "./client"
import { assertCropRegionsInSameExam } from "./examScopeGuard"
import {
  previousScoreLabel,
  recordScoreAudit,
  scoreStatusLabel,
} from "./questionScoreWrite"

/** そのマスに採点項目の適用があれば、キーで付けた類型は項目より優先する（手での上書き） */
const rubricOverrideFor = (row: { rubricApplications: unknown[] }) =>
  row.rubricApplications.length > 0

export interface SetScaleLevelsInput {
  cropRegionId: string
  examStudentIds: string[]
  /** 付ける類型。null なら外す（未採点に戻す） */
  scaleLevelId: string | null
}

/**
 * 類型をまとめて付ける・外す。書いた採点行を返す（外したときに行が無かったマスは返さない）
 */
export async function setScaleLevels(
  input: SetScaleLevelsInput,
  actorUserId: string
) {
  if (input.examStudentIds.length === 0) return []
  await assertCropRegionsInSameExam(
    input.examStudentIds.map((examStudentId) => ({
      cropRegionId: input.cropRegionId,
      examStudentId,
    }))
  )

  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: input.cropRegionId },
  })
  if (!cropRegion) throw new Error("採点領域が見つかりません")
  const scaleLevel =
    input.scaleLevelId === null
      ? null
      : await prisma.scoreScaleLevel.findUnique({
          where: { id: input.scaleLevelId },
        })
  if (input.scaleLevelId !== null) {
    if (!scaleLevel) throw new Error("類型が見つかりません")
    if (scaleLevel.scaleId !== cropRegion.scoreScaleId) {
      throw new Error("この設問の類型表の類型ではありません")
    }
  }

  const existingRows = await prisma.questionScore.findMany({
    where: {
      cropRegionId: input.cropRegionId,
      userId: actorUserId,
      examStudentId: { in: input.examStudentIds },
    },
    include: { rubricApplications: true, scaleLevel: true },
  })
  const existingByExamStudentId = new Map(
    existingRows.map((row) => [row.examStudentId, row])
  )
  const examStudents = await prisma.examStudent.findMany({
    where: { id: { in: input.examStudentIds } },
    include: { student: true },
  })
  const studentByExamStudentId = new Map(
    examStudents.map((examStudent) => [examStudent.id, examStudent.student])
  )
  if (studentByExamStudentId.size < new Set(input.examStudentIds).size) {
    throw new Error("受験生徒が見つかりません")
  }

  const written = []
  for (const examStudentId of input.examStudentIds) {
    const existing = existingByExamStudentId.get(examStudentId)
    const student = studentByExamStudentId.get(examStudentId)
    if (!student) continue
    if (scaleLevel === null) {
      if (!existing) continue
      const cleared = await prisma.questionScore.update({
        where: { id: existing.id },
        data: {
          status: "unscored",
          scaleLevelId: null,
          partialScore: null,
          overridesRubric: rubricOverrideFor(existing),
        },
      })
      await recordScoreAudit({
        action: "exam.score.update",
        scoreId: cleared.id,
        student,
        cropRegion,
        userId: actorUserId,
        changes: [
          {
            field: "status",
            label: "採点",
            before: previousScoreLabel(existing),
            after: scoreStatusLabel(cleared.status),
          },
          {
            field: "partialScore",
            label: "部分点",
            before:
              existing.partialScore != null
                ? Number(existing.partialScore)
                : null,
            after: null,
          },
        ],
      })
      written.push(cleared)
      continue
    }
    const evaluated = existing
      ? await prisma.questionScore.update({
          where: { id: existing.id },
          data: {
            status: "evaluated",
            scaleLevelId: scaleLevel.id,
            partialScore: null,
            overridesRubric: rubricOverrideFor(existing),
          },
        })
      : await prisma.questionScore.create({
          data: {
            cropRegionId: input.cropRegionId,
            examStudentId,
            userId: actorUserId,
            status: "evaluated",
            scaleLevelId: scaleLevel.id,
            partialScore: null,
          },
        })
    await recordScoreAudit({
      action: "exam.score.evaluate",
      scoreId: evaluated.id,
      student,
      cropRegion,
      userId: actorUserId,
      changes: [
        {
          field: "status",
          label: "採点",
          before: existing ? previousScoreLabel(existing) : null,
          after: scaleLevel.label,
        },
        ...(existing
          ? [
              {
                field: "partialScore",
                label: "部分点",
                before:
                  existing.partialScore != null
                    ? Number(existing.partialScore)
                    : null,
                after: null,
              },
            ]
          : []),
      ],
    })
    written.push(evaluated)
  }
  return written
}
