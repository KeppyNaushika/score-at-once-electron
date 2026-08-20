import type { Prisma } from "@prisma/client"
import * as fsPromises from "fs/promises"

import type { ExamProgressSource } from "../../../src/lib/examStatus"
import { DELETION_COUNT_NAME } from "../../../src/lib/shared/deletionCountNames"
import type { ConfirmedDeletionCount } from "../../../src/types/deletionConfirmation.types"
import { toScoringStatus } from "../../../src/types/scoringStatus.types"
import { getExamDirectory } from "../dataManager"
import { diffFields, recordAuditLog } from "./auditLog"
import prisma from "./client"
import { deleteAfterRecount } from "./deleteAfterRecount"
import { examPageWithContentInclude } from "./examPage"

/**
 * 進捗計算（renderer の getExamProgress）が読む元データの select。
 * 一覧と単体取得で同じ形を返すため、選択列はここが唯一の定義になる。
 * 進捗そのものは main では算出しない（計算の唯一の実装は renderer）。
 */
const examProgressSourceInclude = {
  examPages: {
    include: {
      studentAnswerImages: true,
      cropRegions: { include: { questionScores: true } },
    },
  },
  examSubtotalGroups: true,
  examStudents: true,
} satisfies Prisma.ExamInclude

/** 試験一覧用の軽量クエリ（ステップ判定に必要な最小限のデータのみ取得、ユーザーでフィルタリング） */
export const getExamsForList = async (userId: string) => {
  return prisma.exam.findMany({
    where: {
      userExams: {
        some: {
          userId,
        },
      },
    },
    include: {
      examTags: {
        include: { tag: true },
        orderBy: { tag: { order: "asc" } },
      },
      ...examProgressSourceInclude,
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

/**
 * 進捗計算の元データを、renderer が読む形へ整える。
 *
 * examPage 配下に入れ子になっている採点領域・答案画像を平坦化し、Decimal の partialScore を
 * number へ変換する（Prisma の Decimal は IPC を渡ると壊れるため境界で1回だけ変換する）。
 * 一覧と単体取得の双方がこれを通るので、変換の実装はここだけになる。
 */
export const toExamProgressSource = (
  exam: Prisma.ExamGetPayload<{ include: typeof examProgressSourceInclude }>
): ExamProgressSource => ({
  examPages: exam.examPages.map((examPage) => ({ id: examPage.id })),
  cropRegions: exam.examPages.flatMap((examPage) =>
    examPage.cropRegions.map((cropRegion) => ({
      type: cropRegion.type,
      questionScores: cropRegion.questionScores.map((questionScore) => ({
        status: toScoringStatus(questionScore.status),
        examStudentId: questionScore.examStudentId,
        partialScore:
          questionScore.partialScore == null
            ? null
            : Number(questionScore.partialScore),
      })),
    }))
  ),
  answerImages: exam.examPages.flatMap((examPage) =>
    examPage.studentAnswerImages.map((studentAnswerImage) => ({
      examStudentId: studentAnswerImage.examStudentId,
    }))
  ),
  examStudents: exam.examStudents,
  examSubtotalGroups: exam.examSubtotalGroups,
})

/** IDで試験を取得する（全リレーション含む: userExams・examPages・examSubtotalGroups・examStudents） */
export const getExamById = async (id: string) => {
  return prisma.exam.findUnique({
    where: { id },
    include: {
      userExams: {
        include: {
          user: true,
        },
      },
      examPages: {
        include: {
          studentAnswerImages: {
            include: {
              examStudent: { include: { student: true } },
            },
          },
          cropRegions: {
            // 進捗計算は questionScores のスカラーのみ読むため examStudent/user は join しない
            include: {
              questionScores: true,
            },
            orderBy: {
              orderIndex: "asc",
            },
          },
        },
        orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
      },
      examSubtotalGroups: {
        include: {
          subtotalGroup: {
            include: {
              subtotals: {
                orderBy: {
                  order: "asc",
                },
              },
            },
          },
        },
      },
      examStudents: {
        include: {
          student: true,
        },
        orderBy: {
          customOrder: "asc",
        },
      },
      examTags: {
        include: { tag: true },
        orderBy: { tag: { order: "asc" } },
      },
      // 試験削除時に参照を失う（examIdがSetNull・cropRegion経由はcascade削除）成績データソース
      gradeDataSources: true,
    },
  })
}

/** 試験の基本スカラーのみを取得する（リレーション無し・軽量）。編集/スカラー参照用途向け。 */
export const getExam = async (id: string) => {
  return prisma.exam.findUnique({ where: { id } })
}

/**
 * 試験スカラー + examPages（模範解答画像を含む）を1クエリで取得する。
 * 採点画面（07）がタイトル用 examName とページ画像を必要とする用途向け。
 */
export const getExamWithPages = async (id: string) => {
  return prisma.exam.findUnique({
    where: { id },
    include: {
      examPages: {
        include: examPageWithContentInclude,
        orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
      },
    },
  })
}

/** 試験を作成し、指定ユーザーをOWNERとしてUserExamに登録する */
export const createExam = async (
  data: Omit<Prisma.ExamCreateInput, "userExams">,
  userId: string
) => {
  const exam = await prisma.exam.create({
    data: {
      ...data,
      userExams: {
        create: {
          userId: userId,
          role: "OWNER",
        },
      },
    },
    include: {
      userExams: {
        include: {
          user: true,
        },
      },
      examPages: {
        include: {
          studentAnswerImages: true,
          cropRegions: true,
        },
      },
      examSubtotalGroups: {
        include: {
          subtotalGroup: {
            include: {
              subtotals: true,
            },
          },
        },
      },
      examStudents: true,
      examTags: {
        include: { tag: true },
        orderBy: { tag: { order: "asc" } },
      },
    },
  })

  // 監査ログ（リファレンス計装）。失敗しても主操作は壊さない。
  await recordAuditLog({
    action: "exam.create",
    userId,
    entityType: "Exam",
    entityId: exam.id,
    scopeId: exam.id,
    scopeLabel: exam.examName,
    target: exam.examName,
  })

  return exam
}

/** 試験情報を更新する */
export const updateExam = async (id: string, data: Prisma.ExamUpdateInput) => {
  // 差分記録用に変更前を取得
  const before = await prisma.exam.findUnique({
    where: { id },
  })

  const exam = await prisma.exam.update({
    where: { id },
    data,
  })

  await recordAuditLog({
    action: "exam.update",
    entityType: "Exam",
    entityId: exam.id,
    scopeId: exam.id,
    scopeLabel: exam.examName,
    target: exam.examName,
    changes: diffFields(before ?? undefined, exam, [
      { field: "examName", label: "試験名" },
      { field: "examDate", label: "試験日" },
      { field: "description", label: "説明" },
    ]),
  })

  return exam
}

/**
 * 試験を消すと巻き添えになるものを、削除の確認で見せる形で数える。
 *
 * **画面と同じ定義で数えること。** 画面（`DeleteExamModal`）は `fetch-exam-by-id` の
 * include の木を renderer で数えている。ここはその木を数え直す SQL 版であり、
 * 数え方が食い違うと削除が通らなくなる（段階26）。
 */
const countExamDeletionCounts = async (
  client: Prisma.TransactionClient,
  examId: string
): Promise<ConfirmedDeletionCount[]> => {
  const [
    masterAnswerCount,
    cropRegionCount,
    answerSheetCount,
    gradeDataSourceCount,
  ] = await Promise.all([
    // 模範解答は「画像の入ったページ」を数える。画面は
    // `filter((examPage) => examPage.imagePath)` なので、空文字も画像なしとして
    // 落とす（旧データには imagePath="" のページがある）
    client.examPage.count({
      where: { examId, NOT: [{ imagePath: null }, { imagePath: "" }] },
    }),
    client.cropRegion.count({ where: { examPage: { examId } } }),
    client.studentAnswerImage.count({ where: { examPage: { examId } } }),
    client.gradeDataSource.count({ where: { examId } }),
  ])

  return [
    {
      countedName: DELETION_COUNT_NAME.masterAnswer,
      shownCount: masterAnswerCount,
    },
    {
      countedName: DELETION_COUNT_NAME.cropRegion,
      shownCount: cropRegionCount,
    },
    {
      countedName: DELETION_COUNT_NAME.answerSheet,
      shownCount: answerSheetCount,
    },
    {
      countedName: DELETION_COUNT_NAME.gradeDataSource,
      shownCount: gradeDataSourceCount,
    },
  ].filter((deletionCount) => deletionCount.shownCount > 0)
}

/**
 * 試験を削除する（DBレコードのcascade削除に加え、画像ファイルのディレクトリも削除する）
 *
 * @param confirmedCounts 利用者が確認ダイアログで見た件数。消す直前に数え直し、
 *   増えていれば削除を中止する（`deleteAfterRecount`）。
 */
export const deleteExam = async (
  id: string,
  confirmedCounts: ConfirmedDeletionCount[]
) => {
  const before = await prisma.exam.findUnique({
    where: { id },
  })

  const exam = await deleteAfterRecount({
    confirmedCounts,
    recount: (tx) => countExamDeletionCounts(tx, id),
    remove: (tx) => tx.exam.delete({ where: { id } }),
    // 採点済みの試験では cascade で消える行数が多く、既定の 5s を超えうる
    timeoutMs: 30000,
  })

  // 模範解答・答案の画像はDBのcascadeでは消えないため、試験ディレクトリごと削除する。
  // ファイル削除の失敗で試験削除自体を巻き戻さない（DBは既に削除済み）。
  try {
    await fsPromises.rm(getExamDirectory(id), { recursive: true, force: true })
  } catch (fileError) {
    console.warn(`Failed to delete exam directory for ${id}:`, fileError)
  }

  await recordAuditLog({
    action: "exam.delete",
    entityType: "Exam",
    entityId: id,
    scopeId: id,
    scopeLabel: before?.examName ?? null,
    target: before?.examName ?? null,
  })

  return exam
}
