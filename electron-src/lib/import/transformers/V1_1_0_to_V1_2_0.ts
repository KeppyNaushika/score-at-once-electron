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
 * @see docs/schema-history/README.md
 */

import type {
  ArchiveData,
  ArchiveVersion,
  TransformResult,
  VersionTransformer,
} from "./types"

/**
 * v1.1.0 の PageImage 形式
 */
interface V1_1_0_PageImage {
  id: string
  projectPageId: string
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
  projectPageId: string
  imagePath: string
  createdAt: string
  updatedAt: string
}

/**
 * v1.2.0 の StudentAnswerImage 形式
 */
interface V1_2_0_StudentAnswerImage {
  id: string
  projectPageId: string
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
  createdAt: string
  updatedAt: string
}

/**
 * v1.1.0 → v1.2.0 変換器
 */
export class V1_1_0_to_V1_2_0_Transformer implements VersionTransformer {
  readonly fromVersion: ArchiveVersion = "1.1.0"
  readonly toVersion: ArchiveVersion = "1.2.0"

  transform(data: ArchiveData): TransformResult {
    const warnings: string[] = []

    // PageImage → MasterImage / StudentAnswerImage に分離
    const { masterImages, studentAnswerImages, imageWarnings } =
      this.transformPageImages(
        data.projectData.pageImages as unknown as V1_1_0_PageImage[]
      )
    warnings.push(...imageWarnings)

    // QuestionScore の変換（フィールド名変更 + NULL除外）
    const { questionScores, scoreWarnings } = this.transformQuestionScores(
      data.scoresData.questionScores as unknown as V1_1_0_QuestionScore[]
    )
    warnings.push(...scoreWarnings)

    // DrawingAnnotation の変換（フィールド名変更 + NULL除外）
    // 注意: 親のQuestionScoreがスキップされた場合、その子もスキップする必要がある
    const validScoreIds = new Set(questionScores.map((qs) => qs.id))
    const { drawingAnnotations, annotationWarnings } =
      this.transformDrawingAnnotations(
        data.scoresData
          .drawingAnnotations as unknown as V1_1_0_DrawingAnnotation[],
        validScoreIds
      )
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
        projectData: {
          ...data.projectData,
          // pageImagesは後方互換性のため維持（空にはしない）
          masterImages: masterImages as unknown as NonNullable<
            typeof data.projectData.masterImages
          >,
          studentAnswerImages: studentAnswerImages as unknown as NonNullable<
            typeof data.projectData.studentAnswerImages
          >,
        },
        scoresData: {
          questionScores:
            questionScores as unknown as typeof data.scoresData.questionScores,
          drawingAnnotations:
            drawingAnnotations as unknown as typeof data.scoresData.drawingAnnotations,
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

    for (const img of pageImages) {
      if (img.imageType === "MODEL_ANSWER") {
        masterImages.push({
          id: img.id,
          projectPageId: img.projectPageId,
          imagePath: img.imagePath,
          createdAt: img.createdAt,
          updatedAt: img.updatedAt,
        })
      } else if (img.imageType === "STUDENT_ANSWER") {
        if (img.studentId) {
          studentAnswerImages.push({
            id: img.id,
            projectPageId: img.projectPageId,
            studentId: img.studentId,
            imagePath: img.imagePath,
            createdAt: img.createdAt,
            updatedAt: img.updatedAt,
          })
        } else {
          // studentIdがnullの答案画像はスキップ
          skippedCount++
        }
      }
    }

    if (skippedCount > 0) {
      imageWarnings.push(
        `studentIdが未設定の答案画像${skippedCount}件がスキップされました。`
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
      .map((qs) => {
        // 旧フィールド名から新フィールド名への変換
        const userId = qs.userId || qs.scoredByUserId || ""
        const studentId = qs.studentId || ""

        if (!userId || !studentId) {
          skippedCount++
          return null
        }

        return {
          id: qs.id,
          cropRegionId: qs.cropRegionId,
          studentId,
          partialScore: qs.partialScore,
          status: qs.status,
          userId,
          createdAt: qs.createdAt,
          updatedAt: qs.updatedAt,
        }
      })
      .filter(
        (
          qs
        ): qs is {
          id: string
          cropRegionId: string
          studentId: string
          partialScore: string | null
          status: string
          userId: string
          createdAt: string
          updatedAt: string
        } => qs !== null
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
      createdAt: string
      updatedAt: string
    }>
    annotationWarnings: string[]
  } {
    const annotationWarnings: string[] = []
    let skippedByUserId = 0
    let skippedByParent = 0

    const transformed = annotations
      .map((da) => {
        // 親のQuestionScoreがスキップされた場合はスキップ
        if (!validScoreIds.has(da.questionScoreId)) {
          skippedByParent++
          return null
        }

        // 旧フィールド名から新フィールド名への変換
        const userId = da.userId || da.createdByUserId || ""

        if (!userId) {
          skippedByUserId++
          return null
        }

        return {
          id: da.id,
          questionScoreId: da.questionScoreId,
          type: da.type,
          x: da.x,
          y: da.y,
          color: da.color,
          strokeWidth: da.strokeWidth,
          width: da.width,
          height: da.height,
          endX: da.endX,
          endY: da.endY,
          lineStyle: da.lineStyle,
          text: da.text,
          fontSize: da.fontSize,
          textBoxWidth: da.textBoxWidth,
          textBoxHeight: da.textBoxHeight,
          horizontalAlign: da.horizontalAlign,
          verticalAlign: da.verticalAlign,
          anchorDirection: da.anchorDirection,
          displayX: da.displayX,
          displayY: da.displayY,
          userId,
          createdAt: da.createdAt,
          updatedAt: da.updatedAt,
        }
      })
      .filter((da): da is NonNullable<typeof da> => da !== null)

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
