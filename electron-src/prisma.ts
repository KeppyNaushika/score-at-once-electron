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
  } finally {
  }
}

export const createProject = async (
  examName: string,
  examDate: Date | null,
) => {
  try {
    await prisma.project.create({
      data: {
        examName: examName,
        examDate: examDate ?? "",
      },
    })
  } catch (error) {
    console.error("ProjectCreateError: ", error)
    throw error
  } finally {
    return await fetchProjects()
  }
}

export const deleteProject = async (project: Project) => {
  try {
    await prisma.project.delete({
      where: { id: project.id },
    })
  } catch (error) {
    console.error("ProjectDeleteError: ", error)
    throw error
  } finally {
    return await fetchProjects()
  }
}
