/**
 * テスト用アーカイブヘルパー
 *
 * Electron非依存で試験アーカイブ（.score）の ZIP を手組みする
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as path from "path"

import type {
  ArchiveClassesData,
  ArchiveDataCounts,
  ArchiveExamData,
  ArchiveManifest,
  ArchiveScoresData,
  ArchiveStudentsData,
  ArchiveSubtotalsData,
  ArchiveTagsData,
  ArchiveUsersData,
} from "../../src/types/examArchive.types"
import { EXAM_CURRENT_VERSION } from "../../src/types/examArchive.types"

/**
 * テスト用アーカイブに書く中身（manifest 以外の各 JSON と件数）。
 *
 * 試験アーカイブ（.score）の現行の形。書き出しは消えたので、旧形式の取り込みを
 * 手組みのアーカイブで確かめるテストだけが使う。
 */
interface TestArchiveContents {
  examData: ArchiveExamData
  studentsData: ArchiveStudentsData
  classesData: ArchiveClassesData
  usersData: ArchiveUsersData
  subtotalsData: ArchiveSubtotalsData
  scoresData: ArchiveScoresData
  tagsData: ArchiveTagsData
  counts: ArchiveDataCounts
}

/**
 * テスト用アーカイブを作成
 */
export function createTestArchive(
  archiveContents: TestArchiveContents,
  outputPath: string,
  examId: string,
  examName: string,
  options: {
    version?: string
    masterImageFiles?: Array<{ archivePath: string; content: Buffer }>
    answerSheetFiles?: Array<{ archivePath: string; content: Buffer }>
  } = {}
): void {
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const zip = new AdmZip()

  // マニフェスト
  // NOTE: archiveContents は現行形式なので、版数を偽ると変換チェーンが
  // 旧→新変換を誤適用する。旧版アーカイブを模す場合のみ options.version を指定する
  const manifest: ArchiveManifest = {
    version: options.version ?? EXAM_CURRENT_VERSION,
    schemaVersion: "test",
    appVersion: "0.5.0-test",
    exportedAt: new Date().toISOString(),
    examId,
    examName,
    counts: archiveContents.counts,
  }
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)))

  // JSONデータ
  zip.addFile(
    "exam.json",
    Buffer.from(JSON.stringify(archiveContents.examData, null, 2))
  )
  zip.addFile(
    "students.json",
    Buffer.from(JSON.stringify(archiveContents.studentsData, null, 2))
  )
  zip.addFile(
    "classes.json",
    Buffer.from(JSON.stringify(archiveContents.classesData, null, 2))
  )
  zip.addFile(
    "users.json",
    Buffer.from(JSON.stringify(archiveContents.usersData, null, 2))
  )
  zip.addFile(
    "subtotals.json",
    Buffer.from(JSON.stringify(archiveContents.subtotalsData, null, 2))
  )
  zip.addFile(
    "scores.json",
    Buffer.from(JSON.stringify(archiveContents.scoresData, null, 2))
  )
  zip.addFile(
    "tags.json",
    Buffer.from(JSON.stringify(archiveContents.tagsData, null, 2))
  )

  // 画像ファイル
  if (options.masterImageFiles) {
    for (const masterImageFile of options.masterImageFiles) {
      zip.addFile(masterImageFile.archivePath, masterImageFile.content)
    }
  }
  if (options.answerSheetFiles) {
    for (const answerSheetFile of options.answerSheetFiles) {
      zip.addFile(answerSheetFile.archivePath, answerSheetFile.content)
    }
  }

  zip.writeZip(outputPath)
}

/**
 * 最小のアーカイブの中身を生成（DB不要）
 */
export function createMinimalArchiveContents(
  overrides: {
    examId?: string
    examName?: string
    studentCount?: number
    pageCount?: number
  } = {}
): TestArchiveContents {
  const examId = overrides.examId ?? "test-exam-id"
  const now = new Date().toISOString()

  return {
    examData: {
      exam: {
        id: examId,
        examName: overrides.examName ?? "テスト試験",
        referenceDate: now,
        description: null,
        createdAt: now,
        updatedAt: now,
      },
      examPages: [],
      cropRegions: [],
      pageImages: [],
      masterImages: [],
      studentAnswerImages: [],
      examStudents: [],
      userExams: [],
      examSubtotalGroups: [],
      examClassrooms: [],
    },
    studentsData: { students: [] },
    classesData: { classrooms: [], memberships: [] },
    usersData: { users: [] },
    subtotalsData: { subtotalGroups: [], subtotals: [], cropSubtotals: [] },
    scoresData: { questionScores: [], drawingAnnotations: [] },
    tagsData: { tags: [], tagSubtotalGroups: [], examTags: [] },
    counts: {
      students: 0,
      classrooms: 0,
      users: 0,
      pages: 0,
      regions: 0,
      scores: 0,
      annotations: 0,
      subtotalGroups: 0,
      masterImages: 0,
      answerSheetImages: 0,
    },
  }
}
