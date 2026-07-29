import { ipcRenderer } from "electron"

import type { CourseworkScoreUpsertInput } from "../../src/types/coursework.types"

/** 試験外成績資料（Coursework）の IPC API（資料・評価項目・点数・名簿・タグ） */
export function createCourseworkApi() {
  return {
    coursework: {
      // Coursework（トップレベル）
      getAll: () => ipcRenderer.invoke("coursework:getAll"),
      getById: (id: string) => ipcRenderer.invoke("coursework:getById", id),
      create: (data: {
        name: string
        description?: string | null
        date?: string | null
      }) => ipcRenderer.invoke("coursework:create", data),
      update: (
        id: string,
        data: {
          name?: string
          description?: string | null
          date?: string | null
        }
      ) => ipcRenderer.invoke("coursework:update", id, data),
      delete: (id: string) => ipcRenderer.invoke("coursework:delete", id),
      getCandidates: () => ipcRenderer.invoke("coursework:getCandidates"),

      // 評価項目
      createItem: (data: {
        courseworkId: string
        name: string
        maxScore: number
        inputMode?: string
        letterScales?: { label: string; score: number; order: number }[]
      }) => ipcRenderer.invoke("coursework:createItem", data),
      updateItem: (
        id: string,
        data: {
          name?: string
          maxScore?: number
          inputMode?: string
          letterScales?: { label: string; score: number; order: number }[]
        }
      ) => ipcRenderer.invoke("coursework:updateItem", id, data),
      deleteItem: (id: string) =>
        ipcRenderer.invoke("coursework:deleteItem", id),
      reorderItems: (items: { id: string; order: number }[]) =>
        ipcRenderer.invoke("coursework:reorderItems", items),

      // 点数
      getScores: (courseworkItemId: string) =>
        ipcRenderer.invoke("coursework:getScores", courseworkItemId),
      batchUpsertScores: (scores: CourseworkScoreUpsertInput[]) =>
        ipcRenderer.invoke("coursework:batchUpsertScores", scores),

      // 名簿
      getStudents: (courseworkId: string) =>
        ipcRenderer.invoke("coursework:getStudents", courseworkId),
      getClassrooms: (courseworkId: string) =>
        ipcRenderer.invoke("coursework:getClassrooms", courseworkId),
      getAvailableClassrooms: (courseworkId: string, activeOnly?: boolean) =>
        ipcRenderer.invoke(
          "coursework:getAvailableClassrooms",
          courseworkId,
          activeOnly
        ),
      getAvailableStudents: (courseworkId: string, activeOnly?: boolean) =>
        ipcRenderer.invoke(
          "coursework:getAvailableStudents",
          courseworkId,
          activeOnly
        ),
      addStudentsFromClassroom: (
        courseworkId: string,
        classroomId: string,
        activeOnly?: boolean
      ) =>
        ipcRenderer.invoke(
          "coursework:addStudentsFromClassroom",
          courseworkId,
          classroomId,
          activeOnly
        ),
      addStudents: (courseworkId: string, studentIds: string[]) =>
        ipcRenderer.invoke("coursework:addStudents", courseworkId, studentIds),
      updateStudentOrders: (
        courseworkId: string,
        studentOrders: { studentId: string; customOrder: number }[]
      ) =>
        ipcRenderer.invoke(
          "coursework:updateStudentOrders",
          courseworkId,
          studentOrders
        ),
      removeStudents: (courseworkId: string, studentIds: string[]) =>
        ipcRenderer.invoke(
          "coursework:removeStudents",
          courseworkId,
          studentIds
        ),
      removeClassroom: (
        courseworkId: string,
        classroomId: string,
        deleteStudents?: boolean
      ) =>
        ipcRenderer.invoke(
          "coursework:removeClassroom",
          courseworkId,
          classroomId,
          deleteStudents
        ),
      classroomRemovalPreview: (courseworkId: string, classroomId: string) =>
        ipcRenderer.invoke(
          "coursework:classroomRemovalPreview",
          courseworkId,
          classroomId
        ),
      setClassroomOrders: (
        courseworkId: string,
        orderedClassroomIds: string[]
      ) =>
        ipcRenderer.invoke(
          "coursework:setClassroomOrders",
          courseworkId,
          orderedClassroomIds
        ),

      // タグ
      setTags: (courseworkId: string, tagIds: string[]) =>
        ipcRenderer.invoke("coursework:setTags", courseworkId, tagIds),
      addTag: (courseworkId: string, tagId: string) =>
        ipcRenderer.invoke("coursework:addTag", courseworkId, tagId),

      // アーカイブ（.coursework のエクスポート／インポート）
      exportArchive: (courseworkId: string) =>
        ipcRenderer.invoke("coursework:exportArchive", courseworkId),
      selectImportFile: () => ipcRenderer.invoke("coursework:selectImportFile"),
      analyzeArchive: (options: { archivePath: string }) =>
        ipcRenderer.invoke("coursework:analyzeArchive", options),
      importArchive: (options: {
        archivePath: string
        courseworkDecisions?: import("../../src/types/courseworkArchive.types").CourseworkImportDecisions
        studentMatching?: import("../../src/types/courseworkArchive.types").CourseworkMatchingMethod
      }) => ipcRenderer.invoke("coursework:importArchive", options),
    },
  }
}
