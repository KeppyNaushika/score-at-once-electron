import { Prisma } from "@prisma/client"
import { ipcMain } from "electron"
import {
  createProject as dbCreateProject,
  deleteProject as dbDeleteProject,
  getProjectById as dbFetchProjectById,
  getProjects as dbFetchProjects,
  updateProject as dbUpdateProject,
} from "../lib/prisma/project"
import { getProjectPagesByProjectId as dbGetProjectPagesByProjectId } from "../lib/prisma/projectPage"

// 自動シリアライゼーション関数
function serializeData<T>(data: T): any {
  return JSON.parse(JSON.stringify(data))
}

export function setupProjectHandlers(): void {
  ipcMain.handle("fetch-projects", async () => {
    try {
      const projects = await dbFetchProjects()

      // 自動シリアライゼーションを使用（Date型が自動でstringに変換される）
      const serializedProjects = projects.map((project) => {
        const baseProject = serializeData(project)

        // cropRegionsを平坦化（既存の構造を維持）
        baseProject.cropRegions =
          project.projectPages?.reduce((allRegions: any[], page) => {
            const pageRegions =
              page.cropRegions?.map((region) => ({
                ...serializeData(region),
                questionScores:
                  region.questionScores?.map((score) => serializeData(score)) ||
                  [],
              })) || []
            return allRegions.concat(pageRegions)
          }, []) || []

        // answerImagesを抽出（既存の構造を維持）
        baseProject.answerImages =
          project.projectPages?.reduce((allImages: any[], page) => {
            const answerImages =
              page.pageImages
                ?.filter((image) => image.imageType === "STUDENT_ANSWER")
                ?.map((image) => ({
                  ...serializeData(image),
                  pageNumber: page.pageNumber,
                })) || []
            return allImages.concat(answerImages)
          }, []) || []

        return baseProject
      })

      return serializedProjects
    } catch (err) {
      console.error("Error fetching projects:", err)
      throw err
    }
  })

  ipcMain.handle("fetch-project-by-id", async (_event, projectId: string) => {
    try {
      const project = await dbFetchProjectById(projectId)
      if (!project) {
        return null
      }

      // 自動シリアライゼーションを使用
      const baseProject = serializeData(project)

      // cropRegionsを平坦化（既存の構造を維持）
      baseProject.cropRegions =
        project.projectPages?.reduce((allRegions: any[], page) => {
          const pageRegions =
            page.cropRegions?.map((region) => serializeData(region)) || []
          return allRegions.concat(pageRegions)
        }, []) || []

      // answerImagesを抽出（既存の構造を維持）
      baseProject.answerImages =
        project.projectPages?.reduce((allImages: any[], page) => {
          const answerImages =
            page.pageImages
              ?.filter((image) => image.imageType === "STUDENT_ANSWER")
              ?.map((image) => ({
                ...serializeData(image),
                pageNumber: page.pageNumber,
              })) || []
          return allImages.concat(answerImages)
        }, []) || []

      return baseProject
    } catch (err) {
      console.error("Error fetching project by ID:", err)
      throw err
    }
  })

  ipcMain.handle(
    "create-project",
    async (
      _event,
      projectData: Omit<Prisma.ProjectCreateInput, "user">,
      userId: string,
    ) => {
      try {
        if (!userId) throw new Error("User ID is required to create a project.")
        const project = await dbCreateProject(projectData, userId)

        // Create a plain serializable object
        const serializedProject = {
          id: project.id,
          examName: project.examName,
          examDate: project.examDate?.toISOString(),
          subject: project.subject,
          description: project.description,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          projectPages:
            project.projectPages?.map((page) => ({
              id: page.id,
              projectId: page.projectId,
              pageNumber: page.pageNumber,
              createdAt: page.createdAt.toISOString(),
              updatedAt: page.updatedAt.toISOString(),
              pageImages:
                page.pageImages?.map((image) => ({
                  id: image.id,
                  projectPageId: image.projectPageId,
                  studentId: image.studentId,
                  imagePath: image.imagePath,
                  imageType: image.imageType,
                  createdAt: image.createdAt.toISOString(),
                  updatedAt: image.updatedAt.toISOString(),
                })) || [],
            })) || [],
          projectSubtotalGroups:
            project.projectSubtotalGroups?.map((psg) => ({
              id: psg.id,
              projectId: psg.projectId,
              subtotalGroupId: psg.subtotalGroupId,
              createdAt: psg.createdAt.toISOString(),
              updatedAt: psg.updatedAt.toISOString(),
              subtotalGroup: psg.subtotalGroup
                ? {
                    id: psg.subtotalGroup.id,
                    name: psg.subtotalGroup.name,
                    createdAt: psg.subtotalGroup.createdAt.toISOString(),
                    updatedAt: psg.subtotalGroup.updatedAt.toISOString(),
                    subtotals:
                      psg.subtotalGroup.subtotals?.map((subtotal) => ({
                        id: subtotal.id,
                        name: subtotal.name,
                        subtotalGroupId: subtotal.subtotalGroupId,
                        order: subtotal.order,
                        createdAt: subtotal.createdAt.toISOString(),
                        updatedAt: subtotal.updatedAt.toISOString(),
                      })) || [],
                  }
                : null,
            })) || [],
          cropRegions:
            project.projectPages?.reduce((allRegions: any[], page) => {
              const pageRegions =
                page.cropRegions?.map((region) => ({
                  id: region.id,
                  projectPageId: region.projectPageId,
                  type: region.type,
                  label: region.label,
                  orderIndex: region.orderIndex,
                  points: region.points,
                  x: region.x,
                  y: region.y,
                  width: region.width,
                  height: region.height,
                  createdAt: region.createdAt.toISOString(),
                  updatedAt: region.updatedAt.toISOString(),
                })) || []
              return allRegions.concat(pageRegions)
            }, []) || [],
        }

        return serializedProject
      } catch (err) {
        console.error("Error creating project:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-project",
    async (_event, projectId: string, data: Prisma.ProjectUpdateInput) => {
      try {
        const project = await dbUpdateProject(projectId, data)

        // Create a plain serializable object
        const serializedProject = {
          id: project.id,
          examName: project.examName,
          examDate: project.examDate?.toISOString(),
          subject: project.subject,
          description: project.description,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        }

        return serializedProject
      } catch (err) {
        console.error("Error updating project:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-project", async (_event, projectId: string) => {
    try {
      const project = await dbDeleteProject(projectId)

      // Create a plain serializable object
      const serializedProject = {
        id: project.id,
        examName: project.examName,
        examDate: project.examDate?.toISOString(),
        subject: project.subject,
        description: project.description,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      }

      return serializedProject
    } catch (err) {
      console.error("Error deleting project:", err)
      throw err
    }
  })

  ipcMain.handle(
    "get-project-pages-by-project-id",
    async (_event, projectId: string) => {
      try {
        const projectPages = await dbGetProjectPagesByProjectId(projectId)

        // Create serializable objects
        const serializedPages = projectPages.map((page) => ({
          id: page.id,
          projectId: page.projectId,
          pageNumber: page.pageNumber,
          createdAt: page.createdAt.toISOString(),
          updatedAt: page.updatedAt.toISOString(),
          pageImages:
            page.pageImages?.map((image) => ({
              id: image.id,
              projectPageId: image.projectPageId,
              studentId: image.studentId,
              imagePath: image.imagePath,
              imageType: image.imageType,
              createdAt: image.createdAt.toISOString(),
              updatedAt: image.updatedAt.toISOString(),
            })) || [],
        }))

        return serializedPages
      } catch (err) {
        console.error("Error fetching project pages by project ID:", err)
        throw err
      }
    },
  )
}
