/**
 * テスト用アーカイブヘルパー
 *
 * Electron非依存でZIPアーカイブの作成・検証を行う
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as path from "path"

import type { CollectedData } from "../../electron-src/lib/export/project-archive/dataCollector"
import type {
  ArchiveClassesData,
  ArchiveManifest,
  ArchiveProjectData,
  ArchiveScoresData,
  ArchiveStudentsData,
  ArchiveSubjectsData,
  ArchiveSubtotalsData,
  ArchiveUsersData,
} from "../../types/projectArchive.types"

/**
 * テスト用アーカイブを作成
 */
export function createTestArchive(
  collectedData: CollectedData,
  outputPath: string,
  projectId: string,
  projectName: string,
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
  const manifest: ArchiveManifest = {
    version: options.version ?? "1.4.0",
    schemaVersion: "test",
    appVersion: "0.5.0-test",
    exportedAt: new Date().toISOString(),
    projectId,
    projectName,
    counts: collectedData.counts,
  }
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)))

  // JSONデータ
  zip.addFile(
    "project.json",
    Buffer.from(JSON.stringify(collectedData.projectData, null, 2))
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
    "subjects.json",
    Buffer.from(JSON.stringify(collectedData.subjectsData, null, 2))
  )

  // 画像ファイル
  if (options.masterImageFiles) {
    for (const img of options.masterImageFiles) {
      zip.addFile(img.archivePath, img.content)
    }
  }
  if (options.answerSheetFiles) {
    for (const img of options.answerSheetFiles) {
      zip.addFile(img.archivePath, img.content)
    }
  }

  zip.writeZip(outputPath)
}

/**
 * アーカイブ内のJSONファイルを検証
 */
export function verifyArchiveContents(archivePath: string): {
  manifest: ArchiveManifest
  projectData: ArchiveProjectData
  studentsData: ArchiveStudentsData
  classesData: ArchiveClassesData
  usersData: ArchiveUsersData
  subtotalsData: ArchiveSubtotalsData
  scoresData: ArchiveScoresData
  subjectsData: ArchiveSubjectsData | null
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

  const projectData = readJson<ArchiveProjectData>("project.json")
  if (!projectData) throw new Error("project.json not found in archive")

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

  const subjectsData = readJson<ArchiveSubjectsData>("subjects.json")

  // 画像エントリを収集
  const imageEntries = zip
    .getEntries()
    .filter(
      (e) =>
        e.entryName.startsWith("master-images/") ||
        e.entryName.startsWith("answer-sheets/")
    )
    .map((e) => e.entryName)

  return {
    manifest,
    projectData,
    studentsData,
    classesData,
    usersData,
    subtotalsData,
    scoresData,
    subjectsData,
    imageEntries,
  }
}

/**
 * CollectedData形式のテストデータを生成（DB不要）
 */
export function createMinimalCollectedData(
  overrides: {
    projectId?: string
    projectName?: string
    studentCount?: number
    pageCount?: number
  } = {}
): CollectedData {
  const projectId = overrides.projectId ?? "test-project-id"
  const now = new Date().toISOString()

  return {
    projectData: {
      project: {
        id: projectId,
        examName: overrides.projectName ?? "テスト試験",
        examDate: now,
        subject: "数学",
        description: null,
        createdAt: now,
        updatedAt: now,
      },
      projectPages: [],
      cropRegions: [],
      pageImages: [],
      masterImages: [],
      studentAnswerImages: [],
      projectStudents: [],
      userProjects: [],
      projectSubtotalGroups: [],
      projectClasses: [],
      projectMarkingFormats: [],
      projectExportSettings: null,
      cropRegionMarkingOverrides: [],
    },
    studentsData: { students: [] },
    classesData: { classes: [], memberships: [] },
    usersData: { users: [] },
    subtotalsData: { subtotalGroups: [], subtotals: [], cropSubtotals: [] },
    scoresData: { questionScores: [], drawingAnnotations: [] },
    subjectsData: { subjects: [], subjectSubtotalGroups: [] },
    counts: {
      students: 0,
      classes: 0,
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
