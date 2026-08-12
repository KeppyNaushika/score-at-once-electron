/**
 * 答案のCRUD操作
 * - アップロード、取得、削除、関連付け
 */
import type { Prisma } from "@prisma/client"
import * as fsPromises from "fs/promises"
import * as path from "path"

import { toExamStudentStatus } from "../../../../src/types/examStudentStatus.types"
import type {
  DetectedCornerMarker,
  MarkerDetectionResult,
} from "../../../../src/types/omr.types"
import {
  getAbsolutePathFromData,
  getAnswerSheetsDirectory,
  getDataDirectory,
  getRelativePathFromData,
} from "../../dataManager"
import { detectCornerMarkers } from "../../omr/cornerMarkerDetector"
import { correctImage } from "../../omr/imageCorrector"
import { recordAuditLog } from "../auditLog"
import { resolveExamScope, resolveExamScopeByPage } from "../auditScope"
import prisma from "../client"
import type { Tx } from "../transactionClient"
import { getPageScoreScope, type PageScoreScope } from "./pageScope"

/** ページごとのマスターマーカーキャッシュ */
type MasterMarkerInfo = {
  markers: DetectedCornerMarker[]
  width: number
  height: number
}

/**
 * マスター画像のマーカーを取得（ExamPage ごとに id でキャッシュ）
 */
async function getMasterMarkersForExamPage(
  examPageId: string,
  cache: Map<string, MasterMarkerInfo | null>,
  colorThreshold: number = 128
): Promise<MasterMarkerInfo | null> {
  if (cache.has(examPageId)) {
    return cache.get(examPageId) ?? null
  }

  const examPage = await prisma.examPage.findUnique({
    where: { id: examPageId },
  })

  // 模範解答画像を持たないページはマーカー補正の基準にできない。
  // ここを通すと sharp に空パス（＝データディレクトリ）を渡してしまい、
  // 例外がアップロード全体を巻き込んで1枚も保存されなくなる
  if (!examPage?.imagePath) {
    cache.set(examPageId, null)
    return null
  }

  const dataDir = getDataDirectory()
  const imagePath = path.join(dataDir, examPage.imagePath)
  const result: MarkerDetectionResult = await detectCornerMarkers(
    imagePath,
    colorThreshold
  )

  if (!result.success) {
    cache.set(examPageId, null)
    return null
  }

  const info: MasterMarkerInfo = {
    markers: result.markers,
    width: result.imageWidth,
    height: result.imageHeight,
  }
  cache.set(examPageId, info)
  return info
}

/**
 * 答案画像のアップロード
 */
export async function uploadStudentAnswers(
  examId: string,
  filesData: {
    name: string
    type: string
    buffer: ArrayBuffer
    examStudentId?: string
    examPageId: string
    overwrite?: boolean
    correctWithMarkers?: boolean
  }[]
) {
  // 配置先 ExamPage が当該試験に属することを書き込み前に検証する。
  // （id 直指定に切り替えたため、他教員のページ削除等で stale な examPageId が来ると
  //  raw な FK エラーで途中まで書き込んだ部分適用になる。ここで早期に弾く。
  //  applyStudentAnswerPlacements と同じく id 一次検証。）
  const requestedExamPageIds = [
    ...new Set(filesData.map((fileData) => fileData.examPageId)),
  ]
  const validExamPages = await prisma.examPage.findMany({
    where: { examId, id: { in: requestedExamPageIds } },
  })
  const validExamPageIds = new Set(validExamPages.map((page) => page.id))
  const staleExamPageId = requestedExamPageIds.find(
    (examPageId) => !validExamPageIds.has(examPageId)
  )
  if (staleExamPageId) {
    throw new Error(
      "配置先ページが見つかりません（他の教員がページを変更した可能性があります）。ページを再読み込みしてください。"
    )
  }

  // 受験者も当該試験のものであること。ページと受験者は別々の FK なので、
  // 片方だけ検証しても「試験Aのページに試験Bの受験者の答案」が書けてしまう。
  const requestedExamStudentIds = [
    ...new Set(
      filesData
        .map((fileData) => fileData.examStudentId)
        .filter((examStudentId): examStudentId is string => !!examStudentId)
    ),
  ]
  if (requestedExamStudentIds.length > 0) {
    const validExamStudents = await prisma.examStudent.findMany({
      where: { examId, id: { in: requestedExamStudentIds } },
    })
    if (validExamStudents.length !== requestedExamStudentIds.length) {
      throw new Error(
        "配置先の受験者が見つかりません（他の教員が受験生徒を変更した可能性があります）。再読み込みしてください。"
      )
    }
  }

  const examDir = getAnswerSheetsDirectory(examId)

  // 試験ディレクトリを作成
  await fsPromises.mkdir(examDir, { recursive: true })

  const uploadedSheets: Array<{
    id: string
    imagePath: string
    isOverwrite: boolean
    correctionStatus: "corrected" | "skipped" | "not_requested"
    correctionError?: string
  }> = []

  // 補正用のマスターマーカーキャッシュ（examPageId→マーカー情報）
  const masterMarkerCache = new Map<string, MasterMarkerInfo | null>()

  // ================================================================
  // Phase 1: 画像補正を並列実行（CPU集中処理）
  // ================================================================
  // マスターマーカーキャッシュの初期化（全 ExamPage 分を事前取得）
  const examPageIds = [
    ...new Set(filesData.map((fileData) => fileData.examPageId)),
  ]
  await Promise.all(
    examPageIds.map((examPageId) =>
      getMasterMarkersForExamPage(examPageId, masterMarkerCache)
    )
  )

  // 各ファイルの補正を並列実行
  const correctedFiles = await Promise.all(
    filesData.map(async (fileData) => {
      let buffer = Buffer.from(fileData.buffer)
      let correctionStatus: "corrected" | "skipped" | "not_requested" =
        "not_requested"
      let correctionError: string | undefined

      if (fileData.correctWithMarkers) {
        const masterInfo = masterMarkerCache.get(fileData.examPageId)

        if (masterInfo) {
          const result = await correctImage(
            buffer,
            masterInfo.markers,
            masterInfo.width,
            masterInfo.height
          )

          if (result.success && result.correctedBuffer) {
            buffer = Buffer.from(result.correctedBuffer)
            correctionStatus = "corrected"
          } else {
            correctionStatus = "skipped"
            correctionError = result.error
            console.warn(`画像補正スキップ (${fileData.name}): ${result.error}`)
          }
        } else {
          correctionStatus = "skipped"
          correctionError = "マスター画像のマーカーが検出できませんでした"
        }
      }

      return { fileData, buffer, correctionStatus, correctionError }
    })
  )

  // ================================================================
  // Phase 2: DB書き込み + ファイル保存（順次実行、SQLite制約）
  // ================================================================
  for (const {
    fileData,
    buffer,
    correctionStatus,
    correctionError,
  } of correctedFiles) {
    if (!fileData.examStudentId) {
      throw new Error(`ExamStudent ID is required for file: ${fileData.name}`)
    }

    // 配置先 ExamPage は id 直指定（列＝ExamPage 実体から供給される）。
    // pageNumber からの find/create はしない（id 一次同定）。
    const existingRecord = await prisma.studentAnswerImage.findFirst({
      where: {
        examPageId: fileData.examPageId,
        examStudentId: fileData.examStudentId,
      },
    })

    const timestamp = Date.now()
    const sanitizedName = fileData.name.replace(/[^a-zA-Z0-9\-_.]/g, "_")
    const fileName = `${timestamp}_${sanitizedName}`
    const filePath = path.join(examDir, fileName)
    const relativePath = getRelativePathFromData(filePath)

    if (existingRecord) {
      if (fileData.overwrite) {
        await fsPromises.writeFile(filePath, buffer)

        try {
          const oldFilePath = getAbsolutePathFromData(existingRecord.imagePath)
          await fsPromises.unlink(oldFilePath)
        } catch {
          // ファイルが存在しない場合は無視
        }

        const answerSheet = await prisma.studentAnswerImage.update({
          where: { id: existingRecord.id },
          data: { imagePath: relativePath },
        })

        uploadedSheets.push({
          ...answerSheet,
          isOverwrite: true,
          correctionStatus,
          correctionError,
        })
      } else {
        uploadedSheets.push({
          ...existingRecord,
          isOverwrite: false,
          correctionStatus: "not_requested",
        })
      }
    } else {
      await fsPromises.writeFile(filePath, buffer)

      const answerSheet = await prisma.studentAnswerImage.create({
        data: {
          examPageId: fileData.examPageId,
          examStudentId: fileData.examStudentId,
          imagePath: relativePath,
        },
      })

      uploadedSheets.push({
        ...answerSheet,
        isOverwrite: false,
        correctionStatus,
        correctionError,
      })
    }
  }

  if (uploadedSheets.length > 0) {
    const scope = await resolveExamScope(examId)
    await recordAuditLog({
      action: "exam.answer.upload",
      entityType: "StudentAnswerImage",
      entityId: examId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: `生徒答案を${uploadedSheets.length}件アップロードしました`,
      extra: { count: uploadedSheets.length },
    })
  }

  return uploadedSheets
}

/**
 * 試験の答案一覧を取得
 * Prismaの型をそのまま返す（StudentAnswerImageWithExamStudents互換）
 */
export async function getStudentAnswersByExamId(examId: string) {
  const studentAnswerImages = await prisma.studentAnswerImage.findMany({
    where: {
      examPage: {
        examId: examId,
      },
    },
    include: {
      examStudent: { include: { student: true } },
      examPage: true,
    },
    orderBy: [
      { examStudentId: "asc" },
      { examPage: { pageNumber: "asc" } },
      { id: "asc" },
    ],
  })

  // 重複除去フォールバック（@@unique制約適用前のデータ対策）
  const seen = new Map<string, (typeof studentAnswerImages)[0]>()
  for (const studentAnswerImage of studentAnswerImages) {
    const key = `${studentAnswerImage.examStudentId}-${studentAnswerImage.examPageId}`
    const existing = seen.get(key)
    if (!existing || studentAnswerImage.updatedAt > existing.updatedAt) {
      seen.set(key, studentAnswerImage)
    }
  }
  const deduplicated = Array.from(seen.values())

  return deduplicated
}

/**
 * 06 生徒答案ページ専用の複合データセット（Exam 根の 1 include）。
 *
 * 行＝examStudents（ExamStudent 実体）／列＝examPages（ExamPage 実体）／
 * セル＝examPages[].studentAnswerImages（実体）という entity-first の供給。
 * Prisma の include が作るグラフをそのまま返し、renderer は射影せず保持する
 * （pageNumber・氏名は表示時にエンティティから導出する）。
 * 05/07/08 が共有する getStudentsForExam / getStudentAnswersByExamId は変更しない。
 */
export async function getStudentAnswersDataset(examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      examStudents: {
        orderBy: [
          { customOrder: "asc" },
          { student: { studentNumber: "asc" } },
        ],
        include: {
          student: {
            include: {
              memberships: { include: { classroom: true } },
            },
          },
        },
      },
      examPages: {
        // id をタイブレークに入れて並びを決定的にする。
        //
        // pageNumber は表示上の序数であって一意ではない。sync 構成では各端末が
        // 自分のローカル DB へ書き、NAS への反映は行レベルマージ（LWW）なので、
        // 2台が同時にページを追加すると同じ番号の行が別 id で並ぶ。これは
        // `@@unique([examId, pageNumber])` では防げない（各端末では制約が満たされ、
        // 衝突はマージ時に現れる。id 以外の unique は同期違反）。
        //
        // 同定は全経路で id なので重複自体は害にならないが、06 の自動配置だけは
        // この配列の**順序**でファイルを割り当てる（useTableDataGeneration.ts）。
        // 同値の順序が保証されないと、同じ操作でも答案の配置先が変わってしまう。
        orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
        include: {
          studentAnswerImages: {
            include: { examStudent: { include: { student: true } } },
          },
        },
      },
    },
  })

  if (!exam) {
    throw new Error("試験が見つかりません")
  }

  // 重複除去フォールバック（@@unique 適用前データ・NAS sync 由来の重複対策）。
  // getStudentAnswersByExamId と同じ (examStudentId, examPageId) 単位で updatedAt 最新のみ残す。
  // 05/07/08（getStudentAnswersByExamId 経由）と 06 で表示が食い違わないようにする。
  const examPages = exam.examPages.map((examPage) => {
    const latestByExamStudentId = new Map<
      string,
      (typeof examPage.studentAnswerImages)[number]
    >()
    for (const answerImage of examPage.studentAnswerImages) {
      const existing = latestByExamStudentId.get(answerImage.examStudentId)
      if (!existing || answerImage.updatedAt > existing.updatedAt) {
        latestByExamStudentId.set(answerImage.examStudentId, answerImage)
      }
    }
    return {
      ...examPage,
      studentAnswerImages: Array.from(latestByExamStudentId.values()),
    }
  })

  return {
    // 受験状態は SQLite に enum が無いので DB 上 String。境界で union へ倒す
    examStudents: exam.examStudents.map((examStudent) => ({
      ...examStudent,
      status: toExamStudentStatus(examStudent.status),
    })),
    examPages,
  }
}

/**
 * 答案の削除
 */
/** 答案1枚に紐づく「実際に採点された」データの件数（削除確認モーダルの表示用） */
export interface StudentAnswerScoreSummary {
  /**
   * 採点済みの設問数。協調採点では1設問に教員ごとの QuestionScore 行が並ぶため、
   * 行数ではなく CropRegion 数で数える（行数だと教員数だけ水増しされる）。
   */
  scoredQuestionCount: number
  /** 確定済みスコア（ScoreDecision）の件数 */
  scoreDecisionCount: number
  /** 答案上の書き込み（DrawingAnnotation）の件数 */
  drawingAnnotationCount: number
  /** 採点済みの複合回答数 */
  scoredCompoundAnswerCount: number
  /** 上記のいずれかが1件以上あるか */
  hasScoreData: boolean
}

/**
 * 「実際に採点された」QuestionScore の条件。
 *
 * `scoringInitializer` が全マスに status="unscored" の行を先行作成するため、行の有無を
 * そのまま「採点済み」と扱うと常に true になる。判定と削除で定義がずれないよう定数にする
 * （削除側は unscored の初期化行も含めて全て消す＝この条件は使わない）。
 */
const SCORED_QUESTION_SCORE_FILTER = {
  OR: [{ status: { not: "unscored" } }, { partialScore: { not: null } }],
} satisfies Prisma.QuestionScoreWhereInput

/** 「実際に採点された」CompoundAnswerScore の条件（部分点のみ入力済みの状態も拾う） */
const SCORED_COMPOUND_ANSWER_SCORE_FILTER = {
  OR: [
    { status: { not: "unscored" } },
    { partialScore: { not: null } },
    { recognizedAnswer: { not: null } },
  ],
} satisfies Prisma.CompoundAnswerScoreWhereInput

/** 答案1枚（ページ scope × 生徒）の採点実績を数える */
async function countStudentAnswerScoreData(
  client: typeof prisma | Tx,
  scope: PageScoreScope,
  examStudentId: string
): Promise<StudentAnswerScoreSummary> {
  const { cropRegionIds, compoundAnswerIds } = scope

  const [
    scoredQuestionRegions,
    scoreDecisionCount,
    drawingAnnotationCount,
    scoredCompoundAnswerCount,
  ] = await Promise.all([
    cropRegionIds.length === 0
      ? []
      : client.questionScore.findMany({
          where: {
            examStudentId,
            cropRegionId: { in: cropRegionIds },
            ...SCORED_QUESTION_SCORE_FILTER,
          },
          distinct: ["cropRegionId"],
        }),
    cropRegionIds.length === 0
      ? 0
      : client.scoreDecision.count({
          where: { examStudentId, cropRegionId: { in: cropRegionIds } },
        }),
    cropRegionIds.length === 0
      ? 0
      : client.drawingAnnotation.count({
          where: {
            questionScore: {
              examStudentId,
              cropRegionId: { in: cropRegionIds },
            },
          },
        }),
    compoundAnswerIds.length === 0
      ? 0
      : client.compoundAnswerScore.count({
          where: {
            examStudentId,
            compoundAnswerId: { in: compoundAnswerIds },
            ...SCORED_COMPOUND_ANSWER_SCORE_FILTER,
          },
        }),
  ])

  const scoredQuestionCount = scoredQuestionRegions.length

  return {
    scoredQuestionCount,
    scoreDecisionCount,
    drawingAnnotationCount,
    scoredCompoundAnswerCount,
    hasScoreData:
      scoredQuestionCount > 0 ||
      scoreDecisionCount > 0 ||
      drawingAnnotationCount > 0 ||
      scoredCompoundAnswerCount > 0,
  }
}

/**
 * 答案1枚に紐づく採点データの件数を取得する（削除確認モーダルの事前照会）。
 */
export async function getStudentAnswerScoreSummary(answerSheetId: string) {
  const answerSheet = await prisma.studentAnswerImage.findUnique({
    where: { id: answerSheetId },
  })

  if (!answerSheet) {
    throw new Error("答案が見つかりません")
  }

  const scope = await getPageScoreScope(prisma, answerSheet.examPageId)
  const summary = await countStudentAnswerScoreData(
    prisma,
    scope,
    answerSheet.examStudentId
  )

  return summary
}

/**
 * 答案画像を採点データごと削除する。
 *
 * `StudentAnswerImage` には採点系の子リレーションが無く cascade は走らないため、
 * ページ scoped で QuestionScore / ScoreDecision / CompoundAnswerScore を明示削除する
 * （placementApply の discard と同じ手順。DrawingAnnotation は tombstone 記録後、
 * 親 QuestionScore の cascade で消える）。
 *
 * DB をトランザクションで確定させてからファイルを消す。逆順だと DB 失敗時に画像だけが
 * 失われて復旧できない（孤立ファイルが残る方が害が小さい）。
 */
export async function deleteStudentAnswer(answerSheetId: string) {
  const answerSheet = await prisma.studentAnswerImage.findUnique({
    where: { id: answerSheetId },
  })

  if (!answerSheet) {
    throw new Error("答案が見つかりません")
  }

  const { summary, removedRows } = await prisma.$transaction(
    async (tx) => {
      const scope = await getPageScoreScope(tx, answerSheet.examPageId)
      const { examStudentId } = answerSheet
      const { cropRegionIds, compoundAnswerIds } = scope

      // 削除前に「利用者から見た採点実績」を数えておく（モーダルの表示と同じ定義）。
      // 削除自体は unscored の初期化行も含めて全て消すので、行数とは一致しない。
      const scoreSummary = await countStudentAnswerScoreData(
        tx,
        scope,
        examStudentId
      )

      let questionScoreRows = 0
      let drawingAnnotationRows = 0
      let scoreDecisionRows = 0
      let compoundAnswerScoreRows = 0

      if (cropRegionIds.length > 0) {
        // QuestionScore を削除（子の DrawingAnnotation は cascade で道連れ）
        const questionScores = await tx.questionScore.findMany({
          where: { examStudentId, cropRegionId: { in: cropRegionIds } },
        })
        const questionScoreIds = questionScores.map(
          (questionScore) => questionScore.id
        )

        if (questionScoreIds.length > 0) {
          drawingAnnotationRows = await tx.drawingAnnotation.count({
            where: { questionScoreId: { in: questionScoreIds } },
          })
          const removed = await tx.questionScore.deleteMany({
            where: { id: { in: questionScoreIds } },
          })
          questionScoreRows = removed.count
        }

        const removedDecisions = await tx.scoreDecision.deleteMany({
          where: { examStudentId, cropRegionId: { in: cropRegionIds } },
        })
        scoreDecisionRows = removedDecisions.count
      }

      if (compoundAnswerIds.length > 0) {
        const removedCompound = await tx.compoundAnswerScore.deleteMany({
          where: {
            examStudentId,
            compoundAnswerId: { in: compoundAnswerIds },
          },
        })
        compoundAnswerScoreRows = removedCompound.count
      }

      await tx.studentAnswerImage.delete({ where: { id: answerSheetId } })

      return {
        summary: scoreSummary,
        removedRows: {
          questionScoreRows,
          scoreDecisionRows,
          drawingAnnotationRows,
          compoundAnswerScoreRows,
        },
      }
    },
    // 採点済み答案では削除対象の行数が多く、既定の 5s を超えうる
    // （超えると P2028 で削除ごとロールバックする）。
    { timeout: 30000 }
  )

  // ファイル削除は DB コミット後。失敗しても孤立ファイルが残るだけなので警告に留める
  // （パス解決の失敗も含めて握る。ここで例外を投げると削除済みの DB と矛盾する）。
  try {
    await fsPromises.unlink(getAbsolutePathFromData(answerSheet.imagePath))
  } catch (fileError) {
    console.warn("Failed to delete file:", fileError)
  }

  const auditScope = await resolveExamScopeByPage(answerSheet.examPageId)
  await recordAuditLog({
    action: "exam.answer.delete",
    entityType: "StudentAnswerImage",
    entityId: answerSheetId,
    scopeId: auditScope.scopeId,
    scopeLabel: auditScope.scopeLabel,
    // 監査ログには実際に消えた行数を残す（未採点の初期化行を含むデータの記録）
    summary: `答案画像を削除（QuestionScore ${removedRows.questionScoreRows} 行 / ScoreDecision ${removedRows.scoreDecisionRows} 行 / DrawingAnnotation ${removedRows.drawingAnnotationRows} 行 / CompoundAnswerScore ${removedRows.compoundAnswerScoreRows} 行を同時削除）`,
  })

  return { deletedSummary: summary }
}
