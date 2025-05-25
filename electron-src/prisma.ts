import { Prisma, PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export interface CreateProjectProps {
  examName: string
  examDate: Date | null
  description?: string
  tagTexts?: string[]
}

export const fetchProjects = async (): Promise<
  Prisma.ProjectGetPayload<{ include: { tags: true } }>[]
> => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        tags: true,
      },
      orderBy: { updatedAt: "desc" },
    })
    return projects
  } catch (error) {
    console.error("Failed to fetch projects:", error)
    throw error
  }
}

export const fetchProjectById = async (
  projectId: string,
): Promise<Prisma.ProjectGetPayload<{ include: { tags: true } }> | null> => {
  try {
    return await prisma.project.findUnique({
      where: { projectId },
      include: { tags: true },
    })
  } catch (error) {
    console.error(`Failed to fetch project by ID ${projectId}:`, error)
    throw error
  }
}

export const createProject = async (
  props: CreateProjectProps,
): Promise<Prisma.ProjectGetPayload<{ include: { tags: true } }>> => {
  const { examName, examDate, description, tagTexts } = props
  try {
    const tagConnectOrCreate = tagTexts
      ? tagTexts.map((tagText) => ({
          where: { text: tagText },
          create: { text: tagText },
        }))
      : []

    return await prisma.project.create({
      data: {
        examName,
        examDate,
        description: description || null,
        tags: {
          connectOrCreate: tagConnectOrCreate,
        },
      },
      include: { tags: true },
    })
  } catch (error) {
    console.error("Failed to create project:", error)
    throw error
  }
}

export const updateProject = async (
  projectPayload: Prisma.ProjectGetPayload<{ include: { tags: true } }>,
): Promise<Prisma.ProjectGetPayload<{ include: { tags: true } }>> => {
  const { projectId, examName, examDate, description, tags } = projectPayload
  const tagTexts = tags?.map((tag) => tag.text)

  try {
    const updateData: Prisma.ProjectUpdateInput = {}
    if (projectPayload.hasOwnProperty("examName"))
      updateData.examName = examName
    if (projectPayload.hasOwnProperty("examDate"))
      updateData.examDate = examDate
    if (projectPayload.hasOwnProperty("description"))
      updateData.description = description

    if (tagTexts !== undefined) {
      const tagConnectOrCreate = tagTexts.map((tagText) => ({
        where: { text: tagText },
        create: { text: tagText },
      }))
      updateData.tags = {
        set: [],
        connectOrCreate: tagConnectOrCreate,
      }
    }

    return await prisma.project.update({
      where: { projectId },
      data: updateData,
      include: { tags: true },
    })
  } catch (error) {
    console.error(`Failed to update project ${projectId}:`, error)
    throw error
  }
}

export const deleteProject = async (
  projectId: string,
): Promise<Prisma.ProjectGetPayload<{ include: { tags: true } }>> => {
  try {
    const projectToDelete = await prisma.project.findUnique({
      where: { projectId },
      include: { tags: true },
    })
    if (!projectToDelete) {
      throw new Error(`Project with ID ${projectId} not found.`)
    }

    await prisma.project.delete({
      where: { projectId },
    })
    return projectToDelete
  } catch (error) {
    console.error(`Failed to delete project ${projectId}:`, error)
    throw error
  }
}

export const createTag = async (
  tagText: string,
): Promise<Prisma.TagGetPayload<{}>> => {
  try {
    const existingTag = await prisma.tag.findUnique({
      where: { text: tagText },
    })
    if (existingTag) {
      return existingTag
    }
    return await prisma.tag.create({
      data: { text: tagText },
    })
  } catch (error) {
    console.error(`Failed to create tag "${tagText}":`, error)
    throw error
  }
}

export const updateTag = async (
  tagId: string,
  newText: string,
): Promise<Prisma.TagGetPayload<{}>> => {
  try {
    // 新しいテキストが他のタグで既に使われていないか確認（ユニーク制約のため）
    const existingTagWithNewText = await prisma.tag.findUnique({
      where: { text: newText },
    })
    if (existingTagWithNewText && existingTagWithNewText.id !== tagId) {
      throw new Error(
        `Tag with text "${newText}" already exists. Cannot update.`,
      )
    }

    return await prisma.tag.update({
      where: { id: tagId },
      data: { text: newText },
    })
  } catch (error) {
    console.error(`Failed to update tag ID "${tagId}":`, error)
    throw error
  }
}

export const deleteTag = async (
  tagId: string,
): Promise<Prisma.TagGetPayload<{}>> => {
  try {
    // 関連するプロジェクトからこのタグの関連付けを解除する必要がある場合があるが、
    // Prisma のリレーション設定 (ProjectTags) により、Tag を削除すると Project との関連も自動的に処理されるはず。
    // 必要であれば、削除前に手動で関連を解除する処理を追加。
    return await prisma.tag.delete({
      where: { id: tagId },
    })
  } catch (error) {
    console.error(`Failed to delete tag ID "${tagId}":`, error)
    throw error
  }
}
