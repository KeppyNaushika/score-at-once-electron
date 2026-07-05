/**
 * 学級のID統合処理
 */

import type {
  FileOverviewData,
  IdIntegrationConfig,
  IdIntegrationDecision,
  UpdateDecisions,
} from "../../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
import { generateUniqueClassName } from "../../exam-archive/uniqueNameGenerators"
import type {
  IdChangeTarget,
  IdMappings,
  ImportCounts,
  PrismaTransaction,
} from "../types"

/**
 * 学級のID統合処理を実行
 */
export async function processClassroomIdIntegration(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  config: IdIntegrationConfig["classroom"],
  idMappings: IdMappings,
  idChangeTargets: IdChangeTarget[],
  counts: ImportCounts,
  warnings: string[],
  tx: PrismaTransaction,
  updateDecisions?: UpdateDecisions
): Promise<void> {
  const classPreMatch = preMatchResult.classroom

  // ID一致したもの
  for (const match of classPreMatch.byId) {
    idMappings.classroom[match.importId] = match.existingId
  }

  const processDecision = async (
    importId: string,
    decision: IdIntegrationDecision | undefined,
    defaultExistingId: string | undefined
  ) => {
    const importClass = data.classesData.classrooms.find(
      (classroom) => classroom.id === importId
    )
    if (!importClass) return

    if (!decision || decision.decisionType === "create_new") {
      const uniqueName = await generateUniqueClassName(tx, importClass.name)

      const existingById = await tx.classroom.findUnique({
        where: { id: importId },
      })
      if (existingById) {
        idMappings.classroom[importId] = importId
      } else {
        await tx.classroom.create({
          data: {
            id: importId,
            name: uniqueName,
            classCode: importClass.classCode ?? null,
            grade: importClass.grade ?? null,
            description: importClass.description ?? null,
          },
        })
        idMappings.classroom[importId] = importId
        counts.created.classrooms++

        if (uniqueName !== importClass.name) {
          warnings.push(
            `学級「${importClass.name}」を「${uniqueName}」として新規作成しました（重複回避）`
          )
        }
      }
    } else if (decision.decisionType === "same_person") {
      const existingId = decision.existingId || defaultExistingId
      if (!existingId) {
        warnings.push(`学級「${importClass.name}」の既存IDが見つかりません`)
        return
      }

      idMappings.classroom[importId] = existingId

      // フィールド更新処理
      const updateKey = `classroom:${importId}`
      const fieldDecisions = updateDecisions?.[updateKey]
      if (fieldDecisions && importClass) {
        const updateData: Record<string, unknown> = {}
        const fieldMap: Record<string, unknown> = {
          name: importClass.name,
          classCode: importClass.classCode,
          grade: importClass.grade,
          description: importClass.description,
        }
        for (const [field, strategy] of Object.entries(fieldDecisions)) {
          if (strategy === "use_import" && field in fieldMap) {
            updateData[field] = fieldMap[field]
          } else if (strategy === "use_newer" && field in fieldMap) {
            const importUpdatedAt = importClass.updatedAt
              ? new Date(importClass.updatedAt)
              : null
            if (importUpdatedAt) {
              const existing = await tx.classroom.findUnique({
                where: { id: existingId },
              })
              if (existing && importUpdatedAt > existing.updatedAt) {
                updateData[field] = fieldMap[field]
              }
            }
          }
        }
        if (Object.keys(updateData).length > 0) {
          await tx.classroom.update({
            where: { id: existingId },
            data: updateData,
          })
          counts.updated.classrooms++
        }
      }

      if (decision.idChoice === "use_import_id") {
        idChangeTargets.push({
          category: "classroom",
          existingId: existingId,
          newId: importId,
        })
      }
    } else if (decision.decisionType === "skip") {
      counts.skipped.classrooms++
    }
  }

  // 名前一致
  if (classPreMatch.byName) {
    for (const match of classPreMatch.byName) {
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
  for (const item of classPreMatch.noMatch) {
    if (idMappings.classroom[item.importId]) continue

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
