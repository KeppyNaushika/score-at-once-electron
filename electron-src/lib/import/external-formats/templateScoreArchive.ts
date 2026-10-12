/**
 * 外部形式（百問繚乱 .hsz・リアテンダント .dat）から変換した結果を、
 * テンプレートモードの .score として書き出す共通処理
 *
 * 各変換器は外部形式を読んで ExamPage / CropRegion / 小計を組み立てるところまでを受け持ち、
 * .score の zip の組み立てと小計グループの行の生成はここに寄せる。
 */

import AdmZip from "adm-zip"
import * as crypto from "crypto"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import type {
  ArchiveExamData,
  ArchiveSubtotalsData,
} from "../../../../src/types/examArchive.types"
import { EXAM_CURRENT_VERSION } from "../../../../src/types/examArchive.types"

/**
 * 書き出す .score の中の ExamPage・CropRegion 1件。
 *
 * ここが作るのは DB の行ではなく**アーカイブの中身**なので、Prisma の型ではなく
 * アーカイブの型（版ごとに凍結された wire format）から導く。手写しにしておくと、
 * アーカイブ側に列が増えても外部形式の変換だけが古い形を書き続ける。
 */
export type ConvertedExamPage = ArchiveExamData["examPages"][number]
export type ConvertedCropRegion = ArchiveExamData["cropRegions"][number]

/** SubtotalGroup/Subtotal/CropSubtotal/ExamSubtotalGroup の生成結果 */
export interface ConvertedSubtotalData extends ArchiveSubtotalsData {
  examSubtotalGroups: Array<{
    id: string
    examId: string
    subtotalGroupId: string
  }>
}

/** appendSubtotalGroup に渡す、小計グループ1つ分の中身 */
interface SubtotalGroupSpec<SubtotalKey> {
  /** SubtotalGroup の名前（「大問」「観点」） */
  groupName: string
  /** 並べたい順の Subtotal。key は下の割り当てから Subtotal を引くのに使う */
  subtotals: Array<{ key: SubtotalKey; name: string }>
  /** QUESTION_ASSIGNMENT: 設問の CropRegion → key の Subtotal */
  questionAssignments: Array<{ key: SubtotalKey; cropRegionIds: string[] }>
  /** SUBTOTAL_DEFINITION: 小計の印字欄の CropRegion → key の Subtotal */
  definitionAssignments: Array<{ key: SubtotalKey; cropRegionId: string }>
}

/** 空の小計データ */
export function createEmptySubtotalData(): ConvertedSubtotalData {
  return {
    subtotalGroups: [],
    subtotals: [],
    cropSubtotals: [],
    examSubtotalGroups: [],
  }
}

/**
 * 小計グループを1つ作り、Subtotal と CropSubtotal を subtotalData に追記する
 *
 * Subtotal の order は spec.subtotals の並び順。割り当ての key に対応する Subtotal が
 * 無いものは黙って捨てる（大問・観点の印字欄だけあって設問が無い場合など）。
 * CropSubtotal は QUESTION_ASSIGNMENT をすべて並べてから SUBTOTAL_DEFINITION を並べる。
 */
export function appendSubtotalGroup<SubtotalKey>(
  subtotalData: ConvertedSubtotalData,
  spec: SubtotalGroupSpec<SubtotalKey>,
  examId: string,
  now: string
): void {
  const subtotalGroupId = generateUuid()
  subtotalData.subtotalGroups.push({
    id: subtotalGroupId,
    name: spec.groupName,
    createdAt: now,
    updatedAt: now,
  })
  subtotalData.examSubtotalGroups.push({
    id: generateUuid(),
    examId,
    subtotalGroupId,
  })

  const keyToSubtotalId = new Map<SubtotalKey, string>()
  spec.subtotals.forEach((subtotal, order) => {
    const subtotalId = generateUuid()
    keyToSubtotalId.set(subtotal.key, subtotalId)
    subtotalData.subtotals.push({
      id: subtotalId,
      name: subtotal.name,
      subtotalGroupId,
      order,
      createdAt: now,
      updatedAt: now,
    })
  })

  for (const questionAssignment of spec.questionAssignments) {
    const subtotalId = keyToSubtotalId.get(questionAssignment.key)
    if (!subtotalId) continue

    for (const cropRegionId of questionAssignment.cropRegionIds) {
      subtotalData.cropSubtotals.push({
        id: generateUuid(),
        cropRegionId,
        subtotalId,
        assignmentType: "QUESTION_ASSIGNMENT",
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  for (const definitionAssignment of spec.definitionAssignments) {
    const subtotalId = keyToSubtotalId.get(definitionAssignment.key)
    if (!subtotalId) continue

    subtotalData.cropSubtotals.push({
      id: generateUuid(),
      cropRegionId: definitionAssignment.cropRegionId,
      subtotalId,
      assignmentType: "SUBTOTAL_DEFINITION",
      createdAt: now,
      updatedAt: now,
    })
  }
}

/** writeTemplateScoreArchive に渡す、変換済みの試験一式 */
interface TemplateScoreArchiveSource {
  examId: string
  examName: string
  description: string
  /** manifest.schemaVersion（"hsz-import" など、変換元の形式を表す） */
  schemaVersion: string
  /** manifest.sourceDbId（"hsz:<id>" など、変換元の試験を表す） */
  sourceDbId: string
  examPages: ConvertedExamPage[]
  cropRegions: ConvertedCropRegion[]
  subtotalData: ConvertedSubtotalData
  /** master-images/ に入れる模範解答画像（fileName は ExamPage.imagePath と揃える） */
  masterImages: Array<{ fileName: string; image: Buffer }>
  /** 一時ディレクトリ名の接頭辞（"hsz-convert-" など） */
  tempDirPrefix: string
  now: string
}

/**
 * 変換済みの試験一式を、テンプレートモードの .score として一時ファイルに書き出す
 *
 * 生徒・学級・利用者・採点・タグは空で書く。
 *
 * @returns 書き出した .score のパス
 */
export function writeTemplateScoreArchive(
  source: TemplateScoreArchiveSource
): string {
  const { examId, examName, examPages, cropRegions, subtotalData, now } = source

  const examData = {
    exam: {
      id: examId,
      examName,
      referenceDate: null,
      description: source.description,
      createdAt: now,
      updatedAt: now,
    },
    examPages,
    cropRegions,
    pageImages: [], // v1.2.0以降は使用しない
    studentAnswerImages: [],
    examStudents: [],
    userExams: [],
    examSubtotalGroups: subtotalData.examSubtotalGroups,
    examClassrooms: [],
    examMarkingFormats: [],
  }

  const manifest = {
    version: EXAM_CURRENT_VERSION,
    schemaVersion: source.schemaVersion,
    appVersion: "0.0.0",
    exportedAt: now,
    sourceDbId: source.sourceDbId,
    examId,
    examName,
    exportMode: "template_with_subtotals",
    counts: {
      students: 0,
      classes: 0,
      users: 0,
      pages: examPages.length,
      regions: cropRegions.length,
      scores: 0,
      annotations: 0,
      subtotalGroups: subtotalData.subtotalGroups.length,
      masterImages: examPages.filter((page) => page.imagePath).length,
      answerSheetImages: 0,
    },
  }

  const scoreZip = new AdmZip()

  // JSON ファイル追加
  const addJsonFile = (fileName: string, content: object) => {
    scoreZip.addFile(fileName, Buffer.from(JSON.stringify(content, null, 2)))
  }
  addJsonFile("manifest.json", manifest)
  addJsonFile("exam.json", examData)
  addJsonFile("students.json", { students: [] })
  addJsonFile("classes.json", { classes: [], memberships: [] })
  addJsonFile("users.json", { users: [] })
  addJsonFile("subtotals.json", {
    subtotalGroups: subtotalData.subtotalGroups,
    subtotals: subtotalData.subtotals,
    cropSubtotals: subtotalData.cropSubtotals,
  })
  addJsonFile("scores.json", { questionScores: [], drawingAnnotations: [] })
  addJsonFile("tags.json", { tags: [], tagSubtotalGroups: [], examTags: [] })

  // 模範解答画像を master-images/ にコピー
  for (const masterImage of source.masterImages) {
    scoreZip.addFile(`master-images/${masterImage.fileName}`, masterImage.image)
  }

  // 一時ファイルに書き出し
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), source.tempDirPrefix))
  const scorePath = path.join(tempDir, "converted.score")
  scoreZip.writeZip(scorePath)

  return scorePath
}

/**
 * UUID v4 生成
 */
export function generateUuid(): string {
  return crypto.randomUUID()
}
