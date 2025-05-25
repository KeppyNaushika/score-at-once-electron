import { Prisma, Project, ProjectLayout } from "@prisma/client"
import type {
  CreateProjectArgs,
  ProjectLayoutWithDetails as GlobalProjectLayoutWithDetails,
  SaveProjectLayoutInput as GlobalSaveProjectLayoutInput,
  UpdateProjectArgs,
} from "../../../types/electron"
import prisma from "./client"

export type ProjectWithDetails = Prisma.ProjectGetPayload<{
  include: {
    user: true
    tags: true
    masterImages: true
    layout: { include: { areas: true } }
  }
}>

export type CreateProjectProps = CreateProjectArgs

export const fetchProjects = async (): Promise<ProjectWithDetails[]> => {
  try {
    return await prisma.project.findMany({
      include: {
        user: true,
        tags: true,
        masterImages: true,
        layout: { include: { areas: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  } catch (error) {
    console.error("Failed to fetch projects:", error)
    throw error
  }
}

export const fetchProjectById = async (
  projectId: string,
): Promise<ProjectWithDetails | null> => {
  try {
    return await prisma.project.findUnique({
      where: { projectId: projectId },
      include: {
        user: true,
        tags: true,
        masterImages: {
          orderBy: {
            pageNumber: "asc",
          },
        },
        layout: { include: { areas: true } },
      },
    })
  } catch (error) {
    console.error(`Failed to fetch project by ID ${projectId}:`, error)
    throw error
  }
}

export const createProject = async (
  projectData: CreateProjectProps,
): Promise<ProjectWithDetails> => {
  const { tagIdsOrTexts, userId, examName, description, examDate } = projectData
  try {
    return await prisma.project.create({
      data: {
        examName,
        description,
        examDate,
        ...(userId ? { user: { connect: { id: userId } } } : {}),
        ...(tagIdsOrTexts && tagIdsOrTexts.length > 0
          ? {
              tags: {
                connectOrCreate: tagIdsOrTexts.map(
                  (tag: string | { id?: string; text: string }) => ({
                    where: { text: typeof tag === "string" ? tag : tag.text },
                    create: { text: typeof tag === "string" ? tag : tag.text },
                  }),
                ),
              },
            }
          : {}),
      },
      include: {
        user: true,
        tags: true,
        masterImages: true,
        layout: { include: { areas: true } },
      },
    })
  } catch (error) {
    console.error("Failed to create project:", error)
    throw error
  }
}

export const updateProject = async (
  projectData: UpdateProjectArgs & { projectId: string },
): Promise<ProjectWithDetails> => {
  const { projectId, tagIdsOrTexts, userId, examName, description, examDate } =
    projectData
  const updatePayload: Prisma.ProjectUpdateInput = {
    examName,
    description,
    examDate,
  }

  if (userId !== undefined) {
    updatePayload.user = userId
      ? { connect: { id: userId } }
      : { disconnect: true }
  }

  if (tagIdsOrTexts) {
    updatePayload.tags = {
      set: [],
      connectOrCreate: tagIdsOrTexts.map(
        (tag: string | { id?: string; text: string }) => ({
          where: { text: typeof tag === "string" ? tag : tag.text },
          create: { text: typeof tag === "string" ? tag : tag.text },
        }),
      ),
    }
  }

  try {
    return await prisma.project.update({
      where: { projectId: projectId },
      data: updatePayload,
      include: {
        user: true,
        tags: true,
        masterImages: true,
        layout: { include: { areas: true } },
      },
    })
  } catch (error) {
    console.error(`Failed to update project ${projectId}:`, error)
    throw error
  }
}

export const deleteProject = async (
  projectId: string,
): Promise<Project | void> => {
  try {
    // ProjectLayout は projectId が unique なので、それで検索して削除
    // onDelete: Cascade が ProjectLayout -> LayoutRegion に設定されていれば、LayoutRegion も自動削除
    // onDelete: Cascade が Project -> ProjectLayout に設定されていれば、ProjectLayout も自動削除
    // スキーマで Project -> ProjectLayout に onDelete: Cascade を設定したので、ProjectLayout は自動で削除される
    // MasterImage も Project -> MasterImage に onDelete: Cascade を設定したので自動削除
    // await prisma.masterImage.deleteMany({ where: { projectId: projectId } }) // 自動削除されるはず
    // const projectLayout = await prisma.projectLayout.findUnique({ where: { projectId }})
    // if (projectLayout) {
    //   await prisma.layoutRegion.deleteMany({ where: { projectLayoutId: projectLayout.id }})
    //   await prisma.projectLayout.delete({ where: { id: projectLayout.id }})
    // }
    return await prisma.project.delete({ where: { projectId: projectId } })
  } catch (error) {
    console.error(`Failed to delete project ${projectId}:`, error)
    throw error
  }
}

export type SaveProjectLayoutInput = GlobalSaveProjectLayoutInput

export const saveProjectLayout = async (
  layoutData: SaveProjectLayoutInput,
): Promise<GlobalProjectLayoutWithDetails> => {
  const { id: layoutId, projectId, createdById, areas: inputAreas } = layoutData

  const existingLayout = await prisma.projectLayout.findUnique({
    where: { projectId },
  })

  if (layoutId && existingLayout && layoutId !== existingLayout.id) {
    throw new Error(
      `Layout ID ${layoutId} does not match the layout associated with project ${projectId}.`,
    )
  }

  const projectLayoutIdToUse = layoutId || existingLayout?.id

  if (projectLayoutIdToUse) {
    return prisma.$transaction(async (tx) => {
      await tx.projectLayout.update({
        where: { id: projectLayoutIdToUse },
        data: {
          project: { connect: { projectId } },
          createdBy: { connect: { id: createdById } },
        },
      })

      if (inputAreas) {
        const existingDbRegions = await tx.layoutRegion.findMany({
          where: { projectLayoutId: projectLayoutIdToUse },
          select: { id: true, masterImageId: true },
        })
        const existingDbRegionIds = new Set(existingDbRegions.map((a) => a.id))

        const inputRegionIdsWithMasterImageId = new Map(
          inputAreas.filter((a) => a.id).map((a) => [a.id!, a.masterImageId]),
        )

        const regionsToDelete = existingDbRegions
          .filter(
            (dbRegion) => !inputRegionIdsWithMasterImageId.has(dbRegion.id),
          )
          .map((region) => region.id)

        if (regionsToDelete.length > 0) {
          await tx.layoutRegion.deleteMany({
            where: { id: { in: regionsToDelete } },
          })
        }

        for (const region of inputAreas) {
          const {
            id: regionId,
            masterImageId: regionMasterImageId, // 必須
            ...regionData
          } = region

          if (!regionMasterImageId) {
            throw new Error(
              `masterImageId is required for layout region: ${region.label || "Unnamed"}`,
            )
          }

          const dataPayload:
            | Prisma.LayoutRegionUpdateInput
            | Prisma.LayoutRegionCreateInput = {
            ...regionData,
            masterImage: { connect: { id: regionMasterImageId } },
            projectLayout: { connect: { id: projectLayoutIdToUse } },
          }

          if (regionId && existingDbRegionIds.has(regionId)) {
            await tx.layoutRegion.update({
              where: { id: regionId },
              data: dataPayload as Prisma.LayoutRegionUpdateInput,
            })
          } else {
            await tx.layoutRegion.create({
              data: dataPayload as Prisma.LayoutRegionCreateInput,
            })
          }
        }
      } else {
        await tx.layoutRegion.deleteMany({
          where: { projectLayoutId: projectLayoutIdToUse },
        })
      }

      return tx.projectLayout.findUniqueOrThrow({
        where: { id: projectLayoutIdToUse },
        include: { project: true, createdBy: true, areas: true },
      })
    })
  } else {
    // 新規作成
    if (!createdById) {
      throw new Error("createdById is required for new layout.")
    }
    return prisma.projectLayout.create({
      data: {
        project: { connect: { projectId } },
        createdBy: { connect: { id: createdById } },
        areas: inputAreas
          ? {
              create: inputAreas.map((area) => {
                // projectLayoutId と masterImage (リレーションオブジェクト) は area に含まれない
                // SaveLayoutRegionInput は id?, masterImageId, 及び LayoutRegionCreateWithoutProjectLayoutInput のフィールドを持つ
                const { id, ...rest } = area // projectLayoutId と masterImage を削除
                if (!area.masterImageId) {
                  throw new Error(
                    `masterImageId is required for new layout region: ${area.label || "Unnamed"}`,
                  )
                }
                return {
                  ...rest, // rest には masterImageId が含まれる
                  masterImage: { connect: { id: area.masterImageId } },
                  // projectLayout は外側の create で接続される
                }
              }),
            }
          : undefined,
      },
      include: { project: true, createdBy: true, areas: true },
    })
  }
}

export const fetchProjectLayoutById = async (
  layoutId: string,
): Promise<GlobalProjectLayoutWithDetails | null> => {
  return prisma.projectLayout.findUnique({
    where: { id: layoutId },
    include: { project: true, createdBy: true, areas: true },
  })
}

export const fetchProjectLayoutByProjectId = async (
  projectId: string,
): Promise<GlobalProjectLayoutWithDetails | null> => {
  return prisma.projectLayout.findUnique({
    // projectId は unique なので findUnique
    where: { projectId: projectId },
    include: { project: true, createdBy: true, areas: true },
    // orderBy は不要 (findUnique のため)
  })
}

export const deleteProjectLayout = async (
  layoutId: string,
): Promise<ProjectLayout | void> => {
  // 関連する LayoutRegion も onDelete: Cascade により自動削除される
  return prisma.projectLayout.delete({
    where: { id: layoutId },
  })
}

export const duplicateProjectLayout = async (
  sourceProjectId: string,
  targetProjectId: string,
  createdById: string,
): Promise<GlobalProjectLayoutWithDetails | null> => {
  const sourceLayout = await prisma.projectLayout.findUnique({
    where: { projectId: sourceProjectId },
    include: {
      areas: true, // LayoutRegion
      project: {
        // Source Project
        select: { masterImages: { select: { id: true, pageNumber: true } } },
      },
    },
  })

  if (!sourceLayout) {
    return null
  }

  const targetProject = await prisma.project.findUnique({
    where: { projectId: targetProjectId },
    include: { masterImages: { select: { id: true, pageNumber: true } } },
  })

  if (!targetProject) {
    throw new Error(`Target project ${targetProjectId} not found.`)
  }

  const existingTargetLayout = await prisma.projectLayout.findUnique({
    where: { projectId: targetProjectId },
  })
  if (existingTargetLayout) {
    throw new Error(
      `Layout for target project ${targetProjectId} already exists.`,
    )
  }

  const targetMasterImageMap = new Map(
    targetProject.masterImages.map((img) => [img.pageNumber, img.id]),
  )

  return prisma.$transaction(async (tx) => {
    const newLayout = await tx.projectLayout.create({
      data: {
        project: { connect: { projectId: targetProjectId } },
        createdBy: { connect: { id: createdById } },
        // name, description は削除された
      },
    })

    if (sourceLayout.areas && sourceLayout.areas.length > 0) {
      const newRegionsData = []
      for (const region of sourceLayout.areas) {
        const {
          id,
          projectLayoutId,
          createdAt,
          updatedAt,
          // masterImage, // masterImage リレーションオブジェクトは areas に含まれない (別途 include しない限り)
          masterImageId: sourceMasterImageId,
          ...restOfRegion
        } = region

        const sourceImageRecord = sourceLayout.project.masterImages.find(
          (img) => img.id === sourceMasterImageId, // sourceMasterImageId を使用
        )
        if (!sourceImageRecord) {
          console.warn(
            `Source master image with id ${sourceMasterImageId} not found for region ${id}. Skipping region.`,
          )
          continue
        }

        const targetMasterImageId = targetMasterImageMap.get(
          sourceImageRecord.pageNumber,
        )
        if (!targetMasterImageId) {
          console.warn(
            `Target master image for page number ${sourceImageRecord.pageNumber} not found. Skipping region ${id}.`,
          )
          continue
        }

        newRegionsData.push({
          ...restOfRegion,
          masterImageId: targetMasterImageId, // ターゲットのMasterImage IDに紐付け直す
          projectLayoutId: newLayout.id, // 新しい ProjectLayout の ID
        })
      }

      if (newRegionsData.length > 0) {
        await tx.layoutRegion.createMany({
          // templateArea を layoutRegion に変更
          data: newRegionsData,
        })
      }
    }

    return tx.projectLayout.findUniqueOrThrow({
      where: { id: newLayout.id },
      include: { project: true, createdBy: true, areas: true },
    })
  })
}

// SaveProjectTemplateInput と saveProjectTemplate は上記で SaveProjectLayoutInput と saveProjectLayout に置き換え済み
// fetchProjectTemplateById, fetchProjectTemplatesByProjectId, deleteProjectTemplate も上記で置き換え済み
