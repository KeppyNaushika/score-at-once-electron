/**
 * テスト用アーカイブヘルパー
 *
 * Electron非依存でZIPアーカイブの作成・検証を行う
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as path from "path"

import type { CollectedData } from "../../electron-src/lib/export/exam-archive/dataCollector"
import type {
  ArchiveClassesData,
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
 * テスト用アーカイブを作成
 */
export function createTestArchive(
  collectedData: CollectedData,
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
  // NOTE: collectedData は現行形式なので、版数を偽ると変換チェーンが
  // 旧→新変換を誤適用する。旧版アーカイブを模す場合のみ options.version を指定する
  const manifest: ArchiveManifest = {
    version: options.version ?? EXAM_CURRENT_VERSION,
    schemaVersion: "test",
    appVersion: "0.5.0-test",
    exportedAt: new Date().toISOString(),
    examId,
    examName,
    counts: collectedData.counts,
  }
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)))

  // JSONデータ
  zip.addFile(
    "exam.json",
    Buffer.from(JSON.stringify(collectedData.examData, null, 2))
  )
  zip.addFile(
    "students.json",
    Buffer.from(JSON.stringify(collectedData.studentsData, null, 2))
  )
  zip.addFile(
    "classes.json",
    Buffer.from(JSON.stringify(collectedData.classesData, null, 2))
  )
  zip.addFile(
    "users.json",
    Buffer.from(JSON.stringify(collectedData.usersData, null, 2))
  )
  zip.addFile(
    "subtotals.json",
    Buffer.from(JSON.stringify(collectedData.subtotalsData, null, 2))
  )
  zip.addFile(
    "scores.json",
    Buffer.from(JSON.stringify(collectedData.scoresData, null, 2))
  )
  zip.addFile(
    "tags.json",
    Buffer.from(JSON.stringify(collectedData.tagsData, null, 2))
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
 * アーカイブ内のJSONファイルを検証
 */
export function verifyArchiveContents(archivePath: string): {
  manifest: ArchiveManifest
  examData: ArchiveExamData
  studentsData: ArchiveStudentsData
  classesData: ArchiveClassesData
  usersData: ArchiveUsersData
  subtotalsData: ArchiveSubtotalsData
  scoresData: ArchiveScoresData
  tagsData: ArchiveTagsData | null
  imageEntries: string[]
} {
  const zip = new AdmZip(archivePath)

  const readJson = <T>(name: string): T | null => {
    const entry = zip.getEntry(name)
    if (!entry) return null
    return JSON.parse(zip.readAsText(entry)) as T
  }

  const manifest = readJson<ArchiveManifest>("manifest.json")
  if (!manifest) throw new Error("manifest.json not found in archive")

  const examData = readJson<ArchiveExamData>("exam.json")
  if (!examData) throw new Error("exam.json not found in archive")

  const studentsData = readJson<ArchiveStudentsData>("students.json")
  if (!studentsData) throw new Error("students.json not found in archive")

  const classesData = readJson<ArchiveClassesData>("classes.json")
  if (!classesData) throw new Error("classes.json not found in archive")

  const usersData = readJson<ArchiveUsersData>("users.json")
  if (!usersData) throw new Error("users.json not found in archive")

  const subtotalsData = readJson<ArchiveSubtotalsData>("subtotals.json")
  if (!subtotalsData) throw new Error("subtotals.json not found in archive")

  const scoresData = readJson<ArchiveScoresData>("scores.json")
  if (!scoresData) throw new Error("scores.json not found in archive")

  const tagsData = readJson<ArchiveTagsData>("tags.json")

  // 画像エントリを収集
  const imageEntries = zip
    .getEntries()
    .filter(
      (e) =>
        e.entryName.startsWith("master-images/") ||
        e.entryName.startsWith("answer-sheets/")
    )
    .map((entry) => entry.entryName)

  return {
    manifest,
    examData,
    studentsData,
    classesData,
    usersData,
    subtotalsData,
    scoresData,
    tagsData,
    imageEntries,
  }
}

/**
 * CollectedData形式のテストデータを生成（DB不要）
 */
export function createMinimalCollectedData(
  overrides: {
    examId?: string
    examName?: string
    studentCount?: number
    pageCount?: number
  } = {}
): CollectedData {
  const examId = overrides.examId ?? "test-exam-id"
  const now = new Date().toISOString()

  return {
    examData: {
      exam: {
        id: examId,
        examName: overrides.examName ?? "テスト試験",
        examDate: now,
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
    masterImagePaths: [],
    answerSheetPaths: [],
  }
}
