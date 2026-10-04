/**
 * @fileoverview 描画アノテーション データベースサービス（読み取り）
 * @description 全描画ツールの注釈の取得と、注釈に同梱する文脈の include（SSOT）。
 *   作成・更新・削除は `drawingAnnotationWrite.ts` にある。
 */

import type { Prisma } from "@prisma/client"

import type {
  AnnotationTarget,
  AnnotationWithContext,
  DrawingAnnotation,
  DrawingType,
} from "../../../src/types/drawingAnnotation.types"
import { narrowDrawableAnnotations } from "../../../src/types/drawingAnnotation.types"
import prisma from "./client"
import { serializePrisma } from "./serializePrisma"

/**
 * アノテーションの作成者。パスコードだけを落とす。
 *
 * これは機密除去であって、表示のために列を削る縮小射影ではない
 * （規約: Prisma include の出力は射影せずそのまま持つ）。
 */
const authorOmit = { passcode: true } satisfies Prisma.UserOmit

/**
 * 一覧取得の共通後処理。描けない種別の行を落としてから union を絞る。
 *
 * 未知の種別は既定の `"line"` へ倒さない（倒すと終点を持たない行が原点への線として
 * 描かれる）。落とした件数は黙って飲まずに残す。
 */
function toDrawableAnnotations<
  T extends {
    type: string
    lineStyle: string
    horizontalAlign: string
    verticalAlign: string
    anchorDirection: string
  },
>(rows: T[], source: string) {
  const drawable = narrowDrawableAnnotations(rows)
  const dropped = rows.length - drawable.length
  if (dropped > 0) {
    console.warn(
      `描画種別が不明な採点マークを ${dropped} 件除外しました（${source}）`
    )
  }
  return drawable
}

/**
 * 作成者と設問の文脈を同梱する（SSOT）。
 *
 * 以前は経路ごとに `select` の中身が違い、どこかで `examStudentId` を落としても
 * `as` で潰した型が通ってしまい、注釈が実行時に消えていた。行をそのまま持つ。
 */
export const annotationWithContextInclude = {
  questionScore: {
    include: {
      user: { omit: authorOmit },
      cropRegion: true,
      examStudent: { include: { student: true } },
    },
  },
} satisfies Prisma.DrawingAnnotationInclude

/**
 * 行き先（答案＋設問＋採点者）に紐づく描画アノテーションを取得する。
 *
 * **採点行が無ければ空配列を返す。用意はしない。** 読むだけで行が増えるのは、
 * かつてやめた振る舞いそのものである。
 *
 * @param target 注釈の行き先（答案＋設問＋採点者）
 * @param type フィルタする描画タイプ（オプション）
 * @returns Promise<DrawingAnnotation[]> 描画アノテーション配列
 */
export async function getDrawingAnnotationsByTarget(
  target: AnnotationTarget,
  type?: DrawingType
): Promise<DrawingAnnotation[]> {
  try {
    const result = await prisma.drawingAnnotation.findMany({
      where: {
        questionScore: {
          examStudentId: target.examStudentId,
          cropRegionId: target.cropRegionId,
          userId: target.userId,
        },
        ...(type && { type }),
      },
      orderBy: { createdAt: "asc" },
    })

    return toDrawableAnnotations(
      serializePrisma(result),
      "getDrawingAnnotationsByTarget"
    )
  } catch (error) {
    console.error("描画アノテーション取得エラー:", error)
    throw error
  }
}

/**
 * QuestionScoreに紐づく描画アノテーションを取得する（main の内側専用）。
 *
 * 採点者による絞り込みは受け付けない。QuestionScore は「生徒×設問×採点者」で1行なので、
 * 同じ questionScoreId の注釈は全部同じ採点者のものであり、絞る余地が無い。
 *
 * IPC はこちらを通さない。renderer は行き先（`AnnotationTarget`）で呼ぶ。ここを使うのは
 * 既にリゾルバが採点行を決めている PDF 出力だけである。
 *
 * 関係は同梱しない。呼び出し側（Canvas・PDF 出力）は行を編集して書き戻すので、
 * 同梱した関係が付いてくると書き戻しの経路に載ってしまう。作成者が要るなら
 * 親 QuestionScore を持っている側で解決する。
 *
 * @param questionScoreId QuestionScoreのID
 * @param type フィルタする描画タイプ（オプション）
 * @returns Promise<DrawingAnnotation[]> 描画アノテーション配列
 */
export async function getDrawingAnnotationsByQuestionScore(
  questionScoreId: string,
  type?: DrawingType
): Promise<DrawingAnnotation[]> {
  // 読み取り専用操作のためバックアップ不要
  try {
    const result = await prisma.drawingAnnotation.findMany({
      where: {
        questionScoreId,
        ...(type && { type }),
      },
      orderBy: { createdAt: "asc" },
    })

    return toDrawableAnnotations(
      serializePrisma(result),
      "getDrawingAnnotationsByQuestionScore"
    )
  } catch (error) {
    console.error("描画アノテーション取得エラー:", error)
    throw error
  }
}

/**
 * 特定の受験者の全描画アノテーションを取得する（透明度制御用）
 * @param examStudentId 試験の受験者ID（ExamStudent.id）
 * @param type フィルタする描画タイプ（オプション）
 * @param userId 作成者のユーザーID（指定時はそのユーザーのアノテーションのみ取得）
 * @returns Promise<AnnotationWithContext[]> 描画アノテーション配列（設問情報付き）
 */
export async function getDrawingAnnotationsByExamStudent(
  examStudentId: string,
  type?: DrawingType,
  userId?: string
): Promise<AnnotationWithContext[]> {
  try {
    const result = await prisma.drawingAnnotation.findMany({
      where: {
        questionScore: {
          examStudentId,
          // 受験者の注釈には他の採点者の QuestionScore にぶら下がるものも含まれる。
          // 採点者で絞るときは親を辿る（注釈は自前の採点者を持たない）
          ...(userId && { userId }),
        },
        ...(type && { type }),
      },
      orderBy: { createdAt: "asc" },
      include: annotationWithContextInclude,
    })

    return toDrawableAnnotations(
      serializePrisma(result),
      "getDrawingAnnotationsByExamStudent"
    )
  } catch (error) {
    console.error("学生別描画アノテーション取得エラー:", error)
    throw error
  }
}

/**
 * CropRegion（設問）に紐づく全学生の描画アノテーションを取得する（Grid表示用）
 * @param cropRegionId CropRegionのID
 * @param userId 作成者のユーザーID（オプション）
 * @returns Promise<AnnotationWithContext[]> 描画アノテーション配列（questionScore 同梱）
 *
 * 返り値を `DrawingAnnotation[]` と名乗って `as` で潰すと、下の `select` から
 * examStudentId を落としても型検査が通り、グリッドの注釈が実行時に消える。
 * include した形をそのまま型で表明する。
 */
export async function getDrawingAnnotationsByCropRegion(
  cropRegionId: string,
  userId?: string
): Promise<AnnotationWithContext[]> {
  try {
    const result = await prisma.drawingAnnotation.findMany({
      where: {
        questionScore: {
          cropRegionId,
          // 設問の注釈には他の採点者の QuestionScore にぶら下がるものも含まれる。
          // 採点者で絞るときは親を辿る（注釈は自前の採点者を持たない）
          ...(userId && { userId }),
        },
      },
      orderBy: { createdAt: "asc" },
      include: annotationWithContextInclude,
    })

    // status 同様、DB 上 String の union 列を境界で literal union へ絞る
    return toDrawableAnnotations(
      serializePrisma(result),
      "getDrawingAnnotationsByCropRegion"
    )
  } catch (error) {
    console.error("設問別描画アノテーション取得エラー:", error)
    throw error
  }
}

/**
 * 試験全体のアノテーションをブラウズ用に取得する（コンテキスト情報付き）
 * @param examId 試験ID
 * @returns Promise<AnnotationWithContext[]> コンテキスト情報付きアノテーション配列
 */
export async function getAnnotationsForBrowse(
  examId: string
): Promise<AnnotationWithContext[]> {
  try {
    const result = await prisma.drawingAnnotation.findMany({
      where: {
        questionScore: {
          cropRegion: {
            examPage: {
              examId: examId,
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      include: annotationWithContextInclude,
    })

    // getDrawingAnnotationsByCropRegion と同じく、include した形を型で表明する
    // （`as` で潰すと select から examStudent を落としても型検査が通り、
    //  注釈ブラウザの氏名表示と生徒フィルタが実行時に壊れる）
    return toDrawableAnnotations(
      serializePrisma(result),
      "getAnnotationsForBrowse"
    )
  } catch (error) {
    console.error("ブラウズ用アノテーション取得エラー:", error)
    throw error
  }
}
