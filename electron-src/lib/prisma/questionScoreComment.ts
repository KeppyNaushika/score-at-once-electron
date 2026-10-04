/**
 * 採点行（QuestionScore）の覚え書き（その点にした理由）の書き込み。
 *
 * 覚え書きは採点とは別の操作なので、採点の書き込み（`questionScoreWrite.ts`）とは
 * 別の口で受ける。
 */

import { recordAuditLog } from "./auditLog"
import {
  resolveExamScopeByCropRegion,
  resolveExamStudentLabel,
} from "./auditScope"
import prisma from "./client"
import { PUBLIC_USER_OMIT } from "./publicUser"
import {
  ensureQuestionScore,
  type EnsureQuestionScoreData,
} from "./questionScoreWrite"

/**
 * `setQuestionScoreComment` の引数。行の同定（受験者×設問×採点者）＋ 覚え書き。
 *
 * 判定・部分点は持たない。**覚え書きは採点とは別の操作**で、同じ口で受けると
 * 「覚え書きだけ直したいのに判定も送らされる」形になり、送らなかった側が
 * 黙って初期値へ戻る。
 */
export interface SetQuestionScoreCommentData extends EnsureQuestionScoreData {
  /** その点にした理由。空文字は「書いていない」と同じ（列は NULL を持たない） */
  comment: string
}

/**
 * その採点者が、その点にした理由の覚え書きを書く。
 *
 * **かつて `UpdateQuestionScoreData` に `comment?: string` という項目があったが、
 * `QuestionScore` に列が無く、渡しても何も起きなかった**（段階34 で撤去済み）。
 * 今度は列が実在し（`comment String @default("")`）、ここが唯一の書き込み口である。
 *
 * 採点行が無ければ用意する（`ensureQuestionScore`）。手書き注釈と同じ形で、
 * 「まだ採点していないマスに覚え書きだけ書く」を通すため。
 *
 * **ただし空の覚え書きで行は作らない。** 覚え書き欄を開いて何も書かずに離れた
 * だけで `status:"unscored"` の空行が増えると、設問をめくるだけで行が量産されて
 * いた頃に戻る。書いていない覚え書きは
 * 行の不在でそのまま表せる。
 *
 * @returns 書いた行。何も書かなかったとき（行が無く、覚え書きも空）は null
 */
export const setQuestionScoreComment = async (
  data: SetQuestionScoreCommentData
) => {
  const include = {
    examStudent: { include: { student: true } },
    cropRegion: true,
    user: { omit: PUBLIC_USER_OMIT },
  }

  const existing = await prisma.questionScore.findFirst({
    where: {
      examStudentId: data.examStudentId,
      cropRegionId: data.cropRegionId,
      userId: data.userId,
    },
    include,
  })

  if (!existing && data.comment === "") return null
  if (existing && existing.comment === data.comment) return existing

  const target =
    existing ??
    (await ensureQuestionScore({
      examStudentId: data.examStudentId,
      cropRegionId: data.cropRegionId,
      userId: data.userId,
    }))

  const updated = await prisma.questionScore.update({
    where: { id: target.id },
    data: { comment: data.comment },
    include,
  })

  const scope = await resolveExamScopeByCropRegion(data.cropRegionId)
  const studentLabel = await resolveExamStudentLabel(data.examStudentId)
  await recordAuditLog({
    action: "exam.score.comment",
    userId: data.userId,
    entityType: "QuestionScore",
    entityId: updated.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    summary: studentLabel
      ? `「${studentLabel}」の採点に覚え書きを残しました`
      : "採点に覚え書きを残しました",
    changes: [
      {
        field: "comment",
        label: "覚え書き",
        before: existing?.comment ?? "",
        after: data.comment,
      },
    ],
  })

  return updated
}
