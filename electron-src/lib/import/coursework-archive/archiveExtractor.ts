/**
 * 試験外成績資料アーカイブ (.coursework) の展開
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import type {
  ArchiveCourseworkClassroomRow,
  ArchiveCourseworkItemRow,
  ArchiveCourseworkLetterScaleRow,
  ArchiveCourseworkRow,
  ArchiveCourseworkScoreRow,
  ArchiveCourseworkStudentRow,
  ArchiveCourseworkTagRow,
  ArchiveCwClass,
  ArchiveCwMembership,
  ArchiveCwStudent,
  ArchiveCwTag,
  CourseworkArchiveManifest,
} from "../../../../src/types/courseworkArchive.types"
import { isLegacyCourseworkTree } from "../coursework-transformers/legacyShape"
import type { AnyCourseworkArchiveData } from "../coursework-transformers/types"
import { normalizeLegacyClassroomKeys } from "../shared/legacyClassroomKeys"

interface ExtractedCourseworkArchive {
  manifest: CourseworkArchiveManifest
  /** 版が確定していない生データ。現行の形への正規化は変換チェーンが行う */
  data: AnyCourseworkArchiveData
  tempDir: string
}

function readJsonFile<T>(dir: string, name: string): T | null {
  const filePath = path.join(dir, name)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T
}

/**
 * 版の判定に使う配列を、型を主張せずに読む。
 *
 * `readJsonFile<T>` は中身を確かめずに T を名乗らせるので、まだ版が判っていない
 * courseworks.json には使わない。ここでは配列であることだけを実際に確かめ、
 * 要素の形の判定は型ガード（isLegacyCourseworkTree）に委ねる。
 */
function readJsonArray(dir: string, name: string): unknown[] {
  const parsed = readJsonFile<unknown>(dir, name)
  return Array.isArray(parsed) ? parsed : []
}

/**
 * .coursework アーカイブを一時ディレクトリへ展開し、各 JSON を読み込む。
 * 呼び出し側は data.tempDir を cleanupCourseworkTempDir で必ず後始末すること。
 */
export async function extractCourseworkArchive(
  archivePath: string
): Promise<ExtractedCourseworkArchive> {
  const tempDir = path.join(
    os.tmpdir(),
    `coursework-archive-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  )

  try {
    if (!fs.existsSync(archivePath)) {
      throw new Error("アーカイブファイルが見つかりません")
    }

    const zip = new AdmZip(archivePath)
    zip.extractAllTo(tempDir, true)

    const manifest = readJsonFile<CourseworkArchiveManifest>(
      tempDir,
      "manifest.json"
    )
    if (!manifest) {
      throw new Error("マニフェストファイルが見つかりません")
    }

    // 学級リネーム前の旧キー（classId/classes/className/classCode）は読取り時に現行キー（classroom*）へ正規化
    const courseworksJson = normalizeLegacyClassroomKeys(
      readJsonArray(tempDir, "courseworks.json")
    )
    const studentsData =
      readJsonFile<ArchiveCwStudent[]>(tempDir, "students.json") ?? []
    const classesData = normalizeLegacyClassroomKeys(
      readJsonFile<ArchiveCwClass[]>(tempDir, "classes.json") ?? []
    )
    const membershipsData = normalizeLegacyClassroomKeys(
      readJsonFile<ArchiveCwMembership[]>(tempDir, "memberships.json") ?? []
    )
    const tagsData = readJsonFile<ArchiveCwTag[]>(tempDir, "tags.json") ?? []

    // 現行の形でなければ旧版の形のまま変換器へ渡す（旧版の知識は変換器が持つ）。
    // 現行と判った側は、その版の型で読み直す（JSON の型付けは readJsonFile に集約する）。
    const sections = isLegacyCourseworkTree(courseworksJson)
      ? { courseworks: courseworksJson }
      : {
          courseworks: normalizeLegacyClassroomKeys(
            readJsonFile<ArchiveCourseworkRow[]>(tempDir, "courseworks.json") ??
              []
          ),
          courseworkClassrooms: normalizeLegacyClassroomKeys(
            readJsonFile<ArchiveCourseworkClassroomRow[]>(
              tempDir,
              "coursework-classrooms.json"
            ) ?? []
          ),
          courseworkTags:
            readJsonFile<ArchiveCourseworkTagRow[]>(
              tempDir,
              "coursework-tags.json"
            ) ?? [],
          courseworkStudents:
            readJsonFile<ArchiveCourseworkStudentRow[]>(
              tempDir,
              "coursework-students.json"
            ) ?? [],
          courseworkItems:
            readJsonFile<ArchiveCourseworkItemRow[]>(
              tempDir,
              "coursework-items.json"
            ) ?? [],
          courseworkLetterScales:
            readJsonFile<ArchiveCourseworkLetterScaleRow[]>(
              tempDir,
              "coursework-letter-scales.json"
            ) ?? [],
          courseworkScores:
            readJsonFile<ArchiveCourseworkScoreRow[]>(
              tempDir,
              "coursework-scores.json"
            ) ?? [],
        }

    return {
      manifest,
      data: {
        manifest,
        ...sections,
        studentsData,
        classesData,
        membershipsData,
        tagsData,
      },
      tempDir,
    }
  } catch (error) {
    // 展開途中で落ちたら一時ディレクトリは呼び出し側へ渡らないのでここで捨てる
    cleanupCourseworkTempDir(tempDir)
    throw error
  }
}

/** 一時ディレクトリを削除 */
export function cleanupCourseworkTempDir(tempDir: string): void {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  } catch (error) {
    console.error("Error cleaning up temp directory:", error)
  }
}
