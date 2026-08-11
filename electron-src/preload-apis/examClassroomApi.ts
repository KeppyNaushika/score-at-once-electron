import { invoke } from "./invoke"

/** 試験-学級関連のIPC API（実施・統計学級の管理・生徒一括追加・並び替え） */
export function createExamClassroomApi() {
  return {
    // ExamClassroom
    examClassroom: {
      getAll: (examId: string) => invoke("exam-class:get-all", examId),
      getAdministered: (examId: string) =>
        invoke("exam-class:get-administered", examId),
      getAvailable: (examId: string) =>
        invoke("exam-class:get-available", examId),
      add: (options: {
        examId: string
        classroomId: string
        administered?: boolean
        teacherStatistics?: boolean
        studentReport?: boolean
      }) => invoke("exam-class:add", options),
      update: (options: {
        id: string
        administered?: boolean
        teacherStatistics?: boolean
        studentReport?: boolean
        order?: number
      }) => invoke("exam-class:update", options),
      remove: (id: string) => invoke("exam-class:remove", id),
      reorder: (options: { examId: string; orderedIds: string[] }) =>
        invoke("exam-class:reorder", options),
      addStudentsFromClassroom: (
        examId: string,
        classroomId: string,
        activeOnly?: boolean
      ) =>
        invoke(
          "exam-class:add-students-from-class",
          examId,
          classroomId,
          activeOnly
        ),
    },
  }
}
