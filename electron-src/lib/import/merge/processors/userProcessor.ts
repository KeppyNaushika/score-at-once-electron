/**
 * 採点者（利用者）のID統合処理
 *
 * アーカイブの採点者が、このPCのどの利用者なのかを決める。答えは
 * **「既存の利用者に結ぶ」か「新しく作る」の2つだけ**で、「取り込まない」は無い ——
 * 採点行は採点者を親に持つので、結ばずに置くと行が親を失う。
 *
 * - **id が一致すれば同じ利用者**。事前照合の結果ではなく、実行の時点で id を引いて決め、
 *   人の判断は当てない
 * - 同じ利用者だと決まった行には、生徒・学級と同じく取り込みの規則（importValuePolicy）で
 *   利用者名・氏名・役割を書く。**パスコードはアーカイブに無く、書かない**
 * - 1人の既存の利用者に結ぶアーカイブの採点者は1人だけ（2人の採点が1人の行に混ざる）。
 *   既に他の採点者が取った利用者には結ばず、新しく作って警告に残す
 */

import type {
  FileOverviewData,
  IdIntegrationConfig,
  IdIntegrationDecision,
} from "../../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
import type { ImportValuePolicy } from "../importValuePolicy"
import { replacementUpdatedAt } from "../importValuePolicy"
import type { IdMappings, ImportCounts, PrismaTransaction } from "../types"

/** アーカイブ側の利用者1行 */
type ArchiveUser = ExtractedArchiveData["usersData"]["users"][number]

/**
 * 採点者のID統合処理を実行
 *
 * 判断が要るのは「id が一致しない採点者」だけで、同じPCから取り込むかぎり
 * 全員が byId に入る（＝画面には何も出ない）。
 */
export async function processUserIdIntegration(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  config: IdIntegrationConfig["user"],
  idMappings: IdMappings,
  counts: ImportCounts,
  warnings: string[],
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  const userPreMatch = preMatchResult.user
  if (!userPreMatch) return

  const archiveUserById = new Map(
    data.usersData.users.map((archiveUser) => [archiveUser.id, archiveUser])
  )
  /** 既存の利用者 → それに結んだアーカイブの採点者 */
  const claimedBy = new Map<string, string>()

  /**
   * 同じ利用者だと決まった既存の行へ、利用者名・氏名・役割を規則に従って書く。
   * User の列は id / username / passcode / name / role / passcodeType / createdAt / updatedAt。
   * id と createdAt は動かさない。passcode・passcodeType はアーカイブに無いので書かない
   */
  const linkUser = async (
    archiveUser: ArchiveUser,
    existingId: string
  ): Promise<void> => {
    idMappings.user[archiveUser.id] = existingId
    claimedBy.set(existingId, archiveUser.id)
    const existing = await tx.user.findUnique({ where: { id: existingId } })
    if (!existing) return
    const updatedAt = replacementUpdatedAt(
      policy,
      archiveUser.updatedAt,
      existing.updatedAt
    )
    if (!updatedAt) return
    await tx.user.update({
      where: { id: existingId },
      data: {
        username: archiveUser.username,
        name: archiveUser.name,
        role: archiveUser.role,
        updatedAt,
      },
    })
    counts.updated.users++
  }

  // 採点者のうち、取り込み先に同じ id の利用者が居るものは同じ利用者（実行の時点で引く）
  const graderIds = [
    ...userPreMatch.byId,
    ...(userPreMatch.byName ?? []),
    ...userPreMatch.noMatch,
  ].map((item) => item.importId)
  for (const graderId of graderIds) {
    if (idMappings.user[graderId]) continue
    if (!(await tx.user.findUnique({ where: { id: graderId } }))) continue
    const archiveUser = archiveUserById.get(graderId)
    if (archiveUser) {
      await linkUser(archiveUser, graderId)
    } else {
      // 古いアーカイブは採点者の行を持たないことがある。id が一致すれば同じ利用者
      idMappings.user[graderId] = graderId
      claimedBy.set(graderId, graderId)
    }
  }

  /** 新しい利用者として作る（取り込み先にその id が無いことは確かめてある） */
  const createUser = async (archiveUser: ArchiveUser): Promise<void> => {
    // 利用者名に unique は無いので、重複回避の連番は付けない（同じ名前が並ぶのが正常）。
    // パスコードは持ち回らないので、この利用者はログイン手段を持たない状態で作られる。
    // 採点行の持ち主として在ることが目的で、あとから設定画面で足せる
    await tx.user.create({
      data: {
        id: archiveUser.id,
        username: archiveUser.username,
        name: archiveUser.name,
        role: archiveUser.role,
        ...policy.createdTimestamps(archiveUser),
      },
    })
    idMappings.user[archiveUser.id] = archiveUser.id
    counts.created.users++
    warnings.push(
      `採点者「${archiveUser.name}（${archiveUser.username}）」をこのPCのユーザーとして新しく作りました。ログイン用のパスコードは引き継がれません。`
    )
  }

  const processDecision = async (
    importId: string,
    decision: IdIntegrationDecision | undefined,
    defaultExistingId: string | undefined
  ): Promise<void> => {
    const archiveUser = archiveUserById.get(importId)
    if (!archiveUser || idMappings.user[importId]) return

    if (decision?.decisionType === "same_person") {
      const existingId = decision.existingId || defaultExistingId
      const claimant = existingId ? claimedBy.get(existingId) : undefined
      if (
        existingId &&
        (claimant === undefined || claimant === importId) &&
        (await tx.user.findUnique({ where: { id: existingId } }))
      ) {
        await linkUser(archiveUser, existingId)
        return
      }
      warnings.push(
        existingId && claimant !== undefined && claimant !== importId
          ? `採点者「${archiveUser.name}（${archiveUser.username}）」の結び付け先は、取り込む別の採点者が既に使っているため、新しく作りました。`
          : `採点者「${archiveUser.name}（${archiveUser.username}）」の結び付け先が見つからないため、新しく作りました。`
      )
    }

    // 「取り込まない」は無い。決めていないもの・結び付け先を失ったものは作る
    await createUser(archiveUser)
  }

  // 利用者名が一致したもの
  for (const match of userPreMatch.byName ?? []) {
    if (idMappings.user[match.importId]) continue
    const decision = config.decisions.find(
      (candidate) => candidate.importId === match.importId
    )
    if (decision) {
      await processDecision(match.importId, decision, match.existingId)
      continue
    }
    // 既定は紐づけ方法に従う。all_new のときだけ別人として作る
    await processDecision(
      match.importId,
      config.strategy === "all_new"
        ? { importId: match.importId, decisionType: "create_new" }
        : {
            importId: match.importId,
            decisionType: "same_person",
            existingId: match.existingId,
          },
      match.existingId
    )
  }

  // どれにも当たらないもの（新しく作るか、人が選んだ利用者に結ぶ）。
  // 事前照合で id が一致したのに、実行までに取り込み先から消えた採点者もここで作る
  for (const item of [...userPreMatch.noMatch, ...userPreMatch.byId]) {
    if (idMappings.user[item.importId]) continue
    const decision = config.decisions.find(
      (candidate) => candidate.importId === item.importId
    )
    await processDecision(item.importId, decision, undefined)
  }
}
