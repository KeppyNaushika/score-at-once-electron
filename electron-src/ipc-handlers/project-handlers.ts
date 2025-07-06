import { ipcMain } from "electron"
import { Prisma } from "@prisma/client"
import {
  createProject as dbCreateProject,
  deleteProject as dbDeleteProject,
  getProjectById as dbFetchProjectById,
  getProjects as dbFetchProjects,
  updateProject as dbUpdateProject,
} from "../lib/prisma/project"

export function setupProjectHandlers(): void {
  ipcMain.handle("fetch-projects", async () => {
    try {
      const projects = await dbFetchProjects()
      
      // Create plain serializable objects
      const serializedProjects = projects.map(project => ({
        id: project.id,
        examName: project.examName,
        examDate: project.examDate?.toISOString(),
        subject: project.subject,
        description: project.description,
        userId: project.userId,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        user: project.user ? {
          id: project.user.id,
          name: project.user.name,
          username: project.user.username,
          createdAt: project.user.createdAt.toISOString(),
          updatedAt: project.user.updatedAt.toISOString(),
        } : null,
        projectSessions: project.projectSessions?.map(session => ({
          id: session.id,
          projectId: session.projectId,
          userId: session.userId,
          sessionStartedAt: session.sessionStartedAt.toISOString(),
        })) || [],
        masterImages: project.masterImages?.map(image => ({
          id: image.id,
          projectId: image.projectId,
          path: image.path,
          pageNumber: image.pageNumber,
          createdAt: image.createdAt.toISOString(),
          updatedAt: image.updatedAt.toISOString(),
        })) || [],
        questionGroups: project.questionGroups?.map(group => ({
          id: group.id,
          projectId: group.projectId,
          name: group.name,
          createdAt: group.createdAt.toISOString(),
          updatedAt: group.updatedAt.toISOString(),
          items: group.items?.map(item => ({
            id: item.id,
            name: item.name,
            questionGroupId: item.questionGroupId,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          })) || [],
        })) || [],
        layoutRegions: project.layoutRegions?.map(region => ({
          id: region.id,
          projectId: region.projectId,
          masterImageId: region.masterImageId,
          type: region.type,
          label: region.label,
          questionNumber: region.questionNumber,
          points: region.points,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          createdAt: region.createdAt.toISOString(),
          updatedAt: region.updatedAt.toISOString(),
        })) || [],
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
        userId: project.userId,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        user: project.user ? {
          id: project.user.id,
          name: project.user.name,
          username: project.user.username,
          createdAt: project.user.createdAt.toISOString(),
          updatedAt: project.user.updatedAt.toISOString(),
        } : null,
        projectSessions: project.projectSessions?.map(session => ({
          id: session.id,
          projectId: session.projectId,
          userId: session.userId,
          sessionStartedAt: session.sessionStartedAt.toISOString(),
          user: session.user ? {
            id: session.user.id,
            name: session.user.name,
            username: session.user.username,
            createdAt: session.user.createdAt.toISOString(),
            updatedAt: session.user.updatedAt.toISOString(),
          } : null,
        })) || [],
        masterImages: project.masterImages?.map(image => ({
          id: image.id,
          projectId: image.projectId,
          path: image.path,
          pageNumber: image.pageNumber,
          createdAt: image.createdAt.toISOString(),
          updatedAt: image.updatedAt.toISOString(),
        })) || [],
        layoutRegions: project.layoutRegions?.map(region => ({
          id: region.id,
          projectId: region.projectId,
          masterImageId: region.masterImageId,
          type: region.type,
          label: region.label,
          questionNumber: region.questionNumber,
          points: region.points,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          createdAt: region.createdAt.toISOString(),
          updatedAt: region.updatedAt.toISOString(),
        })) || [],
        questionGroups: project.questionGroups?.map(group => ({
          id: group.id,
          projectId: group.projectId,
          name: group.name,
          createdAt: group.createdAt.toISOString(),
          updatedAt: group.updatedAt.toISOString(),
          items: group.items?.map(item => ({
            id: item.id,
            name: item.name,
            questionGroupId: item.questionGroupId,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          })) || [],
        })) || [],
        answerSheets: project.answerSheets?.map(sheet => ({
          id: sheet.id,
          projectId: sheet.projectId,
          studentId: sheet.studentId,
          originalImagePath: sheet.originalImagePath,
          processedImagePath: sheet.processedImagePath,
          pageNumber: sheet.pageNumber,
          isScored: sheet.isScored,
          totalScore: sheet.totalScore,
          isAbsent: sheet.isAbsent,
          version: sheet.version,
          createdAt: sheet.createdAt.toISOString(),
          updatedAt: sheet.updatedAt.toISOString(),
          student: sheet.student ? {
            id: sheet.student.id,
            studentId: sheet.student.studentId,
            lastName: sheet.student.lastName,
            firstName: sheet.student.firstName,
            lastNameKana: sheet.student.lastNameKana,
            firstNameKana: sheet.student.firstNameKana,
            enrollmentYear: sheet.student.enrollmentYear,
            createdAt: sheet.student.createdAt.toISOString(),
            updatedAt: sheet.student.updatedAt.toISOString(),
          } : null,
          questionScores: sheet.questionScores?.map(score => ({
            id: score.id,
            answerSheetId: score.answerSheetId,
            layoutRegionId: score.layoutRegionId,
            partialScore: score.partialScore ? score.partialScore.toString() : null,
            status: score.status,
            comment: score.comment,
            scoredByUserId: score.scoredByUserId,
            scoreVersion: score.scoreVersion,
            createdAt: score.createdAt.toISOString(),
            updatedAt: score.updatedAt.toISOString(),
          })) || [],
        })) || [],
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
          userId: project.userId,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          user: project.user ? {
            id: project.user.id,
            name: project.user.name,
            username: project.user.username,
              createdAt: project.user.createdAt.toISOString(),
            updatedAt: project.user.updatedAt.toISOString(),
          } : null,
          projectSessions: project.projectSessions?.map(session => ({
            id: session.id,
            projectId: session.projectId,
            userId: session.userId,
              sessionStartedAt: session.sessionStartedAt.toISOString(),
          })) || [],
          masterImages: project.masterImages?.map(image => ({
            id: image.id,
            projectId: image.projectId,
            path: image.path,
            pageNumber: image.pageNumber,
            createdAt: image.createdAt.toISOString(),
            updatedAt: image.updatedAt.toISOString(),
          })) || [],
          questionGroups: project.questionGroups?.map(group => ({
            id: group.id,
            projectId: group.projectId,
            name: group.name,
              createdAt: group.createdAt.toISOString(),
            updatedAt: group.updatedAt.toISOString(),
            items: group.items?.map(item => ({
              id: item.id,
              name: item.name,
              questionGroupId: item.questionGroupId,
              createdAt: item.createdAt.toISOString(),
              updatedAt: item.updatedAt.toISOString(),
            })) || [],
          })) || [],
          layoutRegions: project.layoutRegions?.map(region => ({
            id: region.id,
            projectId: region.projectId,
            masterImageId: region.masterImageId,
            type: region.type,
            label: region.label,
            questionNumber: region.questionNumber,
            points: region.points,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
            createdAt: region.createdAt.toISOString(),
            updatedAt: region.updatedAt.toISOString(),
          })) || [],
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
          userId: project.userId,
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
        userId: project.userId,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      }
      
      return serializedProject
    } catch (err) {
      console.error("Error deleting project:", err)
      throw err
    }
  })
}