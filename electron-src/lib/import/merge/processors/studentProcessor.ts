/**
 * 生徒のID統合処理
 *
 * どの生徒とどの生徒が同じ人かを決めるのがここ（ID一致・学籍番号一致・氏名一致・人の判断）。
 * **同じ人だと決まった行の値をどうするかは importValuePolicy に一本化されている**
 * （上書きする／統合する／別で追加する）。項目ごとの選択は持たない。
 */

import type {
  FileOverviewData,
  IdIntegrationConfig,
} from "../../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
import type { ImportValuePolicy } from "../importValuePolicy"
import { replacementUpdatedAt } from "../importValuePolicy"
import type {
  IdChangeTarget,
  IdMappings,
  ImportCounts,
  PrismaTransaction,
} from "../types"
import { runIdIntegration } from "./idIntegrationRunner"

/** アーカイブ側の生徒1行 */
type ArchiveStudent = ExtractedArchiveData["studentsData"]["students"][number]

/**
 * 同じ人だと決まった既存の生徒へ、アーカイブの値を規則に従って書き込む。
 *
 * Student の列は id / studentNumber / lastName / firstName / lastNameKana /
 * firstNameKana / enrollmentYear / createdAt / updatedAt で全部。
 * id と createdAt は動かさない。列を足したらここにも足すこと。
 */
async function applyStudentColumns(
  importStudent: ArchiveStudent,
  existingId: string,
  policy: ImportValuePolicy,
  counts: ImportCounts,
  tx: PrismaTransaction
): Promise<void> {
  const existing = await tx.student.findUnique({ where: { id: existingId } })
  if (!existing) return

  const updatedAt = replacementUpdatedAt(
    policy,
    importStudent.updatedAt,
    existing.updatedAt
  )
  if (!updatedAt) return

  await tx.student.update({
    where: { id: existingId },
    data: {
      studentNumber: importStudent.studentNumber,
      lastName: importStudent.lastName,
      firstName: importStudent.firstName,
      lastNameKana: importStudent.lastNameKana ?? null,
      firstNameKana: importStudent.firstNameKana ?? null,
      enrollmentYear: importStudent.enrollmentYear ?? null,
      updatedAt,
    },
  })
  counts.updated.students++
}

/**
 * 生徒のID統合処理を実行
 */
export async function processStudentIdIntegration(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  config: IdIntegrationConfig["student"],
  idMappings: IdMappings,
  idChangeTargets: IdChangeTarget[],
  counts: ImportCounts,
  warnings: string[],
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  const studentPreMatch = preMatchResult.student

  await runIdIntegration({
    category: "student",
    countKey: "students",
    importRowById: new Map(
      data.studentsData.students.map((student) => [student.id, student])
    ),
    idMatchedItems: studentPreMatch.byId,
    matchedItemGroups: [
      // 学籍番号一致
      {
        matchedItems: studentPreMatch.byStudentNumber,
        sameRowStrategy: "by_student_number",
        skipAlreadyMapped: false,
      },
      // 氏名一致。学籍番号一致で既に処理済みのものは飛ばす
      {
        matchedItems: studentPreMatch.byName,
        sameRowStrategy: "by_name",
        skipAlreadyMapped: true,
      },
    ],
    noMatchItems: studentPreMatch.noMatch,
    config,
    idMappings,
    idChangeTargets,
    counts,
    warnings,
    describeRow: (importStudent) =>
      `生徒「${importStudent.lastName} ${importStudent.firstName}」`,
    applyColumns: (importStudent, existingId) =>
      applyStudentColumns(importStudent, existingId, policy, counts, tx),
    createNewRow: async (importStudent, importId) => {
      const existingById = await tx.student.findUnique({
        where: { id: importId },
      })
      if (existingById) {
        idMappings.student[importId] = importId
        return
      }
      await tx.student.create({
        data: {
          id: importId,
          studentNumber: importStudent.studentNumber,
          lastName: importStudent.lastName,
          firstName: importStudent.firstName,
          lastNameKana: importStudent.lastNameKana ?? null,
          firstNameKana: importStudent.firstNameKana ?? null,
          enrollmentYear: importStudent.enrollmentYear ?? null,
          ...policy.createdTimestamps(importStudent),
        },
      })
      idMappings.student[importId] = importId
      counts.created.students++
    },
  })
}
