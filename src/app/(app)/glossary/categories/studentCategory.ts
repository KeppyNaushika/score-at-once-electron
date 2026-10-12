import { column, table } from "../codeRefBuilders"
import type { GlossaryCategory } from "../types"

export const STUDENT_TERM_IDS = [
  "student",
  "studentNumber",
  "studentKana",
] as const
export type StudentTermId = (typeof STUDENT_TERM_IDS)[number]

export const STUDENT_CATEGORY: GlossaryCategory<StudentTermId> = {
  id: "student",
  termIds: STUDENT_TERM_IDS,
  codeRefs: {
    student: [
      table("Student"),
      column("Student", "lastName"),
      column("Student", "firstName"),
    ],
    studentNumber: [column("Student", "studentNumber")],
    studentKana: [
      column("Student", "lastNameKana"),
      column("Student", "firstNameKana"),
    ],
  },
}
