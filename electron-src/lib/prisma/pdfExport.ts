import { resolveExamPaperSize } from "@/lib/shared/examPaperSize"
import type { ScoringMethod } from "@/types/rubric.types"

import type { DrawingAnnotation } from "../../../src/types/drawingAnnotation.types"
import { getAbsolutePathFromSharedFiles } from "../dataManager"
import { PathOutsideRootError } from "../pathContainment"
import { pathExists } from "../pathExists"
import { resolveEffectiveScores } from "../shared/calculations/scoreResolution"
import { getCropRegionsByExamId } from "./cropRegion"
import { getExamById } from "./exam"
import { getStudentsForExam } from "./examStudent"
import {
  buildScoredRegions,
  buildScoringData,
  buildSubtotalData,
  buildTotalScoreData,
  calculateTotalScore,
  collectAnnotations,
  readImageAsDataUrl,
} from "./pdfExportPageData"
import { getQuestionScoresForExam } from "./questionScore"
import { getScoreDecisionsForExam } from "./scoreDecision"
import { getStudentAnswersByExamId } from "./studentAnswer/crud"

// ============================================================
// Canvas描画エンジン用API
// ============================================================

/**
 * PDF出力に必要なデータを取得する型定義。renderer の描画エンジンはこの型から
 * 入力型を導出する（`pdfCanvasRenderer/types.ts`）ので、形の SSOT はここ1箇所。
 *
 * 採点マークは**実体をそのまま載せる**。以前は 17 列を選んで載せ替えていたため、
 * renderer 側で組み立て直したうえで union 列を `as` で戻し、落ちた列
 * （textBoxWidth / horizontalAlign / createdAt 等）を `0` や `new Date()` で
 * 埋めていた。実体を渡せば載せ替えも `as` も要らない。
 *
 * 設問領域・小計・合計は描画に要る列だけの形を保つ（規約の read-out 側の carve-out。
 * 実体をそのまま載せると questionScores まで IPC を越えることになる）。
 */
export interface PdfExportPageData {
  examStudentId: string
  studentName: string
  pageNumber: number
  imagePath: string
  imageUrl: string // file:// URL形式
  // 用紙サイズ（mm→px変換基準。個別表示と一致させるため ExamPage.pageSize を反映）
  pageSize: string
  scoringData: Array<{
    status: string
    partialScore: number | null
    /**
     * 類型評価で付けた類型。設問の方式と合う評価済み（類型評価の設問の evaluated）で、類型が
     * 残っているときだけ値がある。答案には採点マークの代わりに記号（label）を、点数として
     * 類型の点数（score）を印刷する（docs/vlm-grading-design.md §4-8-5）
     */
    scaleLevel: { label: string; score: number } | null
    cropRegion: {
      id: string
      x: number
      y: number
      width: number
      height: number
      label: string
      maxScore: number | null
      pageNumber: number
      /** 採点方式。方式と合わない採点（§4-8-8）は点数を印刷しない */
      scoringMethod: ScoringMethod
    }
  }>
  // 小計点データ
  subtotalData: Array<{
    regionId: string
    label: string
    score: number | null
    x: number
    y: number
    width: number
    height: number
    pageNumber: number
  }>
  // 合計点領域データ
  totalScoreData: Array<{
    regionId: string
    score: number | null
    maxScore: number
    x: number
    y: number
    width: number
    height: number
    pageNumber: number
  }>
  // 合計点データ（後方互換性のため維持）
  totalScore: number | null
  totalMaxScore: number | null
  annotations: DrawingAnnotation[]
}

interface PdfExportData {
  examName: string
  pages: PdfExportPageData[]
}

/**
 * 答案画像の DB 上の相対パスを絶対パスにする。データフォルダの外を指すなら null
 * （警告を出してそのページを飛ばす。読めない画像を飛ばす `readImageAsDataUrl` と同じ扱いで、
 * 1件の壊れたパスで出力全体を止めない）。それ以外の例外は投げ直す
 */
function resolveAnswerImagePath(relativeImagePath: string): string | null {
  try {
    return getAbsolutePathFromSharedFiles(relativeImagePath)
  } catch (resolveError) {
    if (resolveError instanceof PathOutsideRootError) {
      console.warn(
        `データフォルダの外を指す答案画像を飛ばします: ${relativeImagePath}`,
        resolveError
      )
      return null
    }
    throw resolveError
  }
}

/**
 * PDF出力に必要なデータを取得
 * レンダラー側でCanvas描画を行うためのデータを提供
 */
export async function getPdfExportData(options: {
  examId: string
  selectedExamStudentIds: string[]
}): Promise<PdfExportData> {
  const { examId, selectedExamStudentIds } = options

  // 試験情報を取得
  const exam = await getExamById(examId)
  if (!exam) {
    throw new Error("試験が見つかりません")
  }

  // 用紙サイズ。個別表示（ScoringMainView）と同じ関数で決めて、
  // フォント・線幅の mm→px 変換基準を一致させる
  const pageSize = resolveExamPaperSize(exam.examPages)

  // 採点領域を取得
  const cropRegions = await getCropRegionsByExamId(examId)

  // 採点スコアと確定を取得し、受験者×設問ごとに有効スコア1件へ解決
  const scoresResult = await getQuestionScoresForExam(examId)
  const decisionsResult = await getScoreDecisionsForExam(examId)
  const { resolved: allScores } = resolveEffectiveScores(
    scoresResult,
    decisionsResult,
    cropRegions
  )

  // 受験者を取得（ExamStudent 実体のまま保持する）
  const allExamStudents = await getStudentsForExam(examId)

  // 答案画像を取得
  // include が作ったグラフ（examStudent{student} / examPage 同梱）をそのまま持つ。
  // pageNumber・氏名は出力データを組み立てる時点でエンティティから導出する。
  const studentAnswers = await getStudentAnswersByExamId(examId)

  // 選択された受験者のみフィルタリング
  const selectedExamStudents = allExamStudents.filter((examStudent) =>
    selectedExamStudentIds.includes(examStudent.id)
  )

  const pages: PdfExportPageData[] = []

  for (const examStudent of selectedExamStudents) {
    const { student } = examStudent
    // この受験者の答案画像を取得
    const studentAnswerList = studentAnswers.filter(
      (studentAnswer) => studentAnswer.examStudentId === examStudent.id
    )

    if (studentAnswerList.length === 0) continue

    for (const studentAnswer of studentAnswerList) {
      const imagePath = resolveAnswerImagePath(studentAnswer.imagePath)
      if (imagePath === null || !(await pathExists(imagePath))) continue

      // このページの採点領域を取得。ページの同定は examPageId で行う
      // （pageNumber は序数。端末をまたいで独立に同じ値が振られるので、値が一致しても
      //  同じページとは限らず、unique にもできない＝ key にならない）
      const pageRegions = cropRegions.filter(
        (cropRegion) => cropRegion.examPageId === studentAnswer.examPageId
      )

      const scoredRegions = buildScoredRegions(
        pageRegions,
        allScores,
        examStudent.id
      )
      const scoringData = buildScoringData(scoredRegions)
      const annotations = await collectAnnotations(scoredRegions)

      const imageUrl = await readImageAsDataUrl(imagePath)
      if (imageUrl === null) continue // この画像をスキップ

      const subtotalData = await buildSubtotalData({
        examId,
        examStudentId: examStudent.id,
        pageRegions,
        allScores,
        cropRegions,
      })

      const { totalScore, totalMaxScore } = calculateTotalScore(
        cropRegions,
        allScores,
        examStudent.id
      )
      const totalScoreData = buildTotalScoreData(
        pageRegions,
        totalScore,
        totalMaxScore
      )

      pages.push({
        examStudentId: examStudent.id,
        studentName: `${student.lastName} ${student.firstName}`,
        pageNumber: studentAnswer.examPage.pageNumber,
        imagePath,
        imageUrl,
        pageSize,
        scoringData,
        subtotalData,
        totalScoreData,
        totalScore,
        totalMaxScore,
        annotations,
      })
    }
  }

  // ページを受験者順（customOrder順）・ページ番号順でソート
  // selectedExamStudents は getStudentsForExam が customOrder 順で返すため、
  // その順序を受験者の並び順として使う（選択操作の順序には依存させない）
  const orderedExamStudentIds = selectedExamStudents.map(
    (examStudent) => examStudent.id
  )
  pages.sort((pageA, pageB) => {
    const studentCompare =
      orderedExamStudentIds.indexOf(pageA.examStudentId) -
      orderedExamStudentIds.indexOf(pageB.examStudentId)
    if (studentCompare !== 0) return studentCompare
    return pageA.pageNumber - pageB.pageNumber
  })

  return { examName: exam.examName, pages }
}
