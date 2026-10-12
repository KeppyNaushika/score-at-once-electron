import { column, identifier, table, value } from "../codeRefBuilders"
import type { GlossaryCategory } from "../types"

const AREA_TYPES = "src/types/cropRegionAreaType.types.ts"
const EXAM_STUDENT_STATUSES = "src/types/examStudentStatus.types.ts"
const EXAM_ROLES = "src/lib/shared/examRoles.ts"

export const EXAM_SETUP_TERM_IDS = [
  "exam",
  "examReferenceDate",
  "examMember",
  "roleOwner",
  "roleEditor",
  "roleViewer",
  "anonymousScoring",
  "examPage",
  "markerCorrection",
  "cropRegion",
  "cropRegionType",
  "question",
  "studentNameArea",
  "studentIdArea",
  "totalScoreArea",
  "subtotalArea",
  "regionLabel",
  "points",
  "subtotalGroup",
  "subtotal",
  "cropSubtotal",
  "examStudent",
  "examStudentStatus",
  "studentAnswerImage",
  "examClassroom",
  "examClassroomRenumber",
  "examClassroomTeacherStats",
  "examClassroomStudentReport",
  "graderAssignmentByQuestion",
  "graderAssignmentByStudent",
  "omr",
  "omrChoiceOption",
  "compoundAnswer",
] as const
export type ExamSetupTermId = (typeof EXAM_SETUP_TERM_IDS)[number]

const areaTypeValue = (storedValue: string) =>
  value("CropRegion", "type", storedValue, AREA_TYPES)

export const EXAM_SETUP_CATEGORY: GlossaryCategory<ExamSetupTermId> = {
  id: "examSetup",
  termIds: EXAM_SETUP_TERM_IDS,
  codeRefs: {
    exam: [table("Exam"), column("Exam", "examName")],
    examReferenceDate: [column("Exam", "referenceDate")],
    examMember: [table("UserExam"), column("UserExam", "role")],
    roleOwner: [value("UserExam", "role", "OWNER", EXAM_ROLES)],
    roleEditor: [
      value("UserExam", "role", "EDITOR", EXAM_ROLES),
      column("UserExam", "canExportResults"),
    ],
    roleViewer: [value("UserExam", "role", "VIEWER", EXAM_ROLES)],
    anonymousScoring: [column("Exam", "anonymousScoringEnforced")],
    examPage: [
      table("ExamPage"),
      column("ExamPage", "pageNumber"),
      column("ExamPage", "imagePath"),
    ],
    markerCorrection: [column("Exam", "markerCorrectionEnabled")],
    cropRegion: [table("CropRegion")],
    cropRegionType: [
      column("CropRegion", "type"),
      identifier("CropRegionAreaType", AREA_TYPES),
    ],
    question: [areaTypeValue("QUESTION_ANSWER")],
    studentNameArea: [areaTypeValue("STUDENT_NAME")],
    studentIdArea: [areaTypeValue("STUDENT_ID")],
    totalScoreArea: [areaTypeValue("TOTAL_SCORE")],
    subtotalArea: [areaTypeValue("SUBTOTAL_SCORE")],
    regionLabel: [
      column("CropRegion", "label"),
      column("CropRegion", "orderIndex"),
    ],
    points: [column("CropRegion", "points")],
    subtotalGroup: [table("SubtotalGroup"), table("ExamSubtotalGroup")],
    subtotal: [table("Subtotal"), column("Subtotal", "subtotalGroupId")],
    cropSubtotal: [
      table("CropSubtotal"),
      column("CropSubtotal", "assignmentType"),
    ],
    examStudent: [
      table("ExamStudent"),
      column("ExamStudent", "studentId"),
      column("ExamStudent", "customOrder"),
    ],
    examStudentStatus: [
      column("ExamStudent", "status"),
      value("ExamStudent", "status", "participating", EXAM_STUDENT_STATUSES),
      value("ExamStudent", "status", "expected", EXAM_STUDENT_STATUSES),
      value("ExamStudent", "status", "absent", EXAM_STUDENT_STATUSES),
    ],
    studentAnswerImage: [
      table("StudentAnswerImage"),
      column("StudentAnswerImage", "imagePath"),
    ],
    examClassroom: [table("ExamClassroom"), column("ExamClassroom", "order")],
    examClassroomRenumber: [column("ExamClassroom", "administered")],
    examClassroomTeacherStats: [column("ExamClassroom", "teacherStatistics")],
    examClassroomStudentReport: [column("ExamClassroom", "studentReport")],
    graderAssignmentByQuestion: [table("CropRegionAssignment")],
    graderAssignmentByStudent: [table("ExamStudentAssignment")],
    omr: [
      table("CropRegionOmrConfig"),
      column("CropRegionOmrConfig", "numChoices"),
    ],
    omrChoiceOption: [
      table("CropRegionOmrChoiceOption"),
      column("CropRegionOmrChoiceOption", "isCorrect"),
    ],
    compoundAnswer: [
      table("CompoundAnswer"),
      table("CompoundAnswerMember"),
      table("CompoundAnswerScore"),
    ],
  },
}
