import { ExamPage, MasterImage, Prisma } from "@prisma/client"
import fs from "fs/promises"
import path from "path"

import {
  getAbsolutePathFromData,
  getMasterAnswersDirectory,
  getRelativePathFromData,
} from "../dataManager"
import prisma from "./client"

/** 模範解答画像をアップロードし、ExamPageとMasterImageを作成する（examPage含む） */
export const uploadMasterAnswers = async (
  examId: string,
  filesData: {
    name: string
    type: string
    buffer: ArrayBuffer
    path?: string
  }[]
): Promise<(MasterImage & { examPage: ExamPage })[]> => {
  // Check if exam exists and get existing pages
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      examPages: {
        include: {
          masterImages: true,
        },
        orderBy: { pageNumber: "asc" },
      },
    },
  })

  if (!exam) {
    throw new Error("Exam not found for master answer upload")
  }

  const highestPageNumber =
    exam.examPages?.reduce(
      (max: number, page: { pageNumber: number }) =>
        Math.max(max, page.pageNumber),
      0
    ) || 0

  const uploadedAnswers: (MasterImage & { examPage: ExamPage })[] = []

  const examAnswerDir = getMasterAnswersDirectory(examId)
  await fs.mkdir(examAnswerDir, { recursive: true })

  for (const [index, fileData] of filesData.entries()) {
    try {
      const originalFileName = fileData.name
      const fileBuffer = Buffer.from(fileData.buffer)

      // Generate unique filename
      const uniqueFileName = `${Date.now()}-${index}-${originalFileName}`
      const destinationPath = path.join(examAnswerDir, uniqueFileName)
      const relativePath = getRelativePathFromData(destinationPath)

      // Save file
      await fs.writeFile(destinationPath, fileBuffer)

      const pageNumber = highestPageNumber + 1 + index

      // Create ExamPage first
      const examPage = await prisma.examPage.create({
        data: {
          examId: examId,
          pageNumber: pageNumber,
        },
      })

      // Then create MasterImage
      const newImage = await prisma.masterImage.create({
        data: {
          examPageId: examPage.id,
          imagePath: relativePath,
        },
        include: {
          examPage: true,
        },
      })

      uploadedAnswers.push(newImage)
    } catch (error) {
      console.error(`Failed to upload or save answer ${fileData.name}:`, error)
    }
  }
  return uploadedAnswers
}

type ExamPageWithMasterImages = Prisma.ExamPageGetPayload<{
  include: {
    exam: true
    masterImages: {
      orderBy: { createdAt: "asc" }
    }
    cropRegions: true
  }
}>

export interface DeleteMasterAnswerResult {
  deletedAnswer: MasterImage | null
  examPages: ExamPageWithMasterImages[]
}

/** 模範解答画像を削除し、空のExamPageも削除する。ページ番号の再連番も行う */
export const deleteMasterAnswer = async (
  answerId: string
): Promise<DeleteMasterAnswerResult> => {
  try {
    const answer = await prisma.masterImage.findUnique({
      where: { id: answerId },
      include: { examPage: true },
    })

    if (!answer) {
      console.warn(
        `No MasterImage found for master answer deletion (id: ${answerId}).`
      )
      return { deletedAnswer: null, examPages: [] }
    }

    const examId = answer.examPage.examId
    const filePath = getAbsolutePathFromData(answer.imagePath)
    let updatedPages: ExamPageWithMasterImages[] = []

    await prisma.$transaction(async (tx) => {
      await tx.masterImage.delete({
        where: { id: answerId },
      })

      const remainingMasterImages = await tx.masterImage.count({
        where: { examPageId: answer.examPageId },
      })
      const remainingStudentImages = await tx.studentAnswerImage.count({
        where: { examPageId: answer.examPageId },
      })

      if (remainingMasterImages === 0 && remainingStudentImages === 0) {
        await tx.examPage.delete({
          where: { id: answer.examPageId },
        })
      }

      const pages = await tx.examPage.findMany({
        where: { examId },
        orderBy: { pageNumber: "asc" },
        include: {
          exam: true,
          cropRegions: true,
          masterImages: {
            orderBy: { createdAt: "asc" },
          },
        },
      })

      let resequenced = false
      for (let index = 0; index < pages.length; index++) {
        const targetPageNumber = index + 1
        if (pages[index].pageNumber !== targetPageNumber) {
          resequenced = true
          await tx.examPage.update({
            where: { id: pages[index].id },
            data: { pageNumber: targetPageNumber },
          })
        }
      }

      if (resequenced) {
        updatedPages = await tx.examPage.findMany({
          where: { examId },
          orderBy: { pageNumber: "asc" },
          include: {
            exam: true,
            cropRegions: true,
            masterImages: {
              orderBy: { createdAt: "asc" },
            },
          },
        })
      } else {
        updatedPages = pages
      }
    })

    try {
      await fs.unlink(filePath)
    } catch (fileError: unknown) {
      if (
        fileError &&
        typeof fileError === "object" &&
        "code" in fileError &&
        fileError.code !== "ENOENT"
      ) {
        console.warn(`Failed to delete answer file ${filePath}:`, fileError)
      }
    }

    return { deletedAnswer: answer, examPages: updatedPages }
  } catch (error) {
    console.error(`Failed to delete master answer ${answerId}:`, error)
    throw error
  }
}

/** 模範解答のページ順序を一括更新する（一時番号経由でユニーク制約を回避） */
export const updateMasterAnswersOrder = async (
  answerOrders: { id: string; pageNumber: number }[]
): Promise<Prisma.BatchPayload> => {
  if (!answerOrders || answerOrders.length === 0) {
    return { count: 0 }
  }

  try {
    // Get the ExamPages that correspond to these answers
    const answers = await prisma.masterImage.findMany({
      where: {
        id: { in: answerOrders.map((order) => order.id) },
      },
      include: { examPage: true },
    })

    if (answers.length === 0) {
      throw new Error("No master answers found for reordering")
    }

    const examId = answers[0].examPage.examId

    // Get current max page number in exam
    const maxPageNumberInExam = await prisma.examPage.aggregate({
      _max: { pageNumber: true },
      where: { examId: examId },
    })
    const offset =
      (maxPageNumberInExam._max.pageNumber || 0) + answerOrders.length + 100

    await prisma.$transaction(async (tx) => {
      // Create a map of answer ID to ExamPage ID
      const answerToPageMap = new Map()
      answers.forEach((answer) => {
        answerToPageMap.set(answer.id, answer.examPageId)
      })

      // 1. Update ExamPages to temporary page numbers
      for (let i = 0; i < answerOrders.length; i++) {
        const answerId = answerOrders[i].id
        const examPageId = answerToPageMap.get(answerId)
        if (examPageId) {
          await tx.examPage.update({
            where: { id: examPageId },
            data: { pageNumber: offset + i },
          })
        }
      }

      // 2. Update to final page numbers
      for (const order of answerOrders) {
        const examPageId = answerToPageMap.get(order.id)
        if (examPageId) {
          await tx.examPage.update({
            where: { id: examPageId },
            data: { pageNumber: order.pageNumber },
          })
        }
      }
    })

    return { count: answerOrders.length }
  } catch (error) {
    console.error("Failed to update master answers order:", error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Prisma Error Code:", error.code)
      console.error("Prisma Error Meta:", error.meta)
    }
    throw error
  }
}

/** 試験IDで模範解答一覧を取得する（masterImages含む、ページ番号順） */
export const getMasterAnswersByExamId = async (examId: string) => {
  const examPages = await prisma.examPage.findMany({
    where: { examId },
    include: {
      masterImages: true,
    },
    orderBy: { pageNumber: "asc" },
  })

  // Flatten to return individual answers with their page info
  const masterAnswers = []
  for (const page of examPages) {
    for (const answer of page.masterImages) {
      masterAnswers.push({
        ...answer,
        pageNumber: page.pageNumber,
        examId: page.examId,
        // For compatibility with old API
        path: answer.imagePath,
      })
    }
  }

  return masterAnswers
}

/** ExamPageと模範解答画像を1件作成する */
export const createMasterAnswer = async (data: {
  examId: string
  path: string
  pageNumber: number
}) => {
  // Create ExamPage first
  const examPage = await prisma.examPage.create({
    data: {
      examId: data.examId,
      pageNumber: data.pageNumber,
    },
  })

  // Then create MasterImage
  return prisma.masterImage.create({
    data: {
      examPageId: examPage.id,
      imagePath: data.path,
    },
  })
}

/** 複数の模範解答画像を一括作成する */
export const createManyMasterAnswers = async (
  data: {
    examId: string
    path: string
    pageNumber: number
  }[]
) => {
  const createdAnswers = []

  for (const answerData of data) {
    const result = await createMasterAnswer(answerData)
    createdAnswers.push(result)
  }

  return { count: createdAnswers.length }
}

/** 模範解答の画像パスまたはページ番号を更新する */
export const updateMasterAnswer = async (
  id: string,
  data: { path?: string; pageNumber?: number }
) => {
  const answer = await prisma.masterImage.findUnique({
    where: { id },
    include: { examPage: true },
  })

  if (!answer) {
    throw new Error("Master answer not found")
  }

  // Update MasterImage if path is provided
  if (data.path) {
    await prisma.masterImage.update({
      where: { id },
      data: { imagePath: data.path },
    })
  }

  // Update ExamPage if pageNumber is provided
  if (data.pageNumber) {
    await prisma.examPage.update({
      where: { id: answer.examPageId },
      data: { pageNumber: data.pageNumber },
    })
  }

  // Return updated data
  return prisma.masterImage.findUnique({
    where: { id },
    include: { examPage: true },
  })
}

/** 試験に属する全模範解答画像を削除し、空のExamPageも削除する */
export const deleteMasterAnswersByExamId = async (examId: string) => {
  // Delete all master images for the exam
  const deletedAnswers = await prisma.masterImage.deleteMany({
    where: {
      examPage: { examId },
    },
  })

  // Delete ExamPages that have no remaining images
  const emptyPages = await prisma.examPage.findMany({
    where: {
      examId,
      masterImages: { none: {} },
      studentAnswerImages: { none: {} },
    },
  })

  if (emptyPages.length > 0) {
    await prisma.examPage.deleteMany({
      where: {
        id: { in: emptyPages.map((page) => page.id) },
      },
    })
  }

  return deletedAnswers
}

/** 試験IDとページ番号で模範解答画像を1件取得する */
export const getMasterAnswerByPage = async (
  examId: string,
  pageNumber: number
) => {
  const examPage = await prisma.examPage.findFirst({
    where: { examId, pageNumber },
    include: {
      masterImages: {
        take: 1,
      },
    },
  })

  if (examPage?.masterImages?.[0]) {
    return {
      ...examPage.masterImages[0],
      pageNumber: examPage.pageNumber,
      examId: examPage.examId,
      path: examPage.masterImages[0].imagePath,
    }
  }

  return null
}

/** 模範解答画像のページサイズ情報を更新する（examPage含む） */
export const updateMasterImagePageSize = async (
  id: string,
  pageSize: string
) => {
  return prisma.masterImage.update({
    where: { id },
    data: { pageSize },
    include: { examPage: true },
  })
}

export type ExamPageWithDetails = MasterImage & {
  pageNumber: number
  examId: string
  path: string
}
