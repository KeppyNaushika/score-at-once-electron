import { ipcRenderer } from "electron"

/** 試験-学級関連のIPC API（実施・統計学級の管理・生徒一括追加・並び替え） */
export function createExamClassApi() {
  return {
    // ExamClass
    examClass: {
      getAll: (examId: string) =>
        ipcRenderer.invoke("exam-class:get-all", examId),
      getAdministered: (examId: string) =>
        ipcRenderer.invoke("exam-class:get-administered", examId),
      getAvailable: (examId: string) =>
        ipcRenderer.invoke("exam-class:get-available", examId),
      add: (options: {
        examId: string
        classroomId: string
        administered?: boolean
        teacherStat?: boolean
        studentReport?: boolean
      }) => ipcRenderer.invoke("exam-class:add", options),
      update: (options: {
        id: string
        administered?: boolean
        teacherStat?: boolean
        studentReport?: boolean
        order?: number
      }) => ipcRenderer.invoke("exam-class:update", options),
      remove: (id: string) => ipcRenderer.invoke("exam-class:remove", id),
      reorder: (options: { examId: string; orderedIds: string[] }) =>
        ipcRenderer.invoke("exam-class:reorder", options),
      removeByIds: (examId: string, classroomId: string) =>
        ipcRenderer.invoke("exam-class:remove-by-ids", examId, classroomId),
      addStudentsFromClass: (
        examId: string,
        classroomId: string,
        activeOnly?: boolean
      ) =>
        ipcRenderer.invoke(
          "exam-class:add-students-from-class",
          examId,
          classroomId,
          activeOnly
        ),
      getStudentClassInfo: (examId: string) =>
        ipcRenderer.invoke("exam-class:get-student-class-info", examId),
      getStudentClassInfoSingle: (examId: string, studentId: string) =>
        ipcRenderer.invoke(
          "exam-class:get-student-class-info-single",
          examId,
          studentId
        ),
    },
  }
}
