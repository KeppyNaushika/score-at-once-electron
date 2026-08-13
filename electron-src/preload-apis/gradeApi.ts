import type {} from "../../src/types/grade.types"
import { bind } from "./invoke"

/** 成績算出のIPC API（成績CRUD・データソース・評定境界・手動点数・Excel出力） */
export function createGradeApi() {
  return {
    // Grade（成績算出）
    grade: {
      getAll: bind("grade:getAll"),
      getById: bind("grade:getById"),
      create: bind("grade:create"),
      update: bind("grade:update"),
      delete: bind("grade:delete"),
      duplicate: bind("grade:duplicate"),
      // 生徒・学級管理
      getStudents: bind("grade:getStudents"),
      getClassrooms: bind("grade:getClassrooms"),
      getAvailableClassrooms: bind("grade:getAvailableClassrooms"),
      getAvailableStudents: bind("grade:getAvailableStudents"),
      addStudentsToGrade: bind("grade:addStudentsToGrade"),
      addStudentsFromClassroom: bind("grade:addStudentsFromClassroom"),
      removeClassroom: bind("grade:removeClassroom"),
      classroomRemovalPreview: bind("grade:classroomRemovalPreview"),
      setClassroomOrders: bind("grade:setClassroomOrders"),
      updateStudentOrders: bind("grade:updateStudentOrders"),
      // GradeItem
      createGradeItem: bind("grade:createGradeItem"),
      updateGradeItem: bind("grade:updateGradeItem"),
      deleteGradeItem: bind("grade:deleteGradeItem"),
      reorderGradeItems: bind("grade:reorderGradeItems"),
      // データソース
      createDataSource: bind("grade:createDataSource"),
      updateDataSource: bind("grade:updateDataSource"),
      deleteDataSource: bind("grade:deleteDataSource"),
      reorderDataSources: bind("grade:reorderDataSources"),
      // 境界（評定の刻み）。日常の編集は1本ずつ、並べ替えは専用、
      // 「全部消す」と「プリセット適用」だけが集合の操作として残る
      replaceGradeItemBoundaries: bind("grade:replaceGradeItemBoundaries"),
      createGradeItemBoundary: bind("grade:createGradeItemBoundary"),
      updateGradeItemBoundary: bind("grade:updateGradeItemBoundary"),
      deleteGradeItemBoundary: bind("grade:deleteGradeItemBoundary"),
      reorderGradeItemBoundaries: bind("grade:reorderGradeItemBoundaries"),
      deleteGradeItemBoundaries: bind("grade:deleteGradeItemBoundaries"),
      upsertGradeOverride: bind("grade:upsertGradeOverride"),
      deleteGradeOverride: bind("grade:deleteGradeOverride"),
      getGradeConstraints: bind("grade:getGradeConstraints"),
      createGradeConstraint: bind("grade:createGradeConstraint"),
      updateGradeConstraint: bind("grade:updateGradeConstraint"),
      deleteGradeConstraint: bind("grade:deleteGradeConstraint"),
      getGradeItemExclusions: bind("grade:getGradeItemExclusions"),
      setGradeItemExclusion: bind("grade:setGradeItemExclusion"),
      calculateGrades: bind("grade:calculateGrades"),
      computeSourceFits: bind("grade:computeSourceFits"),
      // 成績値の確定（凍結）。targets 未指定は Grade 全体の一括確定・一括解除。
      // 対象セルの同定は (gradeStudentId, gradeItemId)。総合の行は存在しない。
      freezeGradeScores: bind("grade:freezeGradeScores"),
      unfreezeGradeScores: bind("grade:unfreezeGradeScores"),
      getExamCandidates: bind("grade:getExamCandidates"),
      getExamSubtotalGroups: bind("grade:getExamSubtotalGroups"),
      getExamCropRegions: bind("grade:getExamCropRegions"),
      exportExcel: bind("grade:exportExcel"),
      getExportSettings: bind("grade:getExportSettings"),
      saveExportSettings: bind("grade:saveExportSettings"),
      exportArchive: bind("grade:exportArchive"),
      importArchive: bind("grade:importArchive"),
      executeImport: bind("grade:executeImport"),
    },
  }
}
