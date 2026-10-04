/**
 * 旧形式アーカイブ（.score / .coursework / .grade）の固定ファイルを読むためのヘルパー
 *
 * 旧5種の書き出しは消え、読み込みだけが凍結して残る。読み込みのテストは、
 * 書き出しがあった頃に旧書き出し（electron-src/lib/export/*-archive）で作った
 * アーカイブを `__tests__/fixtures/legacy-archives/` に固定ファイルとして置き、
 * それを読む。固定ファイルを作ったスクリプトは残していない（もう旧書き出しが無いので
 * 作り直せない）。各ファイルの元データは、それを読むテストの冒頭に書いてある。
 *
 * 固定ファイルの id は作ったときの乱数のまま固定されている。取り込み先に
 * 「同じ id の行が既にある」状態が要るテストは、ここの seed 関数で固定ファイルの
 * JSON から行を作る。
 */

import * as path from "path"

import {
  cleanupCourseworkTempDir,
  extractCourseworkArchive,
} from "../../electron-src/lib/import/coursework-archive/archiveExtractor"
import { transformCourseworkToLatest } from "../../electron-src/lib/import/coursework-transformers"
import {
  cleanupTempDir,
  extractArchive,
  type ExtractedArchiveData,
} from "../../electron-src/lib/import/exam-archive/archiveExtractor"
import { extractGradeArchive } from "../../electron-src/lib/import/grade-archive/gradeArchiveExtractor"
import { transformGradeToLatest } from "../../electron-src/lib/import/grade-transformers"
import { executeIdIntegrationImport } from "../../electron-src/lib/import/merge/idIntegrationImporter"
import { performPreMatching } from "../../electron-src/lib/import/merge/matcher"
import type { CourseworkArchiveData } from "../../src/types/courseworkArchive.types"
import type { ArchiveUsersData } from "../../src/types/examArchive.types"
import type { GradeArchiveData } from "../../src/types/gradeArchive.types"
import { createIdIntegrationConfig } from "./testDataFactory"
import { getTestPrismaClient } from "./testPrismaClient"

const LEGACY_ARCHIVE_DIR = path.resolve(
  __dirname,
  "../fixtures/legacy-archives"
)

/** 固定ファイルの絶対パス */
export function legacyArchivePath(fileName: string): string {
  return path.join(LEGACY_ARCHIVE_DIR, fileName)
}

/**
 * 試験の固定ファイル（.score）を展開する。
 * 呼び出し側は `cleanupTempDir(extracted.tempDir)` で後始末すること。
 */
export async function extractLegacyExamArchive(
  fileName: string
): Promise<ExtractedArchiveData> {
  const result = await extractArchive(legacyArchivePath(fileName))
  if (!result.success || !result.data) {
    throw new Error(result.error ?? `${fileName} を展開できません`)
  }
  return result.data
}

/** 試験の固定ファイルで、書き出した本人の利用者名（固定ファイルを作るときに付けた） */
export const LEGACY_EXAM_EXPORTER_USERNAME = "exporter"

/** users.json の利用者を、同じ id のままこの DB に作る（＝書き出したパソコンを模す） */
export async function createUsersFromArchive(
  usersData: ArchiveUsersData
): Promise<void> {
  const prisma = getTestPrismaClient()
  for (const user of usersData.users) {
    await prisma.user.create({
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    })
  }
}

/**
 * 試験の固定ファイルの中身を、空の DB に「書き出したパソコンの状態」として作る。
 *
 * 利用者を同じ id で作り、書き出した本人として取り込む。試験・生徒・学級・
 * 採点などの行は固定ファイルの id のまま入るので、続けて同じ固定ファイルを
 * 取り込めば「同じ試験が既にある」取り込み（統合・別で追加・上書き）になる。
 *
 * @returns 書き出した本人の利用者 id
 */
export async function seedExamFromLegacyArchive(
  fileName: string
): Promise<string> {
  const extracted = await extractLegacyExamArchive(fileName)
  try {
    await createUsersFromArchive(extracted.usersData)
    const exporter = extracted.usersData.users.find(
      (user) => user.username === LEGACY_EXAM_EXPORTER_USERNAME
    )
    if (!exporter) {
      throw new Error(`${fileName} に書き出した本人が載っていません`)
    }
    const preMatch = await performPreMatching(extracted)
    await executeIdIntegrationImport(
      extracted,
      preMatch,
      createIdIntegrationConfig(),
      exporter.id
    )
    return exporter.id
  } finally {
    cleanupTempDir(extracted.tempDir)
  }
}

/** 資料の固定ファイル（.coursework）を読み、現行の形に揃えて返す */
export async function readLegacyCourseworkArchive(
  fileName: string
): Promise<CourseworkArchiveData> {
  const extracted = await extractCourseworkArchive(legacyArchivePath(fileName))
  cleanupCourseworkTempDir(extracted.tempDir)
  return transformCourseworkToLatest(extracted.data).data
}

/** 成績算出の固定ファイル（.grade）を読み、現行の形に揃えて返す */
export async function readLegacyGradeArchive(
  fileName: string
): Promise<GradeArchiveData> {
  const raw = await extractGradeArchive(legacyArchivePath(fileName))
  return transformGradeToLatest(raw).data
}

/**
 * 資料アーカイブの各セクションの行を、そのままの id・時刻でこの DB に作る
 * （＝書き出したパソコンの状態を模す）。生徒・学級・所属・タグも含む。
 *
 * .grade に内包される資料（`courseworkArchive`）も同じ形なので、これで作れる。
 */
export async function seedCourseworkSections(
  sections: Omit<CourseworkArchiveData, "manifest">
): Promise<void> {
  const prisma = getTestPrismaClient()
  await prisma.student.createMany({ data: sections.studentsData })
  await prisma.classroom.createMany({ data: sections.classesData })
  await prisma.studentClassroomMembership.createMany({
    data: sections.membershipsData,
  })
  await prisma.tag.createMany({ data: sections.tagsData })
  await prisma.coursework.createMany({ data: sections.courseworks })
  await prisma.courseworkClassroom.createMany({
    data: sections.courseworkClassrooms,
  })
  await prisma.courseworkTag.createMany({ data: sections.courseworkTags })
  await prisma.courseworkStudent.createMany({
    data: sections.courseworkStudents,
  })
  await prisma.courseworkItem.createMany({ data: sections.courseworkItems })
  await prisma.courseworkLetterScale.createMany({
    data: sections.courseworkLetterScales,
  })
  await prisma.courseworkScore.createMany({ data: sections.courseworkScores })
}
