/**
 * 生徒のID統合処理
 */

import type {
  FileOverviewData,
  IdIntegrationConfig,
  IdIntegrationDecision,
  UpdateDecisions,
} from "../../../../../types/projectArchive.types"
import type { ExtractedArchiveData } from "../../project-archive/archiveExtractor"
import { generateUniqueStudentNumber } from "../../project-archive/uniqueNameGenerators"
import type {
  IdChangeTarget,
  IdMappings,
  ImportCounts,
  PrismaTransaction,
} from "../types"

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
  tx: PrismaTransaction,
  updateDecisions?: UpdateDecisions
): Promise<void> {
  const studentPreMatch = preMatchResult.student

  // ID一致したもの（自動で紐づく）
  for (const match of studentPreMatch.byId) {
    idMappings.student[match.importId] = match.existingId
  }

  // ID不一致のものを処理
  const processDecision = async (
    importId: string,
    decision: IdIntegrationDecision | undefined,
    defaultExistingId: string | undefined
  ) => {
    const importStudent = data.studentsData.students.find(
      (s) => s.id === importId
    )
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

      // フィールド更新処理
      const updateKey = `student:${importId}`
      const fieldDecisions = updateDecisions?.[updateKey]
      if (fieldDecisions && importStudent) {
        const updateData: Record<string, unknown> = {}
        const fieldMap: Record<string, unknown> = {
          lastName: importStudent.lastName,
          firstName: importStudent.firstName,
          lastNameKana: importStudent.lastNameKana,
          firstNameKana: importStudent.firstNameKana,
          studentNumber: importStudent.studentNumber,
          enrollmentYear: importStudent.enrollmentYear,
        }
        for (const [field, strategy] of Object.entries(fieldDecisions)) {
          if (strategy === "use_import" && field in fieldMap) {
            updateData[field] = fieldMap[field]
          } else if (strategy === "use_newer" && field in fieldMap) {
            const importUpdatedAt = importStudent.updatedAt
              ? new Date(importStudent.updatedAt)
              : null
            if (importUpdatedAt) {
              const existing = await tx.student.findUnique({
                where: { id: existingId },
              })
              if (existing && importUpdatedAt > existing.updatedAt) {
                updateData[field] = fieldMap[field]
              }
            }
          }
        }
        if (Object.keys(updateData).length > 0) {
          await tx.student.update({
            where: { id: existingId },
            data: updateData,
          })
          counts.updated.students++
        }
      }

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
        (d) => d.importId === match.importId
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
        (d) => d.importId === match.importId
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

    const decision = config.decisions.find((d) => d.importId === item.importId)
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
