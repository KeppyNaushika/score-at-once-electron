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
import { type HandlerMap } from "./ipcHandlerUtils"

/** タグ・タグ小計点グループ紐付け・試験タグ紐付けのCRUD用IPCチャンネルを登録する */
export const tagHandlers = {
  // Tag CRUD
  "tag:getAll": async () => {
    return getAllTags()
  },

  "tag:create": async (data: { name: string; color?: string }) => {
    return createTag(data)
  },

  "tag:update": async (
    id: string,
    data: { name?: string; color?: string | null }
  ) => {
    return updateTag(id, data)
  },

  "tag:reorder": async (tagIds: string[]) => {
    return reorderTags(tagIds)
  },

  "tag:delete": async (id: string) => {
    return deleteTag(id)
  },

  "tag:findOrCreate": async (name: string) => {
    return findOrCreateTag(name)
  },

  // TagSubtotalGroup CRUD
  "tagSubtotalGroup:getByTagId": async (tagId: string) => {
    return getTagSubtotalGroups(tagId)
  },

  "tagSubtotalGroup:setTags": async (
    subtotalGroupId: string,
    tagIds: string[]
  ) => {
    return setSubtotalGroupTags(subtotalGroupId, tagIds)
  },

  // ExamTag CRUD
  "examTag:getByExamId": async (examId: string) => {
    return getExamTags(examId)
  },

  "examTag:create": async (data: { examId: string; tagId: string }) => {
    return createExamTag(data)
  },

  "examTag:setExamTags": async (examId: string, tagIds: string[]) => {
    return setExamTags(examId, tagIds)
  },

  // AsbDefinitionTag CRUD
  "asbDefinitionTag:getByDefinitionId": async (asbDefinitionId: string) => {
    return getAsbDefinitionTags(asbDefinitionId)
  },

  "asbDefinitionTag:create": async (data: {
    asbDefinitionId: string
    tagId: string
  }) => {
    return createAsbDefinitionTag(data)
  },

  "asbDefinitionTag:setDefinitionTags": async (
    asbDefinitionId: string,
    tagIds: string[]
  ) => {
    return setAsbDefinitionTags(asbDefinitionId, tagIds)
  },
} satisfies HandlerMap
