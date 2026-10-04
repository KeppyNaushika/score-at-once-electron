/**
 * @fileoverview 監査ログの対象（`AuditLogTarget`）の組み立て
 * @description 記録側がどこから書いても、同じ実体には同じ種類・同じラベルの形で
 *   対象が付くよう、組み立てをここに集める。ラベルは表示用のスナップショットで、
 *   対象が後で削除されてもログに残る（docs/audit-log-redesign.md「削除耐性の原則」）。
 */

import type { CropRegion, Student } from "@prisma/client"

import type { AuditTargetInput } from "./auditLog"

/** 生徒の表示ラベル（「姓 名」） */
export const studentAuditLabel = (student: Student): string =>
  `${student.lastName} ${student.firstName}`.trim()

/** 生徒を対象にする（`Student.id` で記録する。`ExamStudent.id` ではない） */
export const studentAuditTarget = (student: Student): AuditTargetInput => ({
  targetType: "Student",
  targetId: student.id,
  targetLabel: studentAuditLabel(student) || null,
})

/** 採点領域を対象にする */
export const cropRegionAuditTarget = (
  cropRegion: CropRegion
): AuditTargetInput => ({
  targetType: "CropRegion",
  targetId: cropRegion.id,
  targetLabel: cropRegion.label || null,
})
