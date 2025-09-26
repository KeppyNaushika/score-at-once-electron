import { ipcMain } from "electron"
import { Prisma } from "@prisma/client"
import {
  createProject as dbCreateProject,
  deleteProject as dbDeleteProject,
  getProjectById as dbFetchProjectById,
  getProjects as dbFetchProjects,
  updateProject as dbUpdateProject,
} from "../lib/prisma/project"
import { getProjectPagesByProjectId as dbGetProjectPagesByProjectId } from "../lib/prisma/projectPage"

export function setupProjectHandlers(): void {
  ipcMain.handle("fetch-projects", async () => {
    try {
      const projects = await dbFetchProjects()

      // Create plain serializable objects
      const serializedProjects = projects.map((project) => ({
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
            pageImages: page.pageImages?.map((image) => ({
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
            subtotalGroup: psg.subtotalGroup ? {
              id: psg.subtotalGroup.id,
              name: psg.subtotalGroup.name,
              createdAt: psg.subtotalGroup.createdAt.toISOString(),
              updatedAt: psg.subtotalGroup.updatedAt.toISOString(),
              subtotals: psg.subtotalGroup.subtotals?.map((subtotal) => ({
                id: subtotal.id,
                name: subtotal.name,
                subtotalGroupId: subtotal.subtotalGroupId,
                order: subtotal.order,
                createdAt: subtotal.createdAt.toISOString(),
                updatedAt: subtotal.updatedAt.toISOString(),
              })) || [],
            } : null,
          })) || [],
        cropRegions:
          project.projectPages?.reduce((allRegions: any[], page) => {
            const pageRegions = page.cropRegions?.map((region) => ({
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
              questionScores: region.questionScores?.map((score) => ({
                id: score.id,
                status: score.status,
              })) || [],
            })) || [];
            return allRegions.concat(pageRegions);
          }, []) || [],
        projectStudents:
          project.projectStudents?.map((ps) => ({
            id: ps.id,
            projectId: ps.projectId,
            studentId: ps.studentId,
            status: ps.status,
            customOrder: ps.customOrder,
            createdAt: ps.createdAt.toISOString(),
            updatedAt: ps.updatedAt.toISOString(),
          })) || [],
        answerImages:
          project.projectPages?.reduce((allImages: any[], page) => {
            const answerImages = page.pageImages?.filter(image => image.imageType === "STUDENT_ANSWER").map((image) => ({
              id: image.id,
              projectPageId: image.projectPageId,
              studentId: image.studentId,
              imagePath: image.imagePath,
              imageType: image.imageType,
              pageNumber: page.pageNumber,
              createdAt: image.createdAt.toISOString(),
              updatedAt: image.updatedAt.toISOString(),
              student: image.student ? {
                id: image.student.id,
                studentId: image.student.studentId,
                lastName: image.student.lastName,
                firstName: image.student.firstName,
                lastNameKana: image.student.lastNameKana,
                firstNameKana: image.student.firstNameKana,
                enrollmentYear: image.student.enrollmentYear,
                createdAt: image.student.createdAt.toISOString(),
                updatedAt: image.student.updatedAt.toISOString(),
              } : null,
            })) || [];
            return allImages.concat(answerImages);
          }, []) || [],
      }))

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
            pageImages: page.pageImages?.map((image) => ({
              id: image.id,
              projectPageId: image.projectPageId,
              studentId: image.studentId,
              imagePath: image.imagePath,
              imageType: image.imageType,
              createdAt: image.createdAt.toISOString(),
              updatedAt: image.updatedAt.toISOString(),
            })) || [],
          })) || [],
        cropRegions:
          project.projectPages?.reduce((allRegions: any[], page) => {
            const pageRegions = page.cropRegions?.map((region) => ({
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
            })) || [];
            return allRegions.concat(pageRegions);
          }, []) || [],
        projectSubtotalGroups:
          project.projectSubtotalGroups?.map((psg) => ({
            id: psg.id,
            projectId: psg.projectId,
            subtotalGroupId: psg.subtotalGroupId,
            createdAt: psg.createdAt.toISOString(),
            updatedAt: psg.updatedAt.toISOString(),
            subtotalGroup: psg.subtotalGroup ? {
              id: psg.subtotalGroup.id,
              name: psg.subtotalGroup.name,
              createdAt: psg.subtotalGroup.createdAt.toISOString(),
              updatedAt: psg.subtotalGroup.updatedAt.toISOString(),
              subtotals: psg.subtotalGroup.subtotals?.map((subtotal) => ({
                id: subtotal.id,
                name: subtotal.name,
                subtotalGroupId: subtotal.subtotalGroupId,
                order: subtotal.order,
                createdAt: subtotal.createdAt.toISOString(),
                updatedAt: subtotal.updatedAt.toISOString(),
              })) || [],
            } : null,
          })) || [],
        answerImages:
          project.projectPages?.reduce((allImages: any[], page) => {
            const answerImages = page.pageImages?.filter(image => image.imageType === "STUDENT_ANSWER").map((image) => ({
              id: image.id,
              projectPageId: image.projectPageId,
              studentId: image.studentId,
              imagePath: image.imagePath,
              imageType: image.imageType,
              pageNumber: page.pageNumber,
              createdAt: image.createdAt.toISOString(),
              updatedAt: image.updatedAt.toISOString(),
              student: image.student ? {
                id: image.student.id,
                studentId: image.student.studentId,
                lastName: image.student.lastName,
                firstName: image.student.firstName,
                lastNameKana: image.student.lastNameKana,
                firstNameKana: image.student.firstNameKana,
                enrollmentYear: image.student.enrollmentYear,
                createdAt: image.student.createdAt.toISOString(),
                updatedAt: image.student.updatedAt.toISOString(),
              } : null,
            })) || [];
            return allImages.concat(answerImages);
          }, []) || [],
      }

      return serializedProject
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
              pageImages: page.pageImages?.map((image) => ({
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
              subtotalGroup: psg.subtotalGroup ? {
                id: psg.subtotalGroup.id,
                name: psg.subtotalGroup.name,
                createdAt: psg.subtotalGroup.createdAt.toISOString(),
                updatedAt: psg.subtotalGroup.updatedAt.toISOString(),
                subtotals: psg.subtotalGroup.subtotals?.map((subtotal) => ({
                  id: subtotal.id,
                  name: subtotal.name,
                  subtotalGroupId: subtotal.subtotalGroupId,
                  order: subtotal.order,
                  createdAt: subtotal.createdAt.toISOString(),
                  updatedAt: subtotal.updatedAt.toISOString(),
                })) || [],
              } : null,
            })) || [],
          cropRegions:
            project.projectPages?.reduce((allRegions: any[], page) => {
              const pageRegions = page.cropRegions?.map((region) => ({
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
              })) || [];
              return allRegions.concat(pageRegions);
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

  ipcMain.handle("get-project-pages-by-project-id", async (_event, projectId: string) => {
    try {
      const projectPages = await dbGetProjectPagesByProjectId(projectId)
      
      // Create serializable objects
      const serializedPages = projectPages.map((page) => ({
        id: page.id,
        projectId: page.projectId,
        pageNumber: page.pageNumber,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
        pageImages: page.pageImages?.map((image) => ({
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
  })

}
