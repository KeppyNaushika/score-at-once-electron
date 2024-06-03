import { PrismaClient, Project } from "@prisma/client"

const prisma = new PrismaClient()

export const fetchProjects = async (): Promise<Project[]> => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        tags: true,
      },
    })
    return projects
  } catch (error) {
    console.error("ProjectFetchError: ", error)
    throw error
  }
}

export const createProject = async (
  examName: string,
  examDate: Date | null,
) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        tags: true,
      },
    })
    await Promise.all(
      projects.map((project) =>
        prisma.project.update({
          where: { id: project.id },
          data: { selected: false },
        }),
      ),
    )
    await prisma.project.create({
      data: {
        examName: examName,
        examDate: examDate ?? "",
        selected: true,
      },
    })
  } catch (error) {
    console.error("ProjectCreateError: ", error)
    throw error
  }
}

export const selectProject = async (project: Project) => {
  try {
    await prisma.project.updateMany({
      where: { selected: true },
      data: { selected: false },
    })
    await prisma.project.update({
      where: { id: project.id },
      data: { selected: true },
    })
  } catch (error) {
    console.error("ProjectSelectError: ", error)
    throw error
  }
}

export const deleteProject = async (project: Project) => {
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
    console.error("ProjectDeleteError: ", error)
    throw error
  }
}
