import { MasterImage, Prisma,ProjectPage } from "@prisma/client"
import fs from "fs/promises"
import path from "path"

import {
  getAbsolutePathFromData,
  getMasterAnswersDirectory,
  getRelativePathFromData,
} from "../dataManager"
import prisma from "./client"

export const uploadMasterAnswers = async (
  projectId: string,
  filesData: {
    name: string
    type: string
    buffer: ArrayBuffer
    path?: string
  }[]
): Promise<(MasterImage & { projectPage: ProjectPage })[]> => {
  // Check if project exists and get existing pages
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      projectPages: {
        include: {
          masterImages: true,
        },
        orderBy: { pageNumber: "asc" },
      },
    },
  })

  if (!project) {
    throw new Error("Project not found for master answer upload")
  }

  const highestPageNumber =
    project.projectPages?.reduce(
      (max: number, page: { pageNumber: number }) =>
        Math.max(max, page.pageNumber),
      0
    ) || 0

  const uploadedAnswers: (MasterImage & { projectPage: ProjectPage })[] = []

  const projectAnswerDir = getMasterAnswersDirectory(projectId)
  await fs.mkdir(projectAnswerDir, { recursive: true })

  for (const [index, fileData] of filesData.entries()) {
    try {
      const originalFileName = fileData.name
      const fileBuffer = Buffer.from(fileData.buffer)

      // Generate unique filename
      const uniqueFileName = `${Date.now()}-${index}-${originalFileName}`
      const destinationPath = path.join(projectAnswerDir, uniqueFileName)
      const relativePath = getRelativePathFromData(destinationPath)

      // Save file
      await fs.writeFile(destinationPath, fileBuffer)

      const pageNumber = highestPageNumber + 1 + index

      // Create ProjectPage first
      const projectPage = await prisma.projectPage.create({
        data: {
          projectId: projectId,
          pageNumber: pageNumber,
        },
      })

      // Then create MasterImage
      const newImage = await prisma.masterImage.create({
        data: {
          projectPageId: projectPage.id,
          imagePath: relativePath,
        },
        include: {
          projectPage: true,
        },
      })

      uploadedAnswers.push(newImage)
    } catch (error) {
      console.error(`Failed to upload or save answer ${fileData.name}:`, error)
    }
  }
  return uploadedAnswers
}

type ProjectPageWithMasterImages = Prisma.ProjectPageGetPayload<{
  include: {
    project: true
    masterImages: {
      orderBy: { createdAt: "asc" }
    }
    cropRegions: true
  }
}>

export interface DeleteMasterAnswerResult {
  deletedAnswer: MasterImage | null
  projectPages: ProjectPageWithMasterImages[]
}

export const deleteMasterAnswer = async (
  answerId: string
): Promise<DeleteMasterAnswerResult> => {
  try {
    const answer = await prisma.masterImage.findUnique({
      where: { id: answerId },
      include: { projectPage: true },
    })

    if (!answer) {
      console.warn(
        `No MasterImage found for master answer deletion (id: ${answerId}).`
      )
      return { deletedAnswer: null, projectPages: [] }
    }

    const projectId = answer.projectPage.projectId
    const filePath = getAbsolutePathFromData(answer.imagePath)
    let updatedPages: ProjectPageWithMasterImages[] = []

    await prisma.$transaction(async (tx) => {
      await tx.masterImage.delete({
        where: { id: answerId },
      })

      const remainingMasterImages = await tx.masterImage.count({
        where: { projectPageId: answer.projectPageId },
      })
      const remainingStudentImages = await tx.studentAnswerImage.count({
        where: { projectPageId: answer.projectPageId },
      })

      if (remainingMasterImages === 0 && remainingStudentImages === 0) {
        await tx.projectPage.delete({
          where: { id: answer.projectPageId },
        })
      }

      const pages = await tx.projectPage.findMany({
        where: { projectId },
        orderBy: { pageNumber: "asc" },
        include: {
          project: true,
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
          await tx.projectPage.update({
            where: { id: pages[index].id },
            data: { pageNumber: targetPageNumber },
          })
        }
      }

      if (resequenced) {
        updatedPages = await tx.projectPage.findMany({
          where: { projectId },
          orderBy: { pageNumber: "asc" },
          include: {
            project: true,
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

    return { deletedAnswer: answer, projectPages: updatedPages }
  } catch (error) {
    console.error(`Failed to delete master answer ${answerId}:`, error)
    throw error
  }
}

export const updateMasterAnswersOrder = async (
  answerOrders: { id: string; pageNumber: number }[]
): Promise<Prisma.BatchPayload> => {
  if (!answerOrders || answerOrders.length === 0) {
    return { count: 0 }
  }

  try {
    // Get the ProjectPages that correspond to these answers
    const answers = await prisma.masterImage.findMany({
      where: {
        id: { in: answerOrders.map((order) => order.id) },
      },
      include: { projectPage: true },
    })

    if (answers.length === 0) {
      throw new Error("No master answers found for reordering")
    }

    const projectId = answers[0].projectPage.projectId

    // Get current max page number in project
    const maxPageNumberInProject = await prisma.projectPage.aggregate({
      _max: { pageNumber: true },
      where: { projectId: projectId },
    })
    const offset =
      (maxPageNumberInProject._max.pageNumber || 0) + answerOrders.length + 100

    await prisma.$transaction(async (tx) => {
      // Create a map of answer ID to ProjectPage ID
      const answerToPageMap = new Map()
      answers.forEach((answer) => {
        answerToPageMap.set(answer.id, answer.projectPageId)
      })

      // 1. Update ProjectPages to temporary page numbers
      for (let i = 0; i < answerOrders.length; i++) {
        const answerId = answerOrders[i].id
        const projectPageId = answerToPageMap.get(answerId)
        if (projectPageId) {
          await tx.projectPage.update({
            where: { id: projectPageId },
            data: { pageNumber: offset + i },
          })
        }
      }

      // 2. Update to final page numbers
      for (const order of answerOrders) {
        const projectPageId = answerToPageMap.get(order.id)
        if (projectPageId) {
          await tx.projectPage.update({
            where: { id: projectPageId },
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

export const getMasterAnswersByProjectId = async (projectId: string) => {
  const projectPages = await prisma.projectPage.findMany({
    where: { projectId },
    include: {
      masterImages: true,
    },
    orderBy: { pageNumber: "asc" },
  })

  // Flatten to return individual answers with their page info
  const masterAnswers = []
  for (const page of projectPages) {
    for (const answer of page.masterImages) {
      masterAnswers.push({
        ...answer,
        pageNumber: page.pageNumber,
        projectId: page.projectId,
        // For compatibility with old API
        path: answer.imagePath,
      })
    }
  }

  return masterAnswers
}

export const createMasterAnswer = async (data: {
  projectId: string
  path: string
  pageNumber: number
}) => {
  // Create ProjectPage first
  const projectPage = await prisma.projectPage.create({
    data: {
      projectId: data.projectId,
      pageNumber: data.pageNumber,
    },
  })

  // Then create MasterImage
  return prisma.masterImage.create({
    data: {
      projectPageId: projectPage.id,
      imagePath: data.path,
    },
  })
}

export const createManyMasterAnswers = async (
  data: {
    projectId: string
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

export const updateMasterAnswer = async (
  id: string,
  data: { path?: string; pageNumber?: number }
) => {
  const answer = await prisma.masterImage.findUnique({
    where: { id },
    include: { projectPage: true },
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

  // Update ProjectPage if pageNumber is provided
  if (data.pageNumber) {
    await prisma.projectPage.update({
      where: { id: answer.projectPageId },
      data: { pageNumber: data.pageNumber },
    })
  }

  // Return updated data
  return prisma.masterImage.findUnique({
    where: { id },
    include: { projectPage: true },
  })
}

export const deleteMasterAnswersByProjectId = async (projectId: string) => {
  // Delete all master images for the project
  const deletedAnswers = await prisma.masterImage.deleteMany({
    where: {
      projectPage: { projectId },
    },
  })

  // Delete ProjectPages that have no remaining images
  const emptyPages = await prisma.projectPage.findMany({
    where: {
      projectId,
      masterImages: { none: {} },
      studentAnswerImages: { none: {} },
    },
  })

  if (emptyPages.length > 0) {
    await prisma.projectPage.deleteMany({
      where: {
        id: { in: emptyPages.map((page) => page.id) },
      },
    })
  }

  return deletedAnswers
}

export const getMasterAnswerByPage = async (
  projectId: string,
  pageNumber: number
) => {
  const projectPage = await prisma.projectPage.findFirst({
    where: { projectId, pageNumber },
    include: {
      masterImages: {
        take: 1,
      },
    },
  })

  if (projectPage?.masterImages?.[0]) {
    return {
      ...projectPage.masterImages[0],
      pageNumber: projectPage.pageNumber,
      projectId: projectPage.projectId,
      path: projectPage.masterImages[0].imagePath,
    }
  }

  return null
}

// For compatibility with existing code
export type MasterAnswerPayload = MasterImage & {
  pageNumber: number
  projectId: string
  path: string
}
