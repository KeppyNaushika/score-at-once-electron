/**
 * ID統合インポート: 試験骨格（Exam根・ExamPage・CropRegion・参加情報）の処理
 *
 * 試験ID一致時は既存の試験にマージ（ExamPage/CropRegionはID一致でマッピング）、
 * 不一致時は新規作成する。UserExam/ExamSubtotalGroup/ExamStudentの参加情報も扱う。
 */

import * as crypto from "crypto"

import type { FileOverviewData } from "../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { IdMappings, ImportCounts, PrismaTransaction } from "./types"

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
  const existingPageIds = new Set(existingExamPages.map((page) => page.id))

  for (const page of data.examData.examPages) {
    if (existingPageIds.has(page.id)) {
      idMappings.examPage[page.id] = page.id
      counts.unchanged.pages++
    } else {
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
    if (newGroupId) {
      const existing = await tx.examSubtotalGroup.findFirst({
        where: { examId: newExamId, subtotalGroupId: newGroupId },
      })
      if (existing) {
        idMappings.examSubtotalGroup[examSubtotalGroup.id] = existing.id
      } else {
        const existingById = await tx.examSubtotalGroup.findUnique({
          where: { id: examSubtotalGroup.id },
        })
        if (existingById) {
          idMappings.examSubtotalGroup[examSubtotalGroup.id] =
            examSubtotalGroup.id
        } else {
          await tx.examSubtotalGroup.create({
            data: {
              id: examSubtotalGroup.id,
              examId: newExamId,
              subtotalGroupId: newGroupId,
              selectedForTable: examSubtotalGroup.selectedForTable ?? false,
              selectedForBoxPlot: examSubtotalGroup.selectedForBoxPlot ?? false,
            },
          })
          idMappings.examSubtotalGroup[examSubtotalGroup.id] =
            examSubtotalGroup.id
        }
      }
    }
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
