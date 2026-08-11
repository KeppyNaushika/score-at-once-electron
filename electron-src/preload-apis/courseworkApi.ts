import type { CourseworkScoreUpsertInput } from "../../src/types/coursework.types"
import type {
  CourseworkImportDecisions,
  CourseworkMatchingMethod,
} from "../../src/types/courseworkArchive.types"
import { invoke } from "./invoke"

/** 試験外成績資料（Coursework）の IPC API（資料・評価項目・点数・名簿・タグ） */
export function createCourseworkApi() {
  return {
    coursework: {
      // Coursework（トップレベル）
      getAll: () => invoke("coursework:getAll"),
      getById: (id: string) => invoke("coursework:getById", id),
      create: (data: {
        name: string
        description?: string | null
        date?: string | null
      }) => invoke("coursework:create", data),
      update: (
        id: string,
        data: {
          name?: string
          description?: string | null
          date?: string | null
        }
      ) => invoke("coursework:update", id, data),
      delete: (id: string) => invoke("coursework:delete", id),
      getCandidates: () => invoke("coursework:getCandidates"),

      // 評価項目
      createItem: (data: {
        courseworkId: string
        name: string
        maxScore: number
        inputMode?: string
        letterScales?: { label: string; score: number; order: number }[]
      }) => invoke("coursework:createItem", data),
      updateItem: (
        id: string,
        data: {
          name?: string
          maxScore?: number
          inputMode?: string
          letterScales?: { label: string; score: number; order: number }[]
        }
      ) => invoke("coursework:updateItem", id, data),
      deleteItem: (id: string) => invoke("coursework:deleteItem", id),
      reorderItems: (items: { id: string; order: number }[]) =>
        invoke("coursework:reorderItems", items),

      // 点数
      getScores: (courseworkItemId: string) =>
        invoke("coursework:getScores", courseworkItemId),
      batchUpsertScores: (scores: CourseworkScoreUpsertInput[]) =>
        invoke("coursework:batchUpsertScores", scores),

      // 名簿
      getStudents: (courseworkId: string) =>
        invoke("coursework:getStudents", courseworkId),
      getClassrooms: (courseworkId: string) =>
        invoke("coursework:getClassrooms", courseworkId),
      getAvailableClassrooms: (courseworkId: string, activeOnly?: boolean) =>
        invoke("coursework:getAvailableClassrooms", courseworkId, activeOnly),
      getAvailableStudents: (courseworkId: string, activeOnly?: boolean) =>
        invoke("coursework:getAvailableStudents", courseworkId, activeOnly),
      addStudentsFromClassroom: (
        courseworkId: string,
        classroomId: string,
        activeOnly?: boolean
      ) =>
        invoke(
          "coursework:addStudentsFromClassroom",
          courseworkId,
          classroomId,
          activeOnly
        ),
      addStudents: (courseworkId: string, studentIds: string[]) =>
        invoke("coursework:addStudents", courseworkId, studentIds),
      updateStudentOrders: (
        courseworkId: string,
        studentOrders: { studentId: string; customOrder: number }[]
      ) =>
        invoke("coursework:updateStudentOrders", courseworkId, studentOrders),
      removeStudents: (courseworkId: string, studentIds: string[]) =>
        invoke("coursework:removeStudents", courseworkId, studentIds),
      removeClassroom: (
        courseworkId: string,
        classroomId: string,
        deleteStudents?: boolean
      ) =>
        invoke(
          "coursework:removeClassroom",
          courseworkId,
          classroomId,
          deleteStudents
        ),
      classroomRemovalPreview: (courseworkId: string, classroomId: string) =>
        invoke("coursework:classroomRemovalPreview", courseworkId, classroomId),
      setClassroomOrders: (
        courseworkId: string,
        orderedClassroomIds: string[]
      ) =>
        invoke(
          "coursework:setClassroomOrders",
          courseworkId,
          orderedClassroomIds
        ),

      // タグ
      setTags: (courseworkId: string, tagIds: string[]) =>
        invoke("coursework:setTags", courseworkId, tagIds),
      addTag: (courseworkId: string, tagId: string) =>
        invoke("coursework:addTag", courseworkId, tagId),

      // アーカイブ（.coursework のエクスポート／インポート）
      exportArchive: (courseworkId: string) =>
        invoke("coursework:exportArchive", courseworkId),
      selectImportFile: () => invoke("coursework:selectImportFile"),
      analyzeArchive: (options: { archivePath: string }) =>
        invoke("coursework:analyzeArchive", options),
      importArchive: (options: {
        archivePath: string
        courseworkDecisions?: CourseworkImportDecisions
        studentMatching?: CourseworkMatchingMethod
      }) => invoke("coursework:importArchive", options),
    },
  }
}
