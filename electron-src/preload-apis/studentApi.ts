import { bind } from "./invoke"

/** 生徒・学級・所属管理のIPC API（生徒CRUD・学級CRUD・クラス所属・Excel出力） */
export function createStudentApi() {
  return {
    // Student related
    fetchStudents: bind("fetch-students"),
    createStudent: bind("create-student"),
    updateStudent: bind("update-student"),
    deleteStudent: bind("delete-student"),
    getStudentExamResults: bind("get-student-exam-results"),
    getClassroomExamResults: bind("get-class-exam-results"),
    exportStudentsExcel: bind("export-students-excel"),

    // Classroom related
    fetchClassrooms: bind("fetch-classrooms"),
    createClassroom: bind("create-class"),
    updateClassroom: bind("update-class"),
    deleteClassroom: bind("delete-class"),
    exportClassroomsExcel: bind("export-classrooms-excel"),

    // Student Classroom Membership related
    updateStudentClassroomMembership: bind("update-student-class-membership"),
    deleteStudentClassroomMembership: bind("delete-student-class-membership"),
    addStudentToClassroom: bind("add-student-to-class"),
    endStudentMembership: bind("end-student-membership"),
  }
}
