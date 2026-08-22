/**
 * 採点者（利用者）のID統合処理
 *
 * アーカイブの採点者が、このPCのどの利用者なのかを決める。答えは
 * **「既存の利用者に結ぶ」か「新しく作る」の2つだけ**で、「取り込まない」は無い ——
 * 採点行は採点者を親に持つので、結ばずに置くと行が親を失う。
 *
 * **既存の利用者の列は書き換えない。** 生徒や学級と違い、利用者はこの試験の持ち物では
 * なく、アーカイブは「この人が採点した」と言っているだけである。氏名や役割まで
 * アーカイブの値へ倒すと、取り込みが人のアカウント設定を書き換えることになる。
 * ここで要るのは、採点行の親として在ることだけ。
 */

import type {
  FileOverviewData,
  IdIntegrationConfig,
  IdIntegrationDecision,
} from "../../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
import type { ImportValuePolicy } from "../importValuePolicy"
import type { IdMappings, ImportCounts, PrismaTransaction } from "../types"

/** アーカイブ側の利用者1行 */
type ArchiveUser = ExtractedArchiveData["usersData"]["users"][number]

/**
 * 採点者のID統合処理を実行
 *
 * 判断が要るのは「id が一致しない採点者」だけで、同じパソコンから取り込むかぎり
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

  // id が一致した採点者はそのまま（同じパソコンで作ったデータ）
  for (const match of userPreMatch.byId) {
    idMappings.user[match.importId] = match.existingId
  }

  /** 新しい利用者として作る。既に同じ id が居るなら、それを使う（冪等） */
  const createUser = async (archiveUser: ArchiveUser): Promise<void> => {
    const existingById = await tx.user.findUnique({
      where: { id: archiveUser.id },
    })
    if (existingById) {
      idMappings.user[archiveUser.id] = existingById.id
      return
    }

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
      `採点者「${archiveUser.name}（${archiveUser.username}）」をこのパソコンの利用者として新しく作りました。ログイン用のパスコードは引き継がれません。`
    )
  }

  const processDecision = async (
    importId: string,
    decision: IdIntegrationDecision | undefined,
    defaultExistingId: string | undefined
  ): Promise<void> => {
    const archiveUser = archiveUserById.get(importId)
    if (!archiveUser) return

    if (decision?.decisionType === "same_person") {
      const existingId = decision.existingId || defaultExistingId
      if (existingId) {
        idMappings.user[importId] = existingId
        return
      }
      warnings.push(
        `採点者「${archiveUser.name}（${archiveUser.username}）」の結び付け先が見つからないため、新しく作りました。`
      )
    }

    // 「取り込まない」は無い。決めていないもの・結び付け先を失ったものは作る
    await createUser(archiveUser)
  }

  // 利用者名が一致したもの
  for (const match of userPreMatch.byName ?? []) {
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

  // どれにも当たらないもの（新しく作るしかない）
  for (const item of userPreMatch.noMatch) {
    if (idMappings.user[item.importId]) continue
    const decision = config.decisions.find(
      (candidate) => candidate.importId === item.importId
    )
    await processDecision(item.importId, decision, undefined)
  }
}
