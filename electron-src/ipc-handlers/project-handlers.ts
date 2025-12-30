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

/**
 * QuestionScoreをIPC用にシリアライズ（DecimalをnumberにDateはそのまま）
 */
function serializeQuestionScore(score: {
  id: string
  cropRegionId: string
  studentId: string | null
  partialScore: { toNumber(): number } | null
  status: string
  scoredByUserId: string | null
  createdAt: Date
  updatedAt: Date
  student?: unknown
  scoredByUser?: unknown
}) {
  return {
    id: score.id,
    cropRegionId: score.cropRegionId,
    studentId: score.studentId,
    partialScore: score.partialScore ? score.partialScore.toNumber() : null,
    status: score.status,
    scoredByUserId: score.scoredByUserId,
    createdAt: score.createdAt,
    updatedAt: score.updatedAt,
    student: score.student,
    scoredByUser: score.scoredByUser,
  }
}

export function setupProjectHandlers(): void {
  ipcMain.handle("fetch-projects", async () => {
    try {
      const projects = await dbFetchProjects()

      // Dateオブジェクトをそのまま返す（Structured Clone AlgorithmでDate対応）
      // Decimalオブジェクトはnumberに変換（Structured Clone非対応のため）
      const projectsWithFlattenedData = projects.map((project) => ({
        ...project,
        // projectPagesのcropRegionsのquestionScoresをシリアライズ
        projectPages: project.projectPages?.map((page) => ({
          ...page,
          cropRegions: page.cropRegions?.map((region) => ({
            ...region,
            questionScores: region.questionScores?.map(serializeQuestionScore) || [],
          })) || [],
        })) || [],
        // cropRegionsを平坦化（シリアライズ済み）
        cropRegions:
          project.projectPages?.flatMap((page) =>
            page.cropRegions?.map((region) => ({
              ...region,
              questionScores: region.questionScores?.map(serializeQuestionScore) || [],
            })) || []
          ) || [],
        // answerImagesを抽出
        answerImages:
          project.projectPages?.flatMap((page) =>
            page.pageImages
              ?.filter((image) => image.imageType === "STUDENT_ANSWER")
              ?.map((image) => ({
                ...image,
                pageNumber: page.pageNumber,
              })) || []
          ) || [],
      }))

      return projectsWithFlattenedData
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

      // Dateオブジェクトをそのまま返す
      // Decimalオブジェクトはnumberに変換（Structured Clone非対応のため）
      return {
        ...project,
        // projectPagesのcropRegionsのquestionScoresをシリアライズ
        projectPages: project.projectPages?.map((page) => ({
          ...page,
          cropRegions: page.cropRegions?.map((region) => ({
            ...region,
            questionScores: region.questionScores?.map(serializeQuestionScore) || [],
          })) || [],
        })) || [],
        // cropRegionsを平坦化（シリアライズ済み）
        cropRegions:
          project.projectPages?.flatMap((page) =>
            page.cropRegions?.map((region) => ({
              ...region,
              questionScores: region.questionScores?.map(serializeQuestionScore) || [],
            })) || []
          ) || [],
        // answerImagesを抽出
        answerImages:
          project.projectPages?.flatMap((page) =>
            page.pageImages
              ?.filter((image) => image.imageType === "STUDENT_ANSWER")
              ?.map((image) => ({
                ...image,
                pageNumber: page.pageNumber,
              })) || []
          ) || [],
      }
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

        // Dateオブジェクトをそのまま返す
        return {
          ...project,
          cropRegions:
            project.projectPages?.flatMap((page) =>
              page.cropRegions?.map((region) => region) || []
            ) || [],
        }
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
        // Dateオブジェクトをそのまま返す
        return project
      } catch (err) {
        console.error("Error updating project:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-project", async (_event, projectId: string) => {
    try {
      const project = await dbDeleteProject(projectId)
      // Dateオブジェクトをそのまま返す
      return project
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
        // Dateオブジェクトをそのまま返す
        return projectPages
      } catch (err) {
        console.error("Error fetching project pages by project ID:", err)
        throw err
      }
    },
  )
}
