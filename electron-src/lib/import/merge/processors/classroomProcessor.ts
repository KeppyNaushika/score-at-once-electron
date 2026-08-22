/**
 * 学級のID統合処理
 *
 * どの学級とどの学級が同じかを決めるのがここ。
 * **同じだと決まった行の値をどうするかは importValuePolicy に一本化されている**
 * （上書きする／統合する／別で追加する）。項目ごとの選択は持たない。
 */

import type {
  FileOverviewData,
  IdIntegrationConfig,
  IdIntegrationDecision,
} from "../../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
import { generateUniqueClassName } from "../../exam-archive/uniqueNameGenerators"
import type { ImportValuePolicy } from "../importValuePolicy"
import { replacementUpdatedAt } from "../importValuePolicy"
import type {
  IdChangeTarget,
  IdMappings,
  ImportCounts,
  PrismaTransaction,
} from "../types"

/** アーカイブ側の学級1行 */
type ArchiveClassroom =
  ExtractedArchiveData["classesData"]["classrooms"][number]

/**
 * 同じだと決まった既存の学級へ、アーカイブの値を規則に従って書き込む。
 *
 * Classroom の列は id / name / classroomCode / grade / description / isVisible /
 * createdAt / updatedAt で全部。id と createdAt は動かさない。
 * 列を足したらここにも足すこと。
 *
 * **isVisible もこの規則に含める。** 非表示にしてある学級でも、アーカイブ側の方が後に
 * 書かれていれば表示へ戻る（それが書いた人の操作の希望だから）。作成時に
 * `isVisible ?? true` としているのも同じ考えで、アーカイブに書かれた通りにする。
 */
async function applyClassroomColumns(
  importClassroom: ArchiveClassroom,
  existingId: string,
  policy: ImportValuePolicy,
  counts: ImportCounts,
  tx: PrismaTransaction
): Promise<void> {
  const existing = await tx.classroom.findUnique({ where: { id: existingId } })
  if (!existing) return

  const updatedAt = replacementUpdatedAt(
    policy,
    importClassroom.updatedAt,
    existing.updatedAt
  )
  if (!updatedAt) return

  await tx.classroom.update({
    where: { id: existingId },
    data: {
      name: importClassroom.name,
      classroomCode: importClassroom.classroomCode ?? null,
      grade: importClassroom.grade ?? null,
      description: importClassroom.description ?? null,
      isVisible: importClassroom.isVisible ?? true,
      updatedAt,
    },
  })
  counts.updated.classrooms++
}

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
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  const classroomPreMatch = preMatchResult.classroom
  const importClassroomById = new Map(
    data.classesData.classrooms.map((classroom) => [classroom.id, classroom])
  )

  // ID一致したもの。同じ学級なので値も規則に従って書き込む
  for (const match of classroomPreMatch.byId) {
    idMappings.classroom[match.importId] = match.existingId
    const importClassroom = importClassroomById.get(match.importId)
    if (importClassroom) {
      await applyClassroomColumns(
        importClassroom,
        match.existingId,
        policy,
        counts,
        tx
      )
    }
  }

  const processDecision = async (
    importId: string,
    decision: IdIntegrationDecision | undefined,
    defaultExistingId: string | undefined
  ) => {
    const importClassroom = importClassroomById.get(importId)
    if (!importClassroom) return

    if (!decision || decision.decisionType === "create_new") {
      const uniqueName = await generateUniqueClassName(tx, importClassroom.name)

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
            classroomCode: importClassroom.classroomCode ?? null,
            grade: importClassroom.grade ?? null,
            description: importClassroom.description ?? null,
            // 表示設定もアーカイブに書かれた通りにする（規則の対象。
            // applyClassroomColumns の説明を参照）
            isVisible: importClassroom.isVisible ?? true,
            ...policy.createdTimestamps(importClassroom),
          },
        })
        idMappings.classroom[importId] = importId
        counts.created.classrooms++

        if (uniqueName !== importClassroom.name) {
          warnings.push(
            `学級「${importClassroom.name}」を「${uniqueName}」として新規作成しました（重複回避）`
          )
        }
      }
    } else if (decision.decisionType === "same_person") {
      const existingId = decision.existingId || defaultExistingId
      if (!existingId) {
        warnings.push(`学級「${importClassroom.name}」の既存IDが見つかりません`)
        return
      }

      idMappings.classroom[importId] = existingId
      await applyClassroomColumns(
        importClassroom,
        existingId,
        policy,
        counts,
        tx
      )

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
  if (classroomPreMatch.byName) {
    for (const match of classroomPreMatch.byName) {
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
  for (const item of classroomPreMatch.noMatch) {
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
