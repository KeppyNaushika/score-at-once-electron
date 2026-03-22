import { ipcRenderer } from "electron"

export function createExamClassApi() {
  return {
    // ExamClass
    examClass: {
      getAll: (examId: string) =>
        ipcRenderer.invoke("exam-class:get-all", examId),
      getAdministered: (examId: string) =>
        ipcRenderer.invoke("exam-class:get-administered", examId),
      getStatistics: (examId: string) =>
        ipcRenderer.invoke("exam-class:get-statistics", examId),
      getAvailable: (examId: string) =>
        ipcRenderer.invoke("exam-class:get-available", examId),
      add: (options: {
        examId: string
        classId: string
        administered?: boolean
        statistics?: boolean
      }) => ipcRenderer.invoke("exam-class:add", options),
      update: (options: {
        id: string
        administered?: boolean
        statistics?: boolean
        order?: number
      }) => ipcRenderer.invoke("exam-class:update", options),
      remove: (id: string) => ipcRenderer.invoke("exam-class:remove", id),
      reorder: (options: { examId: string; orderedIds: string[] }) =>
        ipcRenderer.invoke("exam-class:reorder", options),
      removeByIds: (examId: string, classId: string) =>
        ipcRenderer.invoke("exam-class:remove-by-ids", examId, classId),
      addStudentsFromClass: (examId: string, classId: string) =>
        ipcRenderer.invoke(
          "exam-class:add-students-from-class",
          examId,
          classId
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
