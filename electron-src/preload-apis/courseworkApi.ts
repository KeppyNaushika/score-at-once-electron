import type {} from "../../src/types/courseworkArchive.types"
import { bind } from "./invoke"

/** 試験外成績資料（Coursework）の IPC API（資料・評価項目・点数・名簿・タグ） */
export function createCourseworkApi() {
  return {
    coursework: {
      // Coursework（トップレベル）
      getAll: bind("coursework:getAll"),
      getById: bind("coursework:getById"),
      create: bind("coursework:create"),
      update: bind("coursework:update"),
      delete: bind("coursework:delete"),
      getCandidates: bind("coursework:getCandidates"),

      // 評価項目
      createItem: bind("coursework:createItem"),
      updateItem: bind("coursework:updateItem"),
      deleteItem: bind("coursework:deleteItem"),
      reorderItems: bind("coursework:reorderItems"),

      // 点数
      getScores: bind("coursework:getScores"),
      batchUpsertScores: bind("coursework:batchUpsertScores"),

      // 名簿
      getStudents: bind("coursework:getStudents"),
      getClassrooms: bind("coursework:getClassrooms"),
      getAvailableClassrooms: bind("coursework:getAvailableClassrooms"),
      getAvailableStudents: bind("coursework:getAvailableStudents"),
      addStudentsFromClassroom: bind("coursework:addStudentsFromClassroom"),
      addStudents: bind("coursework:addStudents"),
      updateStudentOrders: bind("coursework:updateStudentOrders"),
      removeStudents: bind("coursework:removeStudents"),
      removeClassroom: bind("coursework:removeClassroom"),
      classroomRemovalPreview: bind("coursework:classroomRemovalPreview"),
      setClassroomOrders: bind("coursework:setClassroomOrders"),

      // タグ
      setTags: bind("coursework:setTags"),
      addTag: bind("coursework:addTag"),

      // アーカイブ（.coursework のエクスポート／インポート）
      exportArchive: bind("coursework:exportArchive"),
      selectImportFile: bind("coursework:selectImportFile"),
      analyzeArchive: bind("coursework:analyzeArchive"),
      importArchive: bind("coursework:importArchive"),
    },
  }
}
