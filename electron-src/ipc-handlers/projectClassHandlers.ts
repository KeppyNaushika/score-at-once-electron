import { ipcMain } from "electron"
import {
  addProjectClass,
  AddProjectClassOptions,
  addStudentsFromClass,
  getAdministeredClasses,
  getAvailableClassesForProject,
  getProjectClasses,
  getStatisticsClasses,
  getStudentClassInfo,
  getStudentClassInfoForProject,
  removeProjectClass,
  removeProjectClassByIds,
  reorderProjectClasses,
  ReorderProjectClassesOptions,
  updateProjectClass,
  UpdateProjectClassOptions,
} from "../lib/prisma/projectClass"

export function setupProjectClassHandlers(): void {
  // Get all classes for a project
  ipcMain.handle("project-class:get-all", async (_event, projectId: string) => {
    try {
      return await getProjectClasses(projectId)
    } catch (error) {
      console.error("IPC project-class:get-all error:", error)
      throw error
    }
  })

  // Get administered classes (for adding students)
  ipcMain.handle(
    "project-class:get-administered",
    async (_event, projectId: string) => {
      try {
        return await getAdministeredClasses(projectId)
      } catch (error) {
        console.error("IPC project-class:get-administered error:", error)
        throw error
      }
    }
  )

  // Get statistics classes (for aggregation)
  ipcMain.handle(
    "project-class:get-statistics",
    async (_event, projectId: string) => {
      try {
        return await getStatisticsClasses(projectId)
      } catch (error) {
        console.error("IPC project-class:get-statistics error:", error)
        throw error
      }
    }
  )

  // Add a class to a project
  ipcMain.handle(
    "project-class:add",
    async (_event, options: AddProjectClassOptions) => {
      try {
        return await addProjectClass(options)
      } catch (error) {
        console.error("IPC project-class:add error:", error)
        throw error
      }
    }
  )

  // Update a project class
  ipcMain.handle(
    "project-class:update",
    async (_event, options: UpdateProjectClassOptions) => {
      try {
        return await updateProjectClass(options)
      } catch (error) {
        console.error("IPC project-class:update error:", error)
        throw error
      }
    }
  )

  // Remove a project class by id
  ipcMain.handle("project-class:remove", async (_event, id: string) => {
    try {
      return await removeProjectClass(id)
    } catch (error) {
      console.error("IPC project-class:remove error:", error)
      throw error
    }
  })

  // Remove a project class by projectId and classId
  ipcMain.handle(
    "project-class:remove-by-ids",
    async (_event, projectId: string, classId: string) => {
      try {
        return await removeProjectClassByIds(projectId, classId)
      } catch (error) {
        console.error("IPC project-class:remove-by-ids error:", error)
        throw error
      }
    }
  )

  // Get available classes (not yet in ProjectClass)
  ipcMain.handle(
    "project-class:get-available",
    async (_event, projectId: string) => {
      try {
        return await getAvailableClassesForProject(projectId)
      } catch (error) {
        console.error("IPC project-class:get-available error:", error)
        throw error
      }
    }
  )

  // Add students from class (B案: 統合型フロー)
  ipcMain.handle(
    "project-class:add-students-from-class",
    async (_event, projectId: string, classId: string) => {
      try {
        return await addStudentsFromClass(projectId, classId)
      } catch (error) {
        console.error("IPC project-class:add-students-from-class error:", error)
        throw error
      }
    }
  )

  // Get class info for all students in a project
  ipcMain.handle(
    "project-class:get-student-class-info",
    async (_event, projectId: string) => {
      try {
        return await getStudentClassInfoForProject(projectId)
      } catch (error) {
        console.error("IPC project-class:get-student-class-info error:", error)
        throw error
      }
    }
  )

  // Get class info for a single student
  ipcMain.handle(
    "project-class:get-student-class-info-single",
    async (_event, projectId: string, studentId: string) => {
      try {
        return await getStudentClassInfo(projectId, studentId)
      } catch (error) {
        console.error(
          "IPC project-class:get-student-class-info-single error:",
          error
        )
        throw error
      }
    }
  )

  // Reorder project classes
  ipcMain.handle(
    "project-class:reorder",
    async (_event, options: ReorderProjectClassesOptions) => {
      try {
        return await reorderProjectClasses(options)
      } catch (error) {
        console.error("IPC project-class:reorder error:", error)
        throw error
      }
    }
  )
}
