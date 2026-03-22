/**
 * @fileoverview 削除記録（Tombstone）データベースサービス
 * @description 物理削除されたレコードの追跡。インポート時の復活防止およびsqlite-nas-sync連携用。
 */

import type { PrismaClient } from "@prisma/client"

import prisma from "./client"

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

interface RecordDeletionOptions {
  userId?: string
  examId?: string
  tx?: Tx
}

/**
 * 単一の削除記録を作成
 */
export async function recordDeletion(
  tableName: string,
  recordId: string,
  options: RecordDeletionOptions = {}
): Promise<void> {
  const client = options.tx ?? prisma
  await client.deletedRecord.upsert({
    where: {
      tableName_recordId: { tableName, recordId },
    },
    update: {
      deletedAt: new Date(),
      userId: options.userId ?? null,
      examId: options.examId ?? null,
    },
    create: {
      tableName,
      recordId,
      userId: options.userId ?? null,
      examId: options.examId ?? null,
    },
  })
}

/**
 * 複数の削除記録をバッチ作成
 */
export async function recordDeletionsBatch(
  entries: Array<{
    tableName: string
    recordId: string
    userId?: string
    examId?: string
  }>,
  tx?: Tx
): Promise<void> {
  if (entries.length === 0) return

  const client = tx ?? prisma

  // createMany はSQLiteで skipDuplicates をサポートしないため、upsertをループで実行
  for (const entry of entries) {
    await client.deletedRecord.upsert({
      where: {
        tableName_recordId: {
          tableName: entry.tableName,
          recordId: entry.recordId,
        },
      },
      update: {
        deletedAt: new Date(),
        userId: entry.userId ?? null,
        examId: entry.examId ?? null,
      },
      create: {
        tableName: entry.tableName,
        recordId: entry.recordId,
        userId: entry.userId ?? null,
        examId: entry.examId ?? null,
      },
    })
  }
}

/**
 * QuestionScoreに紐づくDrawingAnnotationの削除記録を作成
 *
 * QuestionScore削除（cascade）の前に呼び出すこと。
 * examIdはquestionScore→cropRegion→examPage経由で解決。
 */
export async function recordDrawingAnnotationDeletionsForQuestionScores(
  questionScoreIds: string[],
  options: { userId?: string; tx?: Tx } = {}
): Promise<void> {
  if (questionScoreIds.length === 0) return

  const client = options.tx ?? prisma

  // 対象DrawingAnnotation IDsと紐づくexamIdを取得
  const annotations = await client.drawingAnnotation.findMany({
    where: { questionScoreId: { in: questionScoreIds } },
    select: {
      id: true,
      questionScore: {
        select: {
          cropRegion: {
            select: {
              examPage: {
                select: { examId: true },
              },
            },
          },
        },
      },
    },
  })

  if (annotations.length === 0) return

  const entries = annotations.map((ann) => ({
    tableName: "DrawingAnnotation",
    recordId: ann.id,
    userId: options.userId,
    examId: ann.questionScore.cropRegion.examPage.examId,
  }))

  await recordDeletionsBatch(entries, client as Tx)
}

/**
 * DrawingAnnotation where条件に一致するアノテーションの削除記録を作成
 *
 * DrawingAnnotation直接削除の前に呼び出すこと。
 */
export async function recordDrawingAnnotationDeletionsBeforeDelete(
  where: { questionScoreId: string; type?: string },
  options: { userId?: string; tx?: Tx } = {}
): Promise<void> {
  const client = options.tx ?? prisma

  const annotations = await client.drawingAnnotation.findMany({
    where,
    select: {
      id: true,
      questionScore: {
        select: {
          cropRegion: {
            select: {
              examPage: {
                select: { examId: true },
              },
            },
          },
        },
      },
    },
  })

  if (annotations.length === 0) return

  const entries = annotations.map((ann) => ({
    tableName: "DrawingAnnotation",
    recordId: ann.id,
    userId: options.userId,
    examId: ann.questionScore.cropRegion.examPage.examId,
  }))

  await recordDeletionsBatch(entries, client as Tx)
}

/**
 * 指定試験の削除記録を取得（エクスポート用）
 */
export async function getDeletedRecordsForExam(examId: string) {
  return prisma.deletedRecord.findMany({
    where: { examId },
  })
}

/**
 * 削除記録の存在チェック
 */
export async function isDeleted(
  tableName: string,
  recordId: string,
  tx?: Tx
): Promise<boolean> {
  const client = tx ?? prisma
  const record = await client.deletedRecord.findUnique({
    where: { tableName_recordId: { tableName, recordId } },
  })
  return record !== null
}
