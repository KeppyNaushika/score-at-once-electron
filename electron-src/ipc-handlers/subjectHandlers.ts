/**
 * Subject/SubjectSubtotalGroup IPC ハンドラー
 */

import { ipcMain } from "electron"

import {
  createSubject,
  deleteSubject,
  getAllSubjects,
  getSubjectById,
  updateSubject,
} from "../lib/prisma/subject"
import {
  createSubjectSubtotalGroup,
  deleteSubjectSubtotalGroup,
  getSubjectSubtotalGroups,
} from "../lib/prisma/subjectSubtotalGroup"

export function setupSubjectHandlers(): void {
  // Subject CRUD
  ipcMain.handle("subject:getAll", async () => {
    return getAllSubjects()
  })

  ipcMain.handle("subject:getById", async (_event, id: string) => {
    return getSubjectById(id)
  })

  ipcMain.handle("subject:create", async (_event, data: { name: string }) => {
    return createSubject(data)
  })

  ipcMain.handle(
    "subject:update",
    async (_event, id: string, data: { name: string }) => {
      return updateSubject(id, data)
    }
  )

  ipcMain.handle("subject:delete", async (_event, id: string) => {
    return deleteSubject(id)
  })

  // SubjectSubtotalGroup CRUD
  ipcMain.handle(
    "subjectSubtotalGroup:getBySubjectId",
    async (_event, subjectId: string) => {
      return getSubjectSubtotalGroups(subjectId)
    }
  )

  ipcMain.handle(
    "subjectSubtotalGroup:create",
    async (_event, data: { subjectId: string; subtotalGroupId: string }) => {
      return createSubjectSubtotalGroup(data)
    }
  )

  ipcMain.handle("subjectSubtotalGroup:delete", async (_event, id: string) => {
    return deleteSubjectSubtotalGroup(id)
  })
}
