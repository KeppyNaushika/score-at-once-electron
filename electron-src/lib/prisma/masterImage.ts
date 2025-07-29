import { ProjectPage, PageImage, Prisma } from "@prisma/client"
import fs from "fs/promises"
import path from "path"
import {
  getAbsolutePathFromData,
  getMasterImagesDirectory,
  getRelativePathFromData,
} from "../dataManager"
import prisma from "./client"

export const uploadMasterImages = async (
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
            where: { imageType: "MASTER" } 
          } 
        },
        orderBy: { pageNumber: "asc" }
      } 
    },
  })

  if (!project) {
    throw new Error("Project not found for master image upload")
  }

  const highestPageNumber =
    project.projectPages?.reduce(
      (max: number, page: { pageNumber: number }) =>
        Math.max(max, page.pageNumber),
      0,
    ) || 0

  const uploadedImages: (PageImage & { projectPage: ProjectPage })[] = []

  const projectImageDir = getMasterImagesDirectory(projectId)
  await fs.mkdir(projectImageDir, { recursive: true })

  for (const [index, fileData] of filesData.entries()) {
    try {
      const originalFileName = fileData.name
      const fileBuffer = Buffer.from(fileData.buffer)

      // Generate unique filename
      const uniqueFileName = `${Date.now()}-${index}-${originalFileName}`
      const destinationPath = path.join(projectImageDir, uniqueFileName)
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
          imageType: "MASTER",
          studentId: null, // Master images don't have students
        },
        include: {
          projectPage: true,
        }
      })

      uploadedImages.push(newImage)
    } catch (error) {
      console.error(`Failed to upload or save image ${fileData.name}:`, error)
    }
  }
  return uploadedImages
}

export const deleteMasterImage = async (
  imageId: string,
): Promise<PageImage | void> => {
  try {
    const image = await prisma.pageImage.findUnique({
      where: { id: imageId },
      include: { projectPage: true }
    })
    
    if (image && image.imageType === "MASTER") {
      const filePath = getAbsolutePathFromData(image.imagePath)
      
      try {
        await fs.unlink(filePath)
      } catch (fileError: any) {
        if (fileError.code !== "ENOENT") {
          console.warn(`Failed to delete image file ${filePath}:`, fileError)
        }
      }

      // Delete the PageImage
      const deletedImage = await prisma.pageImage.delete({ 
        where: { id: imageId } 
      })

      // Check if this was the only image for this ProjectPage
      const remainingImages = await prisma.pageImage.count({
        where: { projectPageId: image.projectPageId }
      })

      // If no images remain, delete the ProjectPage
      if (remainingImages === 0) {
        await prisma.projectPage.delete({
          where: { id: image.projectPageId }
        })
      }

      return deletedImage
    }
  } catch (error) {
    console.error(`Failed to delete master image ${imageId}:`, error)
    throw error
  }
}

export const updateMasterImagesOrder = async (
  imageOrders: { id: string; pageNumber: number }[],
): Promise<Prisma.BatchPayload> => {
  if (!imageOrders || imageOrders.length === 0) {
    return { count: 0 }
  }

  try {
    // Get the ProjectPages that correspond to these images
    const images = await prisma.pageImage.findMany({
      where: { 
        id: { in: imageOrders.map(order => order.id) },
        imageType: "MASTER"
      },
      include: { projectPage: true }
    })

    if (images.length === 0) {
      throw new Error("No master images found for reordering")
    }

    const projectId = images[0].projectPage.projectId

    // Get current max page number in project
    const maxPageNumberInProject = await prisma.projectPage.aggregate({
      _max: { pageNumber: true },
      where: { projectId: projectId },
    })
    const offset = (maxPageNumberInProject._max.pageNumber || 0) + imageOrders.length + 100

    await prisma.$transaction(async (tx) => {
      // Create a map of image ID to ProjectPage ID
      const imageToPageMap = new Map()
      images.forEach(image => {
        imageToPageMap.set(image.id, image.projectPageId)
      })

      // 1. Update ProjectPages to temporary page numbers
      for (let i = 0; i < imageOrders.length; i++) {
        const imageId = imageOrders[i].id
        const projectPageId = imageToPageMap.get(imageId)
        if (projectPageId) {
          await tx.projectPage.update({
            where: { id: projectPageId },
            data: { pageNumber: offset + i },
          })
        }
      }

      // 2. Update to final page numbers
      for (const order of imageOrders) {
        const projectPageId = imageToPageMap.get(order.id)
        if (projectPageId) {
          await tx.projectPage.update({
            where: { id: projectPageId },
            data: { pageNumber: order.pageNumber },
          })
        }
      }
    })

    return { count: imageOrders.length }
  } catch (error) {
    console.error("Failed to update master images order:", error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Prisma Error Code:", error.code)
      console.error("Prisma Error Meta:", error.meta)
    }
    throw error
  }
}

export const getMasterImagesByProjectId = async (projectId: string) => {
  const projectPages = await prisma.projectPage.findMany({
    where: { projectId },
    include: {
      pageImages: {
        where: { imageType: "MASTER" }
      }
    },
    orderBy: { pageNumber: "asc" },
  })

  // Flatten to return individual images with their page info
  const masterImages = []
  for (const page of projectPages) {
    for (const image of page.pageImages) {
      masterImages.push({
        ...image,
        pageNumber: page.pageNumber,
        projectId: page.projectId,
        // For compatibility with old API
        path: image.imagePath,
      })
    }
  }

  return masterImages
}

export const createMasterImage = async (
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
      imageType: "MASTER",
      studentId: null,
    },
  })
}

export const createManyMasterImages = async (
  data: {
    projectId: string
    path: string
    pageNumber: number
  }[],
) => {
  const createdImages = []
  
  for (const imageData of data) {
    const result = await createMasterImage(imageData)
    createdImages.push(result)
  }
  
  return { count: createdImages.length }
}

export const updateMasterImage = async (
  id: string,
  data: { path?: string; pageNumber?: number },
) => {
  const image = await prisma.pageImage.findUnique({
    where: { id },
    include: { projectPage: true }
  })

  if (!image || image.imageType !== "MASTER") {
    throw new Error("Master image not found")
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
      where: { id: image.projectPageId },
      data: { pageNumber: data.pageNumber }
    })
  }

  // Return updated data
  return prisma.pageImage.findUnique({
    where: { id },
    include: { projectPage: true }
  })
}

export const deleteMasterImagesByProjectId = async (projectId: string) => {
  // Delete all master images for the project
  const deletedImages = await prisma.pageImage.deleteMany({
    where: { 
      imageType: "MASTER",
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

  return deletedImages
}

export const getMasterImageByPage = async (
  projectId: string,
  pageNumber: number,
) => {
  const projectPage = await prisma.projectPage.findFirst({
    where: { projectId, pageNumber },
    include: {
      pageImages: {
        where: { imageType: "MASTER" },
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
export type MasterImagePayload = PageImage & {
  pageNumber: number
  projectId: string
  path: string
}