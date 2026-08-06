/**
 * Tag/TagSubtotalGroup/ExamTag IPC ハンドラー
 */

import {
  createAsbDefinitionTag,
  getAsbDefinitionTags,
  setAsbDefinitionTags,
} from "../lib/prisma/asbDefinitionTag"
import { createExamTag, getExamTags, setExamTags } from "../lib/prisma/examTag"
import {
  createTag,
  deleteTag,
  findOrCreateTag,
  getAllTags,
  reorderTags,
  updateTag,
} from "../lib/prisma/tag"
import {
  getTagSubtotalGroups,
  setSubtotalGroupTags,
} from "../lib/prisma/tagSubtotalGroup"
import { registerHandler } from "./ipcHandlerUtils"

/** タグ・タグ小計点グループ紐付け・試験タグ紐付けのCRUD用IPCチャンネルを登録する */
export function setupTagHandlers(): void {
  // Tag CRUD
  registerHandler("tag:getAll", async () => {
    return getAllTags()
  })

  registerHandler(
    "tag:create",
    async (data: { name: string; color?: string }) => {
      return createTag(data)
    }
  )

  registerHandler(
    "tag:update",
    async (id: string, data: { name?: string; color?: string | null }) => {
      return updateTag(id, data)
    }
  )

  registerHandler("tag:reorder", async (tagIds: string[]) => {
    return reorderTags(tagIds)
  })

  registerHandler("tag:delete", async (id: string) => {
    return deleteTag(id)
  })

  registerHandler("tag:findOrCreate", async (name: string) => {
    return findOrCreateTag(name)
  })

  // TagSubtotalGroup CRUD
  registerHandler("tagSubtotalGroup:getByTagId", async (tagId: string) => {
    return getTagSubtotalGroups(tagId)
  })

  registerHandler(
    "tagSubtotalGroup:setTags",
    async (subtotalGroupId: string, tagIds: string[]) => {
      return setSubtotalGroupTags(subtotalGroupId, tagIds)
    }
  )

  // ExamTag CRUD
  registerHandler("examTag:getByExamId", async (examId: string) => {
    return getExamTags(examId)
  })

  registerHandler(
    "examTag:create",
    async (data: { examId: string; tagId: string }) => {
      return createExamTag(data)
    }
  )

  registerHandler(
    "examTag:setExamTags",
    async (examId: string, tagIds: string[]) => {
      return setExamTags(examId, tagIds)
    }
  )

  // AsbDefinitionTag CRUD
  registerHandler(
    "asbDefinitionTag:getByDefinitionId",
    async (asbDefinitionId: string) => {
      return getAsbDefinitionTags(asbDefinitionId)
    }
  )

  registerHandler(
    "asbDefinitionTag:create",
    async (data: { asbDefinitionId: string; tagId: string }) => {
      return createAsbDefinitionTag(data)
    }
  )

  registerHandler(
    "asbDefinitionTag:setDefinitionTags",
    async (asbDefinitionId: string, tagIds: string[]) => {
      return setAsbDefinitionTags(asbDefinitionId, tagIds)
    }
  )
}
