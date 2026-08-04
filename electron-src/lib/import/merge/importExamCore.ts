/**
 * ID統合インポート: 試験骨格（Exam根・ExamPage・CropRegion・参加情報）の処理
 *
 * 試験ID一致時は既存の試験にマージ（ExamPage/CropRegionはID一致でマッピング）、
 * 不一致時は新規作成する。UserExam/ExamSubtotalGroup/ExamStudentの参加情報も扱う。
 */

import * as crypto from "crypto"
import * as path from "path"

import type { FileOverviewData } from "../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { IdMappings, ImportCounts, PrismaTransaction } from "./types"

/**
 * アーカイブ内の模範解答画像パスを、取り込み先の試験ディレクトリのパスへ読み替える。
 * 画像の実体をそこへ置くのは imageImporter の copyImportImages で、
 * `master-images` という置き先の規則を共有している。
 */
function toImportedMasterImagePath(
  newExamId: string,
  archiveImagePath: string | null
): string | null {
  if (!archiveImagePath) return null
  return `exams/${newExamId}/master-images/${path.basename(archiveImagePath)}`
}

/**
 * 既に存在するページに模範解答画像が無く、アーカイブ側が持っているなら補う。
 *
 * 旧実装（imageImporter の createMasterImageRecords）は「対象ページに MasterImage 行が
 * 無ければ作る」を行っていた。ページ作成時にしか画像を書かないと、模範解答を失った
 * ページを同じ試験のアーカイブから復旧する手段が無くなる（画像ファイルだけがコピーされ、
 * 参照されないまま残る）。既にある画像は上書きしない — 取り込みで現物を差し替えない
 */
async function backfillMasterImage(
  existingPage: { id: string; imagePath: string | null },
  archivePage: { imagePath: string | null; pageSize: string },
  newExamId: string,
  tx: PrismaTransaction
): Promise<void> {
  if (existingPage.imagePath) return

  const imagePath = toImportedMasterImagePath(newExamId, archivePage.imagePath)
  if (!imagePath) return

  await tx.examPage.update({
    where: { id: existingPage.id },
    data: { imagePath, pageSize: archivePage.pageSize },
  })
}

export async function processExam(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  idMappings: IdMappings,
  counts: ImportCounts,
  warnings: string[],
  tx: PrismaTransaction
): Promise<string> {
  const exam = data.examData.exam
  const isExamIdMatch = preMatchResult.exam?.isIdMatch ?? false

  if (isExamIdMatch && preMatchResult.exam?.existingExamId) {
    // 試験ID一致 → 既存試験を使用（マージ）
    const newExamId = preMatchResult.exam.existingExamId
    idMappings.exam[exam.id] = newExamId

    // 既存のExamPageとCropRegionをID一致でマッピング
    await mapExistingExamPages(data, newExamId, idMappings, counts, tx)
    await mapExistingCropRegions(data, newExamId, idMappings, counts, tx)

    return newExamId
  }

  // 試験ID不一致 → 新規作成
  const existingById = await tx.exam.findUnique({
    where: { id: exam.id },
  })
  if (existingById) {
    idMappings.exam[exam.id] = exam.id
    warnings.push(
      `試験ID「${exam.id}」は既に使用されています。既存試験にデータがマージされます。`
    )
    return exam.id
  }
  await tx.exam.create({
    data: {
      id: exam.id,
      examName: exam.examName,
      examDate: exam.examDate ? new Date(exam.examDate) : null,
      description: exam.description,
    },
  })
  idMappings.exam[exam.id] = exam.id
  return exam.id
}

async function mapExistingExamPages(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: PrismaTransaction
): Promise<void> {
  const existingExamPages = await tx.examPage.findMany({
    where: { examId: newExamId },
  })
  const existingPageById = new Map(
    existingExamPages.map((page) => [page.id, page])
  )

  for (const page of data.examData.examPages) {
    const existingPage = existingPageById.get(page.id)
    if (existingPage) {
      await backfillMasterImage(existingPage, page, newExamId, tx)
      idMappings.examPage[page.id] = page.id
      counts.unchanged.pages++
    } else {
      const existingById = await tx.examPage.findUnique({
        where: { id: page.id },
      })
      if (existingById) {
        await backfillMasterImage(existingById, page, newExamId, tx)
        idMappings.examPage[page.id] = page.id
        counts.unchanged.pages++
      } else {
        await tx.examPage.create({
          data: {
            id: page.id,
            examId: newExamId,
            pageNumber: page.pageNumber,
            imagePath: toImportedMasterImagePath(newExamId, page.imagePath),
            pageSize: page.pageSize,
          },
        })
        idMappings.examPage[page.id] = page.id
        counts.created.pages++
      }
    }
  }
}

async function mapExistingCropRegions(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: PrismaTransaction
): Promise<void> {
  const existingCropRegions = await tx.cropRegion.findMany({
    where: {
      examPage: { examId: newExamId },
    },
  })
  const existingRegionIds = new Set(
    existingCropRegions.map((cropRegion) => cropRegion.id)
  )

  for (const region of data.examData.cropRegions) {
    const mappedPageId = idMappings.examPage[region.examPageId]
    if (!mappedPageId) continue

    if (existingRegionIds.has(region.id)) {
      idMappings.cropRegion[region.id] = region.id
      counts.unchanged.regions++
    } else {
      const existingById = await tx.cropRegion.findUnique({
        where: { id: region.id },
      })
      if (existingById) {
        idMappings.cropRegion[region.id] = region.id
        counts.unchanged.regions++
      } else {
        await tx.cropRegion.create({
          data: {
            id: region.id,
            examPageId: mappedPageId,
            label: region.label,
            type: region.type,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
            points: region.points,
            orderIndex: region.orderIndex,
          },
        })
        idMappings.cropRegion[region.id] = region.id
        counts.created.regions++
      }
    }
  }
}

export async function processUserExam(
  isExamIdMatch: boolean,
  newExamId: string,
  currentUserId: string,
  tx: PrismaTransaction
): Promise<void> {
  if (isExamIdMatch) {
    const existingUserExam = await tx.userExam.findUnique({
      where: {
        userId_examId: {
          userId: currentUserId,
          examId: newExamId,
        },
      },
    })
    if (!existingUserExam) {
      await tx.userExam.create({
        data: {
          id: crypto.randomUUID(),
          userId: currentUserId,
          examId: newExamId,
          role: "MEMBER",
          invitedAt: new Date(),
          invitedBy: null,
        },
      })
    }
  } else {
    await tx.userExam.create({
      data: {
        id: crypto.randomUUID(),
        userId: currentUserId,
        examId: newExamId,
        role: "OWNER",
        invitedAt: new Date(),
        invitedBy: null,
      },
    })
  }
}

export async function processExamSubtotalGroups(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  tx: PrismaTransaction
): Promise<void> {
  for (const examSubtotalGroup of data.examData.examSubtotalGroups) {
    const newGroupId =
      idMappings.subtotalGroup[examSubtotalGroup.subtotalGroupId]
    if (!newGroupId) continue

    // **探すキーは DB が守っているキーに合わせる。** id は uuidv4 なので端末ごとに異なり、
    // アーカイブ側の id とも一致しない。ここで id を探しにいくと、同じ組み合わせの行が
    // あるのに見つけられず create 側へ落ち、unique 違反でアーカイブ取り込みが
    // トランザクションごと巻き戻る。
    await tx.examSubtotalGroup.upsert({
      where: {
        examId_subtotalGroupId: {
          examId: newExamId,
          subtotalGroupId: newGroupId,
        },
      },
      create: {
        examId: newExamId,
        subtotalGroupId: newGroupId,
        selectedForTable: examSubtotalGroup.selectedForTable ?? false,
        selectedForBoxPlot: examSubtotalGroup.selectedForBoxPlot ?? false,
      },
      update: {},
    })
  }
}

export async function processExamStudents(
  data: ExtractedArchiveData,
  isExamIdMatch: boolean,
  newExamId: string,
  idMappings: IdMappings,
  tx: PrismaTransaction
): Promise<void> {
  for (const examStudent of data.examData.examStudents) {
    const newStudentId = idMappings.student[examStudent.studentId]
    if (newStudentId) {
      if (isExamIdMatch) {
        const existing = await tx.examStudent.findFirst({
          where: { examId: newExamId, studentId: newStudentId },
        })
        if (existing) {
          idMappings.examStudent[examStudent.id] = existing.id
          continue
        }
      }

      const existingById = await tx.examStudent.findUnique({
        where: { id: examStudent.id },
      })
      if (existingById) {
        idMappings.examStudent[examStudent.id] = examStudent.id
      } else {
        await tx.examStudent.create({
          data: {
            id: examStudent.id,
            examId: newExamId,
            studentId: newStudentId,
            status: examStudent.status,
            customOrder: examStudent.customOrder,
          },
        })
        idMappings.examStudent[examStudent.id] = examStudent.id
      }
    }
  }
}

export async function processExamPages(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: PrismaTransaction
): Promise<void> {
  for (const page of data.examData.examPages) {
    const existingById = await tx.examPage.findUnique({
      where: { id: page.id },
    })
    if (existingById) {
      idMappings.examPage[page.id] = page.id
      counts.unchanged.pages++
    } else {
      await tx.examPage.create({
        data: {
          id: page.id,
          examId: newExamId,
          pageNumber: page.pageNumber,
          imagePath: toImportedMasterImagePath(newExamId, page.imagePath),
          pageSize: page.pageSize,
        },
      })
      idMappings.examPage[page.id] = page.id
      counts.created.pages++
    }
  }
}

export async function processCropRegions(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: PrismaTransaction
): Promise<void> {
  for (const region of data.examData.cropRegions) {
    const newPageId = idMappings.examPage[region.examPageId]
    if (newPageId) {
      const existingById = await tx.cropRegion.findUnique({
        where: { id: region.id },
      })
      if (existingById) {
        idMappings.cropRegion[region.id] = region.id
        counts.unchanged.regions++
      } else {
        await tx.cropRegion.create({
          data: {
            id: region.id,
            examPageId: newPageId,
            label: region.label,
            type: region.type,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
            points: region.points,
            orderIndex: region.orderIndex,
          },
        })
        idMappings.cropRegion[region.id] = region.id
        counts.created.regions++
      }
    }
  }
}
