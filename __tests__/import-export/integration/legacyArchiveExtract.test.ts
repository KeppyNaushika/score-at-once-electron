/**
 * 旧バージョンアーカイブ ZIP の展開統合テスト
 *
 * 「data.examData.examClassrooms is not iterable」の回帰テスト:
 * v1.15.0 以前のアーカイブは exam.json のキーが examClasses のため、
 * 変換チェーン未配線時代は examClassrooms が undefined になり merge 経路が落ちた。
 * extractArchive がチェーンを通して最新形式を返すことを ZIP 実ファイルで検証する。
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, describe, expect, test } from "vitest"

import {
  cleanupTempDir,
  extractArchive,
} from "../../../electron-src/lib/import/exam-archive/archiveExtractor"

const TIMESTAMP = "2026-01-01T00:00:00.000Z"

const createdPaths: string[] = []

afterEach(() => {
  for (const createdPath of createdPaths.splice(0)) {
    fs.rmSync(createdPath, { recursive: true, force: true })
  }
})

function writeArchive(files: Record<string, unknown>): string {
  const zip = new AdmZip()
  for (const [filename, content] of Object.entries(files)) {
    zip.addFile(filename, Buffer.from(JSON.stringify(content), "utf-8"))
  }
  const archivePath = path.join(
    os.tmpdir(),
    `legacy-archive-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.score`
  )
  zip.writeZip(archivePath)
  createdPaths.push(archivePath)
  return archivePath
}

function createManifest(version: string): Record<string, unknown> {
  return {
    version,
    schemaVersion: "unknown",
    appVersion: "test",
    exportedAt: TIMESTAMP,
    examId: "exam-1",
    examName: "旧形式試験",
    counts: {
      students: 1,
      classrooms: 1,
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

describe("extractArchive（旧バージョンアーカイブ）", () => {
  test("v1.15.0 アーカイブ（examClasses キー）が最新形式で展開される", async () => {
    const archivePath = writeArchive({
      "manifest.json": createManifest("1.15.0"),
      "exam.json": {
        exam: {
          id: "exam-1",
          examName: "旧形式試験",
          examDate: null,
          description: null,
          markerCorrectionEnabled: false,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
        examPages: [],
        cropRegions: [],
        pageImages: [],
        masterImages: [],
        studentAnswerImages: [],
        examStudents: [],
        userExams: [],
        examSubtotalGroups: [],
        examClasses: [
          {
            id: "examclassroom-1",
            examId: "exam-1",
            classId: "classroom-1",
            administered: true,
            teacherStat: true,
            studentReport: false,
            order: 0,
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
        examMarkingFormats: [],
        examExportSettings: null,
      },
      "students.json": { students: [] },
      "classes.json": {
        classes: [
          {
            id: "classroom-1",
            name: "1年A組",
            classCode: "1A",
            grade: 1,
            description: null,
            isVisible: true,
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
        memberships: [],
      },
      "users.json": { users: [] },
      "subtotals.json": { subtotalGroups: [], subtotals: [] },
      "scores.json": {
        questionScores: [],
        drawingAnnotations: [],
        scoreDecisions: [],
        returnSnapshots: [],
      },
      "tags.json": { tags: [], tagSubtotalGroups: [], examTags: [] },
      "deleted-records.json": { deletedRecords: [] },
    })

    const result = await extractArchive(archivePath)
    expect(result.success).toBe(true)
    const data = result.data!
    createdPaths.push(data.tempDir)

    // 回帰: examClassrooms が必ず iterable
    expect(Array.isArray(data.examData.examClassrooms)).toBe(true)
    expect(data.examData.examClassrooms).toHaveLength(1)
    expect(data.examData.examClassrooms[0]).toMatchObject({
      classroomId: "classroom-1",
      teacherStatistics: true,
      studentReport: false,
    })

    // classes.json も現行キーへ
    expect(data.classesData.classrooms).toHaveLength(1)
    expect(data.classesData.classrooms[0].classroomCode).toBe("1A")

    // チェーン警告が伝播する
    expect(data.transformWarnings.length).toBeGreaterThan(0)
    expect(data.manifest.version).toBe("1.21.0")

    cleanupTempDir(data.tempDir)
  })

  test("v1.0.0 アーカイブ（project.json）が最新形式で展開される", async () => {
    const archivePath = writeArchive({
      "manifest.json": {
        ...createManifest("1.0.0"),
      },
      "project.json": {
        project: {
          id: "exam-1",
          examName: "v0.2試験",
          examDate: null,
          subject: "数学",
          description: null,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
        projectPages: [
          {
            id: "page-1",
            projectId: "exam-1",
            pageNumber: 1,
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
        cropRegions: [],
        pageImages: [
          {
            id: "img-1",
            projectPageId: "page-1",
            studentId: null,
            imagePath: "master-images/1.png",
            imageType: "MODEL_ANSWER",
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
        projectStudents: [],
        userProjects: [],
        projectSubtotalGroups: [],
      },
      "students.json": {
        students: [
          {
            id: "student-1",
            studentId: "1001",
            lastName: "山田",
            firstName: "太郎",
            lastNameKana: "ヤマダ",
            firstNameKana: "タロウ",
            enrollmentYear: null,
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
      },
      "classes.json": { classes: [], memberships: [] },
      "users.json": { users: [] },
      "subtotals.json": { subtotalGroups: [], subtotals: [] },
      "scores.json": { questionScores: [], drawingAnnotations: [] },
    })

    const result = await extractArchive(archivePath)
    expect(result.success).toBe(true)
    const data = result.data!
    createdPaths.push(data.tempDir)

    expect(data.manifest.version).toBe("1.21.0")
    expect(data.examData.exam.id).toBe("exam-1")
    expect(data.examData.examPages).toHaveLength(1)
    expect(data.examData.examClassrooms).toEqual([])
    expect(data.examData.masterImages).toEqual([
      expect.objectContaining({ id: "img-1", examPageId: "page-1" }),
    ])
    expect(data.studentsData.students[0].studentNumber).toBe("1001")
    expect(data.scoresData.scoreDecisions).toEqual([])
    expect(data.tagsData).toBeDefined()

    cleanupTempDir(data.tempDir)
  })

  test("現行形式のアーカイブは無変換（transformWarnings が空）", async () => {
    const archivePath = writeArchive({
      "manifest.json": createManifest("1.18.0"),
      "exam.json": {
        exam: {
          id: "exam-1",
          examName: "現行試験",
          examDate: null,
          description: null,
          markerCorrectionEnabled: false,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
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
        examMarkingFormats: [],
        examExportSettings: null,
      },
      "students.json": { students: [] },
      "classes.json": { classrooms: [], memberships: [] },
      "users.json": { users: [] },
      "subtotals.json": { subtotalGroups: [], subtotals: [] },
      "scores.json": {
        questionScores: [],
        drawingAnnotations: [],
        scoreDecisions: [],
        returnSnapshots: [],
      },
      "tags.json": { tags: [], tagSubtotalGroups: [], examTags: [] },
      "deleted-records.json": { deletedRecords: [] },
    })

    const result = await extractArchive(archivePath)
    expect(result.success).toBe(true)
    const data = result.data!
    createdPaths.push(data.tempDir)

    expect(data.transformWarnings).toEqual([])
    expect(data.manifest.version).toBe("1.21.0")

    cleanupTempDir(data.tempDir)
  })
})
