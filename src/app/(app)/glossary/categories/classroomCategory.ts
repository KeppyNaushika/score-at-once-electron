import { column, identifier, table } from "../codeRefBuilders"
import type { GlossaryCategory } from "../types"

export const CLASSROOM_TERM_IDS = [
  "classroom",
  "classroomCode",
  "classroomMembership",
  "membershipPhase",
  "attendanceNumber",
] as const
export type ClassroomTermId = (typeof CLASSROOM_TERM_IDS)[number]

export const CLASSROOM_CATEGORY: GlossaryCategory<ClassroomTermId> = {
  id: "classroom",
  termIds: CLASSROOM_TERM_IDS,
  codeRefs: {
    classroom: [
      table("Classroom"),
      column("Classroom", "name"),
      column("Classroom", "grade"),
    ],
    classroomCode: [column("Classroom", "classroomCode")],
    classroomMembership: [
      table("StudentClassroomMembership"),
      column("StudentClassroomMembership", "startDate"),
      column("StudentClassroomMembership", "endDate"),
    ],
    membershipPhase: [
      identifier("MembershipPhase", "src/lib/membership.ts"),
      identifier("MEMBERSHIP_PHASE_LABELS", "src/lib/membership.ts"),
    ],
    attendanceNumber: [
      column("StudentClassroomMembership", "attendanceNumber"),
    ],
  },
}
