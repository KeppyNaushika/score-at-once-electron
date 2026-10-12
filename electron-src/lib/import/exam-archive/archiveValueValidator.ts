/**
 * 旧 .score（試験アーカイブ、読み込みだけの凍結した形式）の値のうち、データフォルダの中の
 * 場所を決めるもの（試験の id と画像のパス）を、取り込む前に確かめる
 *
 * 取り込みは試験の id をアーカイブのまま使い（`importExamCore.ts`）、画像のパスは
 * アーカイブの値から組み直す（模範解答はファイル名だけ、答案は answer-sheets/ より下）。
 * 組み直しに使う部分の切り出しはここの関数に集め、確かめるものと書くものを一致させる。
 * 形の規則は統合アーカイブ（`unified-archive/archiveValueGuards.ts`）と同じものを使う。
 */

import type { ArchiveExamData } from "../../../../src/types/examArchive.types"
import { isSafePathSegment } from "../../pathContainment"
import {
  isSafeExamImageFileName,
  isSafeImageDirectoryName,
} from "../unified-archive/archiveValueGuards"

/** 答案画像の置き場のディレクトリ名 */
const ANSWER_SHEETS_DIRECTORY_NAME = "answer-sheets"

/** パスの区切り（`/` と `\`）で分けた区切りの並び */
const segmentsOf = (filePath: string): string[] => filePath.split(/[\\/]/)

/** パスの最後の区切り（模範解答の画像はファイル名だけを使う） */
export function lastPathSegmentOf(filePath: string): string {
  return segmentsOf(filePath).at(-1) ?? ""
}

/**
 * 答案画像のパスの、answer-sheets/ より下の部分（`/` 区切り）。answer-sheets を含まない
 * パスは null
 */
export function answerSheetRelativePathOf(filePath: string): string | null {
  const segments = segmentsOf(filePath)
  const directoryIndex = segments.lastIndexOf(ANSWER_SHEETS_DIRECTORY_NAME)
  if (directoryIndex < 0) return null
  return segments.slice(directoryIndex + 1).join("/")
}

/** 答案画像の answer-sheets/ より下の部分が、受け付ける形か */
const isAcceptableAnswerSheetPath = (filePath: string): boolean => {
  const relativePath = answerSheetRelativePathOf(filePath)
  if (relativePath === null) return false
  const segments = relativePath.split("/")
  const fileName = segments.at(-1) ?? ""
  return (
    segments.slice(0, -1).every(isSafeImageDirectoryName) &&
    isSafeExamImageFileName(fileName)
  )
}

/** 試験アーカイブのうち、場所を決める値を持つ部分 */
interface ExamArchiveLocationValues {
  readonly exam: Pick<ArchiveExamData["exam"], "id">
  readonly examPages: readonly Pick<
    ArchiveExamData["examPages"][number],
    "imagePath"
  >[]
  readonly pageImages: readonly Pick<
    ArchiveExamData["pageImages"][number],
    "imagePath" | "imageType"
  >[]
  readonly studentAnswerImages?: readonly Pick<
    NonNullable<ArchiveExamData["studentAnswerImages"]>[number],
    "imagePath"
  >[]
}

/**
 * 試験アーカイブ（変換チェーンを通した最新形式）の試験の id と画像のパスを確かめ、
 * 外れたものを人に見せる文で返す（外れが無ければ空）。値そのものは載せない
 */
export function describeUnsafeExamArchiveValues(
  examData: ExamArchiveLocationValues
): string[] {
  const problems: string[] = []
  if (!isSafePathSegment(examData.exam.id)) {
    problems.push("試験の id として扱えない値があります")
  }

  const unsafeMasterImageCount = examData.examPages.filter(
    (examPage) =>
      examPage.imagePath !== null &&
      examPage.imagePath !== "" &&
      !isSafeExamImageFileName(lastPathSegmentOf(examPage.imagePath))
  ).length
  if (unsafeMasterImageCount > 0) {
    problems.push(
      `模範解答の画像の場所として扱えない値が ${unsafeMasterImageCount}件あります`
    )
  }

  const answerImagePaths = [
    ...(examData.studentAnswerImages ?? []).map(
      (studentAnswerImage) => studentAnswerImage.imagePath
    ),
    // v1.1.0 以前の答案（取り込みが studentAnswerImages の無いときに使う）
    ...examData.pageImages
      .filter((pageImage) => pageImage.imageType === "STUDENT_ANSWER")
      .map((pageImage) => pageImage.imagePath),
  ]
  const unsafeAnswerImageCount = answerImagePaths.filter(
    (imagePath) => !isAcceptableAnswerSheetPath(imagePath)
  ).length
  if (unsafeAnswerImageCount > 0) {
    problems.push(
      `答案の画像の場所として扱えない値が ${unsafeAnswerImageCount}件あります`
    )
  }
  return problems
}
