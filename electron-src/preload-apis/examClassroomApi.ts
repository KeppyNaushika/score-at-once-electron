import { bind } from "./invoke"

/** 試験-学級関連のIPC API（実施・統計学級の管理・生徒一括追加・並び替え） */
export function createExamClassroomApi() {
  return {
    // ExamClassroom
    examClassroom: {
      getAll: bind("exam-class:get-all"),
      getAdministered: bind("exam-class:get-administered"),
      getAvailable: bind("exam-class:get-available"),
      add: bind("exam-class:add"),
      update: bind("exam-class:update"),
      remove: bind("exam-class:remove"),
      reorder: bind("exam-class:reorder"),
      addStudentsFromClassroom: bind("exam-class:add-students-from-class"),
    },
  }
}
