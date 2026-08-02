/**
 * @fileoverview 描画アノテーション データベースサービス
 * @description 全描画ツールの統合CRUD操作（自動バックアップ付き）
 */

import type { Prisma } from "@prisma/client"

import type {
  AnnotationWithAuthor,
  AnnotationWithContext,
  DrawingCreateData,
  DrawingType,
  DrawingUpdateData,
} from "../../../src/types/drawingAnnotation.types"
import {
  narrowAnnotationUnions,
  narrowDrawableAnnotations,
} from "../../../src/types/drawingAnnotation.types"
import { recordAuditLog } from "./auditLog"
import { resolveExamScope, resolveExamScopeByQuestionScore } from "./auditScope"
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
 * 作成者を同梱する（設問の文脈が要らない経路）。
 *
 * 作成者は注釈自身ではなく親 QuestionScore が持つ。QuestionScore は
 * 「生徒×設問×採点者」で1行なので、注釈の持ち主は親から一意に決まる。
 */
export const annotationWithAuthorInclude = {
  questionScore: { include: { user: { omit: authorOmit } } },
} satisfies Prisma.DrawingAnnotationInclude

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
 * 描画アノテーションを作成する
 * @param data 作成データ（questionScoreIdは必須）
 * @returns Promise<AnnotationWithContext> 作成された描画アノテーション（設問の文脈付き）
 */
export async function createDrawingAnnotation(
  data: DrawingCreateData
): Promise<AnnotationWithContext> {
  try {
    // questionScoreIdは必須
    if (!data.questionScoreId) {
      throw new Error(
        "questionScoreId is required. QuestionScore must be created before adding annotations."
      )
    }

    // 外部キー制約の事前検証。
    // 併せて注釈の持ち主（＝親の採点者）をここで確定させる。注釈は自前の userId を
    // 持たないので、採点者を引数で受け取る余地そのものが無い。
    const parentQuestionScore = await prisma.questionScore.findUnique({
      where: { id: data.questionScoreId },
    })

    if (!parentQuestionScore) {
      throw new Error(`QuestionScore not found: ${data.questionScoreId}`)
    }

    const createData = {
      questionScoreId: data.questionScoreId,
      type: data.type,
      x: data.x,
      y: data.y,
      color: data.color || "#ef4444",
      // 線幅・文字サイズは mm（用紙サイズ基準）。既定値は schema と揃える
      // （`3` / `16` は px 時代の名残で、省略時に mm として保存されると
      //  4〜6倍の大きさで描画される）
      strokeWidth: data.strokeWidth ?? 0.5,
      width: data.width || 0.0,
      height: data.height || 0.0,
      endX: data.endX || 0.0,
      endY: data.endY || 0.0,
      lineStyle: data.lineStyle || "solid",
      text: data.text || "",
      fontSize: data.fontSize ?? 4.0,
      textBoxWidth: data.textBoxWidth || 0.0,
      textBoxHeight: data.textBoxHeight || 0.0,
      horizontalAlign: data.horizontalAlign || "left",
      verticalAlign: data.verticalAlign || "top",
      anchorDirection: data.anchorDirection || "top-left",
      displayX: data.displayX || 0.0,
      displayY: data.displayY || 0.0,
    }

    // 重複チェック: 全プロパティが完全一致するアノテーションが既に存在する場合はそれを返す。
    // アノテーションのコピー時は値を直接コピーするため、浮動小数点の丸め誤差は発生しない。
    // SQLite (IEEE 754 double) と JavaScript (IEEE 754 double) 間で値は保持される。
    const duplicate = await prisma.drawingAnnotation.findFirst({
      where: {
        questionScoreId: createData.questionScoreId,
        type: createData.type,
        x: createData.x,
        y: createData.y,
        color: createData.color,
        strokeWidth: createData.strokeWidth,
        width: createData.width,
        height: createData.height,
        endX: createData.endX,
        endY: createData.endY,
        lineStyle: createData.lineStyle,
        text: createData.text,
        fontSize: createData.fontSize,
        textBoxWidth: createData.textBoxWidth,
        textBoxHeight: createData.textBoxHeight,
        horizontalAlign: createData.horizontalAlign,
        verticalAlign: createData.verticalAlign,
        anchorDirection: createData.anchorDirection,
        displayX: createData.displayX,
        displayY: createData.displayY,
      },
      include: annotationWithContextInclude,
    })

    if (duplicate) {
      return narrowAnnotationUnions(serializePrisma(duplicate))
    }

    const result = await prisma.drawingAnnotation.create({
      data: {
        // フロントエンドで生成したIDがあれば使用、なければPrismaが自動生成
        ...(data.id && { id: data.id }),
        ...createData,
      },
      // 透明度制御に必要なquestionScore情報を含める
      include: annotationWithContextInclude,
    })

    // 監査ログ: 採点マーク追加（マークごとに個別記録。集約は同一idの連続操作のみ）
    const scope = await resolveExamScopeByQuestionScore(
      createData.questionScoreId
    )
    await recordAuditLog({
      action: "exam.annotation.create",
      userId: parentQuestionScore.userId,
      entityType: "DrawingAnnotation",
      entityId: result.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
    })

    return narrowAnnotationUnions(serializePrisma(result))
  } catch (error) {
    console.error("描画アノテーション作成エラー:", error)
    throw error
  }
}

/**
 * QuestionScoreに紐づく描画アノテーションを取得する
 *
 * 採点者による絞り込みは受け付けない。QuestionScore は「生徒×設問×採点者」で1行なので、
 * 同じ questionScoreId の注釈は全部同じ採点者のものであり、絞る余地が無い。
 *
 * @param questionScoreId QuestionScoreのID
 * @param type フィルタする描画タイプ（オプション）
 * @returns Promise<AnnotationWithAuthor[]> 描画アノテーション配列（作成者付き）
 */
export async function getDrawingAnnotationsByQuestionScore(
  questionScoreId: string,
  type?: DrawingType
): Promise<AnnotationWithAuthor[]> {
  // 読み取り専用操作のためバックアップ不要
  try {
    const result = await prisma.drawingAnnotation.findMany({
      where: {
        questionScoreId,
        ...(type && { type }),
      },
      orderBy: { createdAt: "asc" },
      include: annotationWithAuthorInclude,
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
 * 描画アノテーションを更新する
 * @param id 描画アノテーションのID
 * @param data 更新データ
 * @returns Promise<AnnotationWithContext> 更新された描画アノテーション（設問の文脈付き）
 */
export async function updateDrawingAnnotation(
  id: string,
  data: DrawingUpdateData
): Promise<AnnotationWithContext> {
  try {
    const result = await prisma.drawingAnnotation.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      // 透明度制御に必要なquestionScore情報を含める
      include: annotationWithContextInclude,
    })

    // 監査ログ: 採点マーク編集。同じマークの連続編集（移動・色変更等）は集約する。
    const scope = await resolveExamScopeByQuestionScore(result.questionScore.id)
    await recordAuditLog({
      action: "exam.annotation.update",
      userId: result.questionScore.userId,
      entityType: "DrawingAnnotation",
      entityId: result.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      coalesceKey: `annotation.update:${result.id}`,
      // テキスト注釈は after（最新テキスト）を上書き表示
      ...(typeof data.text === "string"
        ? {
            changes: [
              {
                field: "text",
                label: "テキスト",
                before: null,
                after: data.text,
              },
            ],
          }
        : {}),
    })

    return narrowAnnotationUnions(serializePrisma(result))
  } catch (error) {
    console.error("描画アノテーション更新エラー:", error)
    throw error
  }
}

/**
 * 描画アノテーションを削除する
 * @param id 描画アノテーションのID
 * @returns Promise<void>
 */
export async function deleteDrawingAnnotation(id: string): Promise<void> {
  try {
    // 削除前にtombstone記録用の情報を取得
    const annotation = await prisma.drawingAnnotation.findUnique({
      where: { id },
      include: {
        questionScore: {
          include: { cropRegion: { include: { examPage: true } } },
        },
      },
    })

    await prisma.drawingAnnotation.delete({
      where: { id },
    })

    if (annotation) {
      const examId = annotation.questionScore.cropRegion.examPage.examId

      // 監査ログ: 採点マーク削除（個別記録）
      const scope = await resolveExamScope(examId)
      await recordAuditLog({
        action: "exam.annotation.delete",
        entityType: "DrawingAnnotation",
        entityId: id,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
      })
    }
  } catch (error) {
    console.error("描画アノテーション削除エラー:", error)
    throw error
  }
}

/**
 * QuestionScoreに紐づく描画アノテーションを一括削除する
 * @param questionScoreId QuestionScoreのID
 * @param type 削除する描画タイプ（オプション）
 * @returns Promise<void>
 */
export async function deleteDrawingAnnotationsByQuestionScore(
  questionScoreId: string,
  type?: DrawingType
): Promise<void> {
  try {
    const where = {
      questionScoreId,
      ...(type && { type }),
    }

    await prisma.drawingAnnotation.deleteMany({ where })
  } catch (error) {
    console.error("描画アノテーション一括削除エラー:", error)
    throw error
  }
}

/**
 * 描画アノテーションを一括作成する
 * @param annotations 作成する描画アノテーション配列
 * @returns Promise<AnnotationWithContext[]> 作成された描画アノテーション配列（設問の文脈付き）
 */
export async function batchCreateDrawingAnnotations(
  annotations: DrawingCreateData[]
): Promise<AnnotationWithContext[]> {
  try {
    // 各アノテーションに対してcreateDrawingAnnotation関数を使用（QuestionScore自動作成機能を含む）
    const results = await Promise.all(
      annotations.map(async (data) => {
        return await createDrawingAnnotation(data)
      })
    )

    return results
  } catch (error) {
    console.error("描画アノテーション一括作成エラー:", error)
    throw error
  }
}

/**
 * アノテーションのお気に入りフラグを切り替える
 * @param id 描画アノテーションのID
 * @param isFavorite お気に入り状態
 * @returns Promise<AnnotationWithContext> 更新された描画アノテーション（設問の文脈付き）
 */
export async function toggleAnnotationFavorite(
  id: string,
  isFavorite: boolean
): Promise<AnnotationWithContext> {
  try {
    const result = await prisma.drawingAnnotation.update({
      where: { id },
      data: { isFavorite },
      include: annotationWithContextInclude,
    })

    return narrowAnnotationUnions(serializePrisma(result))
  } catch (error) {
    console.error("アノテーションお気に入り切替エラー:", error)
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
