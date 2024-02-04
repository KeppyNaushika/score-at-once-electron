import { PrismaClient, Project } from "@prisma/client"

export const fetchProjects = async (): Promise<Project[]> => {
  const prisma = new PrismaClient()

  try {
    const projects = await prisma.project.findMany({
      include: {
        tags: true,
      },
    })
    return projects
  } catch (error) {
    console.error("データの取得中にエラーが発生しました:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

export const createProject = async (
  examName: string,
  examDate: Date | null,
) => {
  const prisma = new PrismaClient()

  try {
    const projects = await prisma.project.findMany({
      include: {
        tags: true,
      },
    })
    projects.map(async (project) => {
      await prisma.project.update({
        where: { id: project.id },
        data: { selected: false },
      })
    })
    await prisma.project.create({
      data: {
        examName: examName,
        examDate: examDate ?? "",
        selected: true,
      },
    })
  } catch (error) {
    console.error("プロジェクト作成中にエラーが発生しました:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

export const selectProject = async (project: Project) => {
  const prisma = new PrismaClient()
  try {
    await prisma.project.updateMany({
      where: { selected: true },
      data: { selected: false },
    })
    await prisma.project.update({
      where: { id: project.id },
      data: { selected: false },
    })
  } catch (error) {
    console.error("プロジェクト選択中にエラーが発生しました:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

export const deleteProject = async (project: Project) => {
  const prisma = new PrismaClient()
  try {
    await prisma.project.delete({
      where: { id: project.id },
    })
    const firstProject = await prisma.project.findFirst()
    if (firstProject) {
      await prisma.project.update({
        where: { id: firstProject.id },
        data: { selected: true },
      })
    }
  } catch (error) {
    console.error("プロジェクト削除中にエラーが発生しました:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}
