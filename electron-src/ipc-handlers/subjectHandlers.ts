/**
 * Subject/SubjectSubtotalGroup IPC ハンドラー
 */

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
import { registerHandler } from "./ipcHandlerUtils"

/** 教科（Subject）と教科小計点グループ紐付け（SubjectSubtotalGroup）のCRUD用IPCチャンネルを登録する */
export function setupSubjectHandlers(): void {
  // Subject CRUD
  registerHandler("subject:getAll", async () => {
    return getAllSubjects()
  })

  registerHandler("subject:getById", async (id: string) => {
    return getSubjectById(id)
  })

  registerHandler("subject:create", async (data: { name: string }) => {
    return createSubject(data)
  })

  registerHandler(
    "subject:update",
    async (id: string, data: { name: string }) => {
      return updateSubject(id, data)
    }
  )

  registerHandler("subject:delete", async (id: string) => {
    return deleteSubject(id)
  })

  // SubjectSubtotalGroup CRUD
  registerHandler(
    "subjectSubtotalGroup:getBySubjectId",
    async (subjectId: string) => {
      return getSubjectSubtotalGroups(subjectId)
    }
  )

  registerHandler(
    "subjectSubtotalGroup:create",
    async (data: { subjectId: string; subtotalGroupId: string }) => {
      return createSubjectSubtotalGroup(data)
    }
  )

  registerHandler("subjectSubtotalGroup:delete", async (id: string) => {
    return deleteSubjectSubtotalGroup(id)
  })
}
