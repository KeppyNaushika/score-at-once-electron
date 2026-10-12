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

  await runIdIntegration({
    category: "classroom",
    countKey: "classrooms",
    importRowById: new Map(
      data.classesData.classrooms.map((classroom) => [classroom.id, classroom])
    ),
    idMatchedItems: classroomPreMatch.byId,
    matchedItemGroups: [
      // 名前一致
      {
        matchedItems: classroomPreMatch.byName,
        sameRowStrategy: "by_name",
        skipAlreadyMapped: false,
      },
    ],
    noMatchItems: classroomPreMatch.noMatch,
    config,
    idMappings,
    idChangeTargets,
    counts,
    warnings,
    describeRow: (importClassroom) => `学級「${importClassroom.name}」`,
    applyColumns: (importClassroom, existingId) =>
      applyClassroomColumns(importClassroom, existingId, policy, counts, tx),
    createNewRow: async (importClassroom, importId) => {
      const existingById = await tx.classroom.findUnique({
        where: { id: importId },
      })
      if (existingById) {
        idMappings.classroom[importId] = importId
        return
      }
      await tx.classroom.create({
        data: {
          id: importId,
          name: importClassroom.name,
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
    },
  })
}
