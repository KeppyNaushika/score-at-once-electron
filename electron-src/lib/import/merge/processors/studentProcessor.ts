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
  IdIntegrationDecision,
} from "../../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
import { generateUniqueStudentNumber } from "../../exam-archive/uniqueNameGenerators"
import type { ImportValuePolicy } from "../importValuePolicy"
import { replacementUpdatedAt } from "../importValuePolicy"
import type {
  IdChangeTarget,
  IdMappings,
  ImportCounts,
  PrismaTransaction,
} from "../types"

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
  const importStudentById = new Map(
    data.studentsData.students.map((student) => [student.id, student])
  )

  // ID一致したもの（自動で紐づく）。同じ人なので値も規則に従って書き込む
  for (const match of studentPreMatch.byId) {
    idMappings.student[match.importId] = match.existingId
    const importStudent = importStudentById.get(match.importId)
    if (importStudent) {
      await applyStudentColumns(
        importStudent,
        match.existingId,
        policy,
        counts,
        tx
      )
    }
  }

  // ID不一致のものを処理
  const processDecision = async (
    importId: string,
    decision: IdIntegrationDecision | undefined,
    defaultExistingId: string | undefined
  ) => {
    const importStudent = importStudentById.get(importId)
    if (!importStudent) return

    if (!decision || decision.decisionType === "create_new") {
      const uniqueStudentNumber = await generateUniqueStudentNumber(
        tx,
        importStudent.studentNumber
      )

      const existingById = await tx.student.findUnique({
        where: { id: importId },
      })
      if (existingById) {
        idMappings.student[importId] = importId
      } else {
        await tx.student.create({
          data: {
            id: importId,
            studentNumber: uniqueStudentNumber,
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

        if (uniqueStudentNumber !== importStudent.studentNumber) {
          warnings.push(
            `生徒「${importStudent.lastName} ${importStudent.firstName}」の学籍番号を「${uniqueStudentNumber}」として新規作成しました（重複回避）`
          )
        }
      }
    } else if (decision.decisionType === "same_person") {
      const existingId = decision.existingId || defaultExistingId
      if (!existingId) {
        warnings.push(
          `生徒「${importStudent.lastName} ${importStudent.firstName}」の既存IDが見つかりません`
        )
        return
      }

      idMappings.student[importId] = existingId
      await applyStudentColumns(importStudent, existingId, policy, counts, tx)

      if (decision.idChoice === "use_import_id") {
        // Stage 2でID変更を行う
        idChangeTargets.push({
          category: "student",
          existingId: existingId,
          newId: importId,
        })
      }
    } else if (decision.decisionType === "skip") {
      counts.skipped.students++
    }
  }

  // 学籍番号一致
  if (studentPreMatch.byStudentNumber) {
    for (const match of studentPreMatch.byStudentNumber) {
      const decision = config.decisions.find(
        (decision) => decision.importId === match.importId
      )

      // strategyに応じたデフォルト処理
      if (config.strategy === "by_student_number") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "same_person",
            existingId: match.existingId,
            idChoice: "use_existing_id",
          },
          match.existingId
        )
      } else if (config.strategy === "all_new") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "create_new",
          },
          undefined
        )
      } else {
        await processDecision(match.importId, decision, match.existingId)
      }
    }
  }

  // 氏名一致
  if (studentPreMatch.byName) {
    for (const match of studentPreMatch.byName) {
      // byStudentNumberで既に処理済みの場合はスキップ
      if (idMappings.student[match.importId]) continue

      const decision = config.decisions.find(
        (decision) => decision.importId === match.importId
      )

      if (config.strategy === "by_name") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "same_person",
            existingId: match.existingId,
            idChoice: "use_existing_id",
          },
          match.existingId
        )
      } else if (config.strategy === "all_new") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "create_new",
          },
          undefined
        )
      } else {
        await processDecision(match.importId, decision, match.existingId)
      }
    }
  }

  // どれにも一致しない
  for (const item of studentPreMatch.noMatch) {
    if (idMappings.student[item.importId]) continue

    const decision = config.decisions.find(
      (decision) => decision.importId === item.importId
    )
    await processDecision(
      item.importId,
      decision || {
        importId: item.importId,
        decisionType: "create_new",
      },
      undefined
    )
  }
}
