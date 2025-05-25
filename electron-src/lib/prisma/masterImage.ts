import { MasterImage, Prisma } from "@prisma/client"
import { app } from "electron"
import fs from "fs/promises"
import path from "path"
import prisma from "./client"

export const uploadMasterImages = async (
  projectId: string,
  filesData: {
    name: string
    type: string
    buffer: ArrayBuffer
    path?: string
  }[],
): Promise<MasterImage[]> => {
  // This function assumes that the MasterImage model in schema.prisma
  // is related to the Project model via a 'projectId' foreign key.
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { masterImages: true }, // Assumes Project model has 'masterImages' relation
  })

  if (!project) {
    throw new Error("Project not found for master image upload")
  }

  const highestPageNumber =
    project.masterImages?.reduce(
      // Assumes project.masterImages exists
      (max: number, img: { pageNumber: number }) =>
        Math.max(max, img.pageNumber),
      0,
    ) || 0

  const uploadedImages: MasterImage[] = []

  const projectImageDir = path.join(
    app.getPath("userData"),
    "masterImages",
    projectId,
  )
  await fs.mkdir(projectImageDir, { recursive: true })

  for (const [index, fileData] of filesData.entries()) {
    try {
      const originalFileName = fileData.name
      const fileBuffer = Buffer.from(fileData.buffer) // ArrayBufferをBufferに変換

      // ユニークなファイル名を生成 (タイムスタンプ + インデックス + 元のファイル名)
      const uniqueFileName = `${Date.now()}-${index}-${originalFileName}`
      const destinationPath = path.join(projectImageDir, uniqueFileName)
      const relativePath = path.relative(
        app.getPath("userData"),
        destinationPath,
      )

      // ファイルを保存
      await fs.writeFile(destinationPath, fileBuffer)

      const newImage = await prisma.masterImage.create({
        data: {
          // This assumes MasterImage model has a 'project' relation field
          // and connects to Project via 'projectId'.
          project: { connect: { id: projectId } },
          path: relativePath,
          pageNumber: highestPageNumber + 1 + index,
        },
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
): Promise<MasterImage | void> => {
  // This function assumes MasterImage can be deleted by its own 'id'.
  // If cascading delete from Project is set up in schema.prisma,
  // deleting a Project might automatically delete its MasterImages.
  try {
    const image = await prisma.masterImage.findUnique({
      where: { id: imageId },
    })
    if (image) {
      const userDataPath = app.getPath("userData")
      const filePath = path.join(userDataPath, image.path)
      try {
        await fs.unlink(filePath)
      } catch (fileError: any) {
        if (fileError.code !== "ENOENT") {
          console.warn(`Failed to delete image file ${filePath}:`, fileError)
        }
      }
      return await prisma.masterImage.delete({ where: { id: imageId } })
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
    // 更新対象の画像IDリストを取得
    const imageIdsToUpdate = imageOrders.map((order) => order.id)

    // 更新対象の画像が属するプロジェクトIDを取得 (最初の画像から取得すると仮定、全画像が同じプロジェクトであるべき)
    // より堅牢にするには、全画像が同じプロジェクトIDを持つことを検証する
    const firstImage = await prisma.masterImage.findUnique({
      where: { id: imageIdsToUpdate[0] },
      select: { projectId: true },
    })

    if (!firstImage) {
      throw new Error("Could not find project for images being reordered.")
    }
    const projectId = firstImage.projectId

    // 現在のプロジェクト内の最大のページ番号を取得
    const maxPageNumberInProject = await prisma.masterImage.aggregate({
      _max: { pageNumber: true },
      where: { projectId: projectId },
    })
    const offset =
      (maxPageNumberInProject._max.pageNumber || 0) + imageOrders.length + 100 // 十分大きなオフセット

    await prisma.$transaction(async (tx) => {
      // 1. 更新対象の画像のページ番号を一時的な重複しない値に変更
      for (let i = 0; i < imageOrders.length; i++) {
        const imageId = imageOrders[i].id // imageOrders はソートされている前提ではないので、IDで指定
        await tx.masterImage.update({
          where: { id: imageId },
          data: { pageNumber: offset + i }, // 各画像にユニークな一時的ページ番号を割り当て
        })
      }

      // 2. 新しい順序でページ番号を再割り当て
      for (const order of imageOrders) {
        await tx.masterImage.update({
          where: { id: order.id },
          data: { pageNumber: order.pageNumber },
        })
      }
    })

    return { count: imageOrders.length }
  } catch (error) {
    console.error("Failed to update master images order:", error)
    // エラーログに詳細情報を追加
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Prisma Error Code:", error.code)
      console.error("Prisma Error Meta:", error.meta)
    }
    throw error
  }
}

export const getMasterImagesByProjectId = async (projectId: string) => {
  return prisma.masterImage.findMany({
    where: { projectId }, // schema.prisma の MasterImage.projectId を参照
    orderBy: {
      pageNumber: "asc",
    },
  })
}

export const createMasterImage = async (
  // projectId, path, pageNumber を持つ想定
  data: Prisma.MasterImageUncheckedCreateInput,
) => {
  return prisma.masterImage.create({
    data,
  })
}

export const createManyMasterImages = async (
  // 各要素が projectId, path, pageNumber を持つ想定
  data: Prisma.MasterImageCreateManyInput[],
) => {
  return prisma.masterImage.createMany({
    data,
    // skipDuplicates は createMany の引数として有効な場合があるが、
    // Prismaのバージョンや設定による。エラーが出る場合は削除も検討。
    // skipDuplicates: true,
  })
}

export const updateMasterImage = async (
  id: string,
  data: Prisma.MasterImageUpdateInput,
) => {
  return prisma.masterImage.update({
    where: { id },
    data,
  })
}

export const deleteMasterImagesByProjectId = async (projectId: string) => {
  return prisma.masterImage.deleteMany({
    where: { projectId }, // schema.prisma の MasterImage.projectId を参照
  })
}

// 特定のプロジェクトの特定のページ番号のMasterImageを取得する関数 (例)
export const getMasterImageByPage = async (
  projectId: string,
  pageNumber: number,
) => {
  return prisma.masterImage.findUnique({
    where: {
      // schema.prisma で @@unique([projectId, pageNumber]) が定義されている想定
      projectId_pageNumber: {
        projectId,
        pageNumber,
      },
    },
  })
}

export type MasterImagePayload = MasterImage
// 他のMasterImage関連関数 (fetchなど) があればここに記述
