import { ProjectPage, PageImage, Prisma } from "@prisma/client"
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
  }[],
): Promise<(PageImage & { projectPage: ProjectPage })[]> => {
  // Check if project exists and get existing pages
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { 
      projectPages: { 
        include: { 
          pageImages: { 
            where: { imageType: "MODEL_ANSWER" } 
          } 
        },
        orderBy: { pageNumber: "asc" }
      } 
    },
  })

  if (!project) {
    throw new Error("Project not found for master answer upload")
  }

  const highestPageNumber =
    project.projectPages?.reduce(
      (max: number, page: { pageNumber: number }) =>
        Math.max(max, page.pageNumber),
      0,
    ) || 0

  const uploadedAnswers: (PageImage & { projectPage: ProjectPage })[] = []

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

      // Then create PageImage
      const newImage = await prisma.pageImage.create({
        data: {
          projectPageId: projectPage.id,
          imagePath: relativePath,
          imageType: "MODEL_ANSWER",
          studentId: null, // Master answers don't have students
        },
        include: {
          projectPage: true,
        }
      })

      uploadedAnswers.push(newImage)
    } catch (error) {
      console.error(`Failed to upload or save answer ${fileData.name}:`, error)
    }
  }
  return uploadedAnswers
}

export const deleteMasterAnswer = async (
  answerId: string,
): Promise<PageImage | void> => {
  try {
    const answer = await prisma.pageImage.findUnique({
      where: { id: answerId },
      include: { projectPage: true }
    })
    
    if (answer && answer.imageType === "MODEL_ANSWER") {
      const filePath = getAbsolutePathFromData(answer.imagePath)
      
      try {
        await fs.unlink(filePath)
      } catch (fileError: any) {
        if (fileError.code !== "ENOENT") {
          console.warn(`Failed to delete answer file ${filePath}:`, fileError)
        }
      }

      // Delete the PageImage
      const deletedAnswer = await prisma.pageImage.delete({ 
        where: { id: answerId } 
      })

      // Check if this was the only answer for this ProjectPage
      const remainingAnswers = await prisma.pageImage.count({
        where: { projectPageId: answer.projectPageId }
      })

      // If no answers remain, delete the ProjectPage
      if (remainingAnswers === 0) {
        await prisma.projectPage.delete({
          where: { id: answer.projectPageId }
        })
      }

      return deletedAnswer
    }
  } catch (error) {
    console.error(`Failed to delete master answer ${answerId}:`, error)
    throw error
  }
}

export const updateMasterAnswersOrder = async (
  answerOrders: { id: string; pageNumber: number }[],
): Promise<Prisma.BatchPayload> => {
  if (!answerOrders || answerOrders.length === 0) {
    return { count: 0 }
  }

  try {
    // Get the ProjectPages that correspond to these answers
    const answers = await prisma.pageImage.findMany({
      where: { 
        id: { in: answerOrders.map(order => order.id) },
        imageType: "MODEL_ANSWER"
      },
      include: { projectPage: true }
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
    const offset = (maxPageNumberInProject._max.pageNumber || 0) + answerOrders.length + 100

    await prisma.$transaction(async (tx) => {
      // Create a map of answer ID to ProjectPage ID
      const answerToPageMap = new Map()
      answers.forEach(answer => {
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
      pageImages: {
        where: { imageType: "MODEL_ANSWER" }
      }
    },
    orderBy: { pageNumber: "asc" },
  })

  // Flatten to return individual answers with their page info
  const masterAnswers = []
  for (const page of projectPages) {
    for (const answer of page.pageImages) {
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

export const createMasterAnswer = async (
  data: {
    projectId: string
    path: string
    pageNumber: number
  },
) => {
  // Create ProjectPage first
  const projectPage = await prisma.projectPage.create({
    data: {
      projectId: data.projectId,
      pageNumber: data.pageNumber,
    },
  })

  // Then create PageImage
  return prisma.pageImage.create({
    data: {
      projectPageId: projectPage.id,
      imagePath: data.path,
      imageType: "MODEL_ANSWER",
      studentId: null,
    },
  })
}

export const createManyMasterAnswers = async (
  data: {
    projectId: string
    path: string
    pageNumber: number
  }[],
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
  data: { path?: string; pageNumber?: number },
) => {
  const answer = await prisma.pageImage.findUnique({
    where: { id },
    include: { projectPage: true }
  })

  if (!answer || answer.imageType !== "MODEL_ANSWER") {
    throw new Error("Master answer not found")
  }

  // Update PageImage if path is provided
  if (data.path) {
    await prisma.pageImage.update({
      where: { id },
      data: { imagePath: data.path }
    })
  }

  // Update ProjectPage if pageNumber is provided
  if (data.pageNumber) {
    await prisma.projectPage.update({
      where: { id: answer.projectPageId },
      data: { pageNumber: data.pageNumber }
    })
  }

  // Return updated data
  return prisma.pageImage.findUnique({
    where: { id },
    include: { projectPage: true }
  })
}

export const deleteMasterAnswersByProjectId = async (projectId: string) => {
  // Delete all master answers for the project
  const deletedAnswers = await prisma.pageImage.deleteMany({
    where: { 
      imageType: "MODEL_ANSWER",
      projectPage: { projectId }
    },
  })

  // Delete ProjectPages that have no remaining images
  const emptyPages = await prisma.projectPage.findMany({
    where: { 
      projectId,
      pageImages: { none: {} }
    }
  })

  if (emptyPages.length > 0) {
    await prisma.projectPage.deleteMany({
      where: { 
        id: { in: emptyPages.map(page => page.id) }
      }
    })
  }

  return deletedAnswers
}

export const getMasterAnswerByPage = async (
  projectId: string,
  pageNumber: number,
) => {
  const projectPage = await prisma.projectPage.findFirst({
    where: { projectId, pageNumber },
    include: {
      pageImages: {
        where: { imageType: "MODEL_ANSWER" },
        take: 1
      }
    }
  })

  if (projectPage?.pageImages?.[0]) {
    return {
      ...projectPage.pageImages[0],
      pageNumber: projectPage.pageNumber,
      projectId: projectPage.projectId,
      path: projectPage.pageImages[0].imagePath,
    }
  }

  return null
}

// For compatibility with existing code
export type MasterAnswerPayload = PageImage & {
  pageNumber: number
  projectId: string
  path: string
}