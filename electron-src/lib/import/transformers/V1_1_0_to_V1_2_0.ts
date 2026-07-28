/**
 * v1.1.0 → v1.2.0 変換器
 *
 * アプリバージョン: v0.3.x → v0.4.x
 *
 * 主な変更点:
 * - PageImage → MasterImage + StudentAnswerImage に分離
 * - QuestionScore: scoredByUserId → userId (非NULL化)
 * - DrawingAnnotation: createdByUserId → userId (非NULL化)
 * - studentId の非NULL化
 *
 * 当時のDBスキーマ: `git show v0.3.2-beta.0:prisma/schema.prisma`
 * （ただし本変換器が扱うのはアーカイブJSONの形状であり、DBスキーマとは一致しない。
 *   旧形状は下の V1_1_0_* 型が正）
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

/**
 * v1.1.0 の PageImage 形式
 * （実アーカイブのフィールドは projectPageId。examPageId は将来キーとの両対応）
 */
interface V1_1_0_PageImage {
  id: string
  examPageId?: string
  projectPageId?: string
  studentId: string | null
  imagePath: string
  imageType: string // "MODEL_ANSWER" | "STUDENT_ANSWER"
  createdAt: string
  updatedAt: string
}

/**
 * v1.2.0 の MasterImage 形式
 */
interface V1_2_0_MasterImage {
  id: string
  examPageId: string
  imagePath: string
  createdAt: string
  updatedAt: string
}

/**
 * v1.2.0 の StudentAnswerImage 形式
 */
interface V1_2_0_StudentAnswerImage {
  id: string
  examPageId: string
  studentId: string
  imagePath: string
  createdAt: string
  updatedAt: string
}

/**
 * v1.1.0 の QuestionScore 形式（旧フィールド名対応）
 */
interface V1_1_0_QuestionScore {
  id: string
  cropRegionId: string
  studentId: string | null
  partialScore: string | null
  status: string
  scoredByUserId?: string | null // 旧フィールド名
  userId?: string | null // 新フィールド名（既に変換済みの場合）
  createdAt: string
  updatedAt: string
}

/**
 * v1.1.0 の DrawingAnnotation 形式（旧フィールド名対応）
 */
interface V1_1_0_DrawingAnnotation {
  id: string
  questionScoreId: string
  type: string
  x: number
  y: number
  color: string
  strokeWidth: number
  width: number
  height: number
  endX: number
  endY: number
  lineStyle: string
  text: string
  fontSize: number
  textBoxWidth: number
  textBoxHeight: number
  horizontalAlign: string
  verticalAlign: string
  anchorDirection: string
  displayX: number
  displayY: number
  createdByUserId?: string | null // 旧フィールド名
  userId?: string | null // 新フィールド名（既に変換済みの場合）
  isFavorite?: boolean // v1.6.0+（既に変換済みの場合のみ存在）
  createdAt: string
  updatedAt: string
}

/**
 * v1.1.0 → v1.2.0 変換器
 */
export class V1_1_0_to_V1_2_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.1.0"
  readonly toVersion: ExamArchiveVersion = "1.2.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const warnings: string[] = []

    // PageImage → MasterImage / StudentAnswerImage に分離（旧フォーマット配列をバリデーション）
    const rawPageImages = data.examData.pageImages as unknown[]
    const pageImages: V1_1_0_PageImage[] = Array.isArray(rawPageImages)
      ? rawPageImages.filter(
          (item): item is V1_1_0_PageImage =>
            typeof item === "object" &&
            item !== null &&
            "id" in item &&
            "imageType" in item
        )
      : []
    const { masterImages, studentAnswerImages, imageWarnings } =
      this.transformPageImages(pageImages)
    warnings.push(...imageWarnings)

    // QuestionScore の変換（旧フォーマット配列をバリデーション）
    const rawScores = data.scoresData.questionScores as unknown[]
    const oldScores: V1_1_0_QuestionScore[] = Array.isArray(rawScores)
      ? rawScores.filter(
          (item): item is V1_1_0_QuestionScore =>
            typeof item === "object" &&
            item !== null &&
            "id" in item &&
            "cropRegionId" in item
        )
      : []
    const { questionScores, scoreWarnings } =
      this.transformQuestionScores(oldScores)
    warnings.push(...scoreWarnings)

    // DrawingAnnotation の変換（旧フォーマット配列をバリデーション）
    const validScoreIds = new Set(
      questionScores.map((questionScore) => questionScore.id)
    )
    const rawAnnotations = data.scoresData.drawingAnnotations as unknown[]
    const oldAnnotations: V1_1_0_DrawingAnnotation[] = Array.isArray(
      rawAnnotations
    )
      ? rawAnnotations.filter(
          (item): item is V1_1_0_DrawingAnnotation =>
            typeof item === "object" &&
            item !== null &&
            "id" in item &&
            "questionScoreId" in item
        )
      : []
    const { drawingAnnotations, annotationWarnings } =
      this.transformDrawingAnnotations(oldAnnotations, validScoreIds)
    warnings.push(...annotationWarnings)

    // 警告メッセージを追加
    if (warnings.length === 0) {
      warnings.push(
        `アーカイブはv0.3.x形式(archive v${this.fromVersion})で作成されています。` +
          `PageImageはMasterImage/StudentAnswerImageに変換されました。`
      )
    }

    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
        },
        examData: {
          ...data.examData,
          // 既に分離済み（現行形式）のデータは保持する（冪等）。
          // 分離前の実アーカイブには masterImages/studentAnswerImages キー自体が無い。
          // この時点の答案・採点はまだ studentId 直結（examStudentId への
          // 付け替えは V1_20_0_to_V1_21_0 が行う）ので、最新版の型とは形が違う。
          masterImages:
            data.examData.masterImages ??
            masterImages.map((masterImage) => ({ ...masterImage })),
          studentAnswerImages:
            data.examData.studentAnswerImages ??
            (studentAnswerImages.map((studentAnswerImage) => ({
              ...studentAnswerImage,
            })) as unknown as ExamArchiveData["examData"]["studentAnswerImages"]),
        },
        scoresData: {
          questionScores: questionScores.map((questionScore) => ({
            ...questionScore,
          })) as unknown as ExamArchiveData["scoresData"]["questionScores"],
          drawingAnnotations: drawingAnnotations.map((drawingAnnotation) => ({
            ...drawingAnnotation,
            isFavorite: drawingAnnotation.isFavorite ?? false,
          })),
        },
      },
      warnings,
    }
  }

  /**
   * PageImage を MasterImage / StudentAnswerImage に分離
   */
  private transformPageImages(pageImages: V1_1_0_PageImage[]): {
    masterImages: V1_2_0_MasterImage[]
    studentAnswerImages: V1_2_0_StudentAnswerImage[]
    imageWarnings: string[]
  } {
    const masterImages: V1_2_0_MasterImage[] = []
    const studentAnswerImages: V1_2_0_StudentAnswerImage[] = []
    const imageWarnings: string[] = []
    let skippedCount = 0

    for (const pageImage of pageImages) {
      // v1.1.0 実アーカイブの参照フィールドは projectPageId（examId系リネームは v1.5.0）
      const examPageId = pageImage.examPageId ?? pageImage.projectPageId
      if (!examPageId) {
        skippedCount++
        continue
      }
      if (pageImage.imageType === "MODEL_ANSWER") {
        masterImages.push({
          id: pageImage.id,
          examPageId,
          imagePath: pageImage.imagePath,
          createdAt: pageImage.createdAt,
          updatedAt: pageImage.updatedAt,
        })
      } else if (pageImage.imageType === "STUDENT_ANSWER") {
        if (pageImage.studentId) {
          studentAnswerImages.push({
            id: pageImage.id,
            examPageId,
            studentId: pageImage.studentId,
            imagePath: pageImage.imagePath,
            createdAt: pageImage.createdAt,
            updatedAt: pageImage.updatedAt,
          })
        } else {
          // studentIdがnullの答案画像はスキップ
          skippedCount++
        }
      }
    }

    if (skippedCount > 0) {
      imageWarnings.push(
        `参照先ページまたはstudentIdが未設定の画像${skippedCount}件がスキップされました。`
      )
    }

    return { masterImages, studentAnswerImages, imageWarnings }
  }

  /**
   * QuestionScore を変換（フィールド名変更 + NULL除外）
   */
  private transformQuestionScores(questionScores: V1_1_0_QuestionScore[]): {
    questionScores: Array<{
      id: string
      cropRegionId: string
      studentId: string
      partialScore: string | null
      status: string
      userId: string
      createdAt: string
      updatedAt: string
    }>
    scoreWarnings: string[]
  } {
    const scoreWarnings: string[] = []
    let skippedCount = 0

    const transformed = questionScores
      .map((questionScore) => {
        // 旧フィールド名から新フィールド名への変換
        const userId =
          questionScore.userId || questionScore.scoredByUserId || ""
        const studentId = questionScore.studentId || ""

        if (!userId || !studentId) {
          skippedCount++
          return null
        }

        return {
          id: questionScore.id,
          cropRegionId: questionScore.cropRegionId,
          studentId,
          partialScore: questionScore.partialScore,
          status: questionScore.status,
          userId,
          createdAt: questionScore.createdAt,
          updatedAt: questionScore.updatedAt,
        }
      })
      .filter(
        (
          questionScore
        ): questionScore is {
          id: string
          cropRegionId: string
          studentId: string
          partialScore: string | null
          status: string
          userId: string
          createdAt: string
          updatedAt: string
        } => questionScore !== null
      )

    if (skippedCount > 0) {
      scoreWarnings.push(
        `userId/studentIdが未設定の採点データ${skippedCount}件がスキップされました。`
      )
    }

    return { questionScores: transformed, scoreWarnings }
  }

  /**
   * DrawingAnnotation を変換（フィールド名変更 + NULL除外）
   */
  private transformDrawingAnnotations(
    annotations: V1_1_0_DrawingAnnotation[],
    validScoreIds: Set<string>
  ): {
    drawingAnnotations: Array<{
      id: string
      questionScoreId: string
      type: string
      x: number
      y: number
      color: string
      strokeWidth: number
      width: number
      height: number
      endX: number
      endY: number
      lineStyle: string
      text: string
      fontSize: number
      textBoxWidth: number
      textBoxHeight: number
      horizontalAlign: string
      verticalAlign: string
      anchorDirection: string
      displayX: number
      displayY: number
      userId: string
      isFavorite?: boolean
      createdAt: string
      updatedAt: string
    }>
    annotationWarnings: string[]
  } {
    const annotationWarnings: string[] = []
    let skippedByUserId = 0
    let skippedByParent = 0

    const transformed = annotations
      .map((drawingAnnotation) => {
        // 親のQuestionScoreがスキップされた場合はスキップ
        if (!validScoreIds.has(drawingAnnotation.questionScoreId)) {
          skippedByParent++
          return null
        }

        // 旧フィールド名から新フィールド名への変換
        const userId =
          drawingAnnotation.userId || drawingAnnotation.createdByUserId || ""

        if (!userId) {
          skippedByUserId++
          return null
        }

        return {
          id: drawingAnnotation.id,
          questionScoreId: drawingAnnotation.questionScoreId,
          type: drawingAnnotation.type,
          x: drawingAnnotation.x,
          y: drawingAnnotation.y,
          color: drawingAnnotation.color,
          strokeWidth: drawingAnnotation.strokeWidth,
          width: drawingAnnotation.width,
          height: drawingAnnotation.height,
          endX: drawingAnnotation.endX,
          endY: drawingAnnotation.endY,
          lineStyle: drawingAnnotation.lineStyle,
          text: drawingAnnotation.text,
          fontSize: drawingAnnotation.fontSize,
          textBoxWidth: drawingAnnotation.textBoxWidth,
          textBoxHeight: drawingAnnotation.textBoxHeight,
          horizontalAlign: drawingAnnotation.horizontalAlign,
          verticalAlign: drawingAnnotation.verticalAlign,
          anchorDirection: drawingAnnotation.anchorDirection,
          displayX: drawingAnnotation.displayX,
          displayY: drawingAnnotation.displayY,
          userId,
          isFavorite: drawingAnnotation.isFavorite,
          createdAt: drawingAnnotation.createdAt,
          updatedAt: drawingAnnotation.updatedAt,
        }
      })
      .filter(
        (
          drawingAnnotation
        ): drawingAnnotation is NonNullable<typeof drawingAnnotation> =>
          drawingAnnotation !== null
      )

    if (skippedByUserId > 0) {
      annotationWarnings.push(
        `userIdが未設定のアノテーション${skippedByUserId}件がスキップされました。`
      )
    }

    if (skippedByParent > 0) {
      annotationWarnings.push(
        `親の採点データがスキップされたアノテーション${skippedByParent}件がスキップされました。`
      )
    }

    return { drawingAnnotations: transformed, annotationWarnings }
  }
}
