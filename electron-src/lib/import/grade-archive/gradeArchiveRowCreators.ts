/**
 * 成績算出アーカイブの行を、取り込み先の実 id へ付け替えながら書く。
 *
 * **id が一致すれば同じ行。** どの表もまずアーカイブの id で取り込み先を引き、在れば同じ行として
 * 取り込みの規則（importValuePolicy）どおり値を書く。無ければ一意キー（(成績算出, 生徒) など）で
 * 引き、それも無ければアーカイブの id で作る（`writeIdFirstRow`）。同じ成績算出を取り込み直すと、
 * 別の成績算出が増えるのではなく、元の成績算出へ戻る。
 *
 * 親の持ち物の集合（推定の参照・制約の観点・ラベルの値・混在禁止ラベル）は、親を書いたとき
 * だけ集合ごと入れ替える（行ごとに当てると、減った行が残る）。
 *
 * どれも `importGradeArchive` のトランザクションの中で、成績本体・評価項目を書いた
 * あとに呼ぶ。解決できなかった参照を持つ行は書かず、件数を warnings で伝える。
 */

import type { Prisma } from "@prisma/client"

import { describeAmbiguity, pickOldest } from "../humanKeyMatching"
import type { ImportValuePolicy } from "../merge/importValuePolicy"
import { isUuid, writeIdFirstRow } from "../shared/idFirstRow"
import type { IdMap, LatestGradeArchiveData } from "./gradeArchiveRefResolvers"

/**
 * 名簿（対象生徒）を書く。
 *
 * @returns アーカイブの対象生徒 uuid → 取り込み先の対象者の id
 */
export async function writeGradeStudents(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  gradeId: string,
  studentIdMap: IdMap,
  policy: ImportValuePolicy,
  warnings: string[]
): Promise<IdMap> {
  const gradeStudentIdMap: IdMap = new Map()
  // アーカイブの別々の生徒が取り込み先の同じ生徒へ解決することがある
  // （片方が uuid で、もう片方が学籍番号で当たる場合）。@@unique(gradeId, studentId)
  // があるので、2人目は1人目の対象者へ寄せ、寄せたことを伝える
  const gradeStudentIdByStudentId = new Map<string, string>()
  let mergedGradeStudents = 0
  for (const archiveGradeStudent of archive.gradeStudents) {
    const studentId = studentIdMap.get(archiveGradeStudent.studentId)
    if (!studentId) continue
    const alreadyWritten = gradeStudentIdByStudentId.get(studentId)
    if (alreadyWritten) {
      gradeStudentIdMap.set(archiveGradeStudent.id, alreadyWritten)
      mergedGradeStudents++
      continue
    }
    const pairKey = { gradeId, studentId }
    const written = await writeIdFirstRow({
      archiveId: archiveGradeStudent.id,
      archiveUpdatedAt: archiveGradeStudent.updatedAt,
      policy,
      findById: (id) => tx.gradeStudent.findUnique({ where: { id } }),
      findByKey: () =>
        tx.gradeStudent.findUnique({ where: { gradeId_studentId: pairKey } }),
      create: (id) =>
        tx.gradeStudent.create({
          data: {
            ...(id ? { id } : {}),
            ...pairKey,
            customOrder: archiveGradeStudent.customOrder,
            ...policy.createdTimestamps(archiveGradeStudent),
          },
        }),
      update: (existing, updatedAt, writeKey) =>
        tx.gradeStudent.update({
          where: { id: existing.id },
          data: {
            ...(writeKey ? pairKey : {}),
            customOrder: archiveGradeStudent.customOrder,
            updatedAt,
          },
        }),
    })
    gradeStudentIdMap.set(archiveGradeStudent.id, written.targetId)
    gradeStudentIdByStudentId.set(studentId, written.targetId)
  }
  if (mergedGradeStudents > 0) {
    warnings.push(
      `アーカイブの対象生徒${mergedGradeStudents}名が取り込み先の同じ生徒に一致したため、1名にまとめました`
    )
  }
  return gradeStudentIdMap
}

/** 評価項目を書く。返り値はアーカイブの項目 id → 取り込み先の項目 id */
export async function writeGradeItems(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  gradeId: string,
  policy: ImportValuePolicy
): Promise<IdMap> {
  const gradeItemIdMap: IdMap = new Map()
  for (const archiveGradeItem of archive.gradeItems) {
    const values = {
      gradeId,
      name: archiveGradeItem.name,
      order: archiveGradeItem.order,
    }
    const written = await writeIdFirstRow({
      archiveId: archiveGradeItem.id,
      archiveUpdatedAt: archiveGradeItem.updatedAt,
      policy,
      findById: (id) => tx.gradeItem.findUnique({ where: { id } }),
      create: (id) =>
        tx.gradeItem.create({
          data: {
            ...(id ? { id } : {}),
            ...values,
            ...policy.createdTimestamps(archiveGradeItem),
          },
        }),
      update: (existing, updatedAt) =>
        tx.gradeItem.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        }),
    })
    gradeItemIdMap.set(archiveGradeItem.id, written.targetId)
  }
  return gradeItemIdMap
}

/** 成績境界を書く */
export async function writeGradeItemBoundaries(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  gradeItemIdMap: IdMap,
  policy: ImportValuePolicy
): Promise<void> {
  for (const archiveBoundary of archive.gradeItemBoundaries) {
    const gradeItemId = gradeItemIdMap.get(archiveBoundary.gradeItemId)
    if (!gradeItemId) continue
    const values = {
      gradeItemId,
      label: archiveBoundary.label,
      minPercentage: archiveBoundary.minPercentage,
      order: archiveBoundary.order,
    }
    await writeIdFirstRow({
      archiveId: archiveBoundary.id,
      archiveUpdatedAt: archiveBoundary.updatedAt,
      policy,
      findById: (id) => tx.gradeItemBoundary.findUnique({ where: { id } }),
      create: (id) =>
        tx.gradeItemBoundary.create({
          data: {
            ...(id ? { id } : {}),
            ...values,
            ...policy.createdTimestamps(archiveBoundary),
          },
        }),
      update: (existing, updatedAt) =>
        tx.gradeItemBoundary.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        }),
    })
  }
}

/** データソースの参照先（取り込み先の実 id） */
interface DataSourceRefIdMaps {
  examIdMap: IdMap
  subtotalIdMap: IdMap
  cropRegionIdMap: IdMap
  courseworkItemIdMap: IdMap
  courseworkIdMap: IdMap
}

/** データソースと、その推定の参照を書く */
export async function writeDataSources(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  gradeItemIdMap: IdMap,
  {
    examIdMap,
    subtotalIdMap,
    cropRegionIdMap,
    courseworkItemIdMap,
    courseworkIdMap,
  }: DataSourceRefIdMaps,
  policy: ImportValuePolicy,
  warnings: string[]
): Promise<void> {
  const dataSourceIdMap: IdMap = new Map()
  /** 値を書いた（作った・置き換えた）データソース。推定の参照はこれだけ入れ替える */
  const writtenDataSourceIds = new Set<string>()
  for (const archiveDataSource of archive.gradeDataSources) {
    const gradeItemId = gradeItemIdMap.get(archiveDataSource.gradeItemId)
    if (!gradeItemId) continue
    const values = {
      gradeItemId,
      type: archiveDataSource.type,
      examId: archiveDataSource.examId
        ? (examIdMap.get(archiveDataSource.examId) ?? null)
        : null,
      subtotalId: archiveDataSource.subtotalId
        ? (subtotalIdMap.get(archiveDataSource.subtotalId) ?? null)
        : null,
      cropRegionId: archiveDataSource.cropRegionId
        ? (cropRegionIdMap.get(archiveDataSource.cropRegionId) ?? null)
        : null,
      courseworkItemId: archiveDataSource.courseworkItemId
        ? (courseworkItemIdMap.get(archiveDataSource.courseworkItemId) ?? null)
        : null,
      courseworkId: archiveDataSource.courseworkId
        ? (courseworkIdMap.get(archiveDataSource.courseworkId) ?? null)
        : null,
      name: archiveDataSource.name,
      weight: archiveDataSource.weight,
      order: archiveDataSource.order,
      absentMethod: archiveDataSource.absentMethod,
      absentRatio: archiveDataSource.absentRatio,
      absentOffset: archiveDataSource.absentOffset,
      treatExpectedAsMissing: archiveDataSource.treatExpectedAsMissing,
      estimationMode: archiveDataSource.estimationMode,
    }
    const written = await writeIdFirstRow({
      archiveId: archiveDataSource.id,
      archiveUpdatedAt: archiveDataSource.updatedAt,
      policy,
      findById: (id) => tx.gradeDataSource.findUnique({ where: { id } }),
      create: (id) =>
        tx.gradeDataSource.create({
          data: {
            ...(id ? { id } : {}),
            ...values,
            ...policy.createdTimestamps(archiveDataSource),
          },
        }),
      update: (existing, updatedAt) =>
        tx.gradeDataSource.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        }),
    })
    dataSourceIdMap.set(archiveDataSource.id, written.targetId)
    if (written.kind !== "kept") writtenDataSourceIds.add(written.targetId)
  }

  // 推定の参照は全データソースを書いた後に張る（同一成績内の前方参照があるため）。
  // 参照はデータソースの持ち物の集合なので、書いたデータソースの分だけ入れ替える
  let droppedEstimationSources = 0
  for (const dataSourceId of writtenDataSourceIds) {
    await tx.gradeDataSourceEstimationSource.deleteMany({
      where: { dataSourceId },
    })
  }
  for (const estimationSource of archive.gradeDataSourceEstimationSources) {
    const dataSourceId = dataSourceIdMap.get(estimationSource.dataSourceId)
    const sourceDataSourceId = dataSourceIdMap.get(
      estimationSource.sourceDataSourceId
    )
    if (!dataSourceId || !sourceDataSourceId) {
      droppedEstimationSources++
      continue
    }
    if (
      !writtenDataSourceIds.has(dataSourceId) ||
      dataSourceId === sourceDataSourceId
    ) {
      continue
    }
    const pairKey = { dataSourceId, sourceDataSourceId }
    await writeIdFirstRow({
      archiveId: estimationSource.id,
      archiveUpdatedAt: estimationSource.updatedAt,
      policy,
      findById: (id) =>
        tx.gradeDataSourceEstimationSource.findUnique({ where: { id } }),
      findByKey: () =>
        tx.gradeDataSourceEstimationSource.findUnique({
          where: { dataSourceId_sourceDataSourceId: pairKey },
        }),
      create: (id) =>
        tx.gradeDataSourceEstimationSource.create({
          data: {
            ...(id ? { id } : {}),
            ...pairKey,
            order: estimationSource.order,
            ...policy.createdTimestamps(estimationSource),
          },
        }),
      update: (existing, updatedAt, writeKey) =>
        tx.gradeDataSourceEstimationSource.update({
          where: { id: existing.id },
          data: {
            ...(writeKey ? pairKey : {}),
            order: estimationSource.order,
            updatedAt,
          },
        }),
    })
  }
  if (droppedEstimationSources > 0) {
    warnings.push(
      `欠損推定の参照${droppedEstimationSources}件を解決できなかったため取り込みませんでした。` +
        `該当データソースの推定設定を確認してください。`
    )
  }
}

/**
 * セル3種（上書き・確定値・除外）を書く。名簿に載らなかった生徒（照合できなかった生徒）の
 * セルは書かない。書けてしまうと、どの画面にも出ない孤児が復活する（#962）
 */
export async function writeGradeCells(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  gradeStudentIdMap: IdMap,
  gradeItemIdMap: IdMap,
  policy: ImportValuePolicy,
  warnings: string[]
): Promise<void> {
  let droppedCells = 0
  let unknownFrozenByCells = 0
  const resolveCell = (archiveCell: {
    gradeStudentId: string
    gradeItemId: string
  }): { gradeStudentId: string; gradeItemId: string } | null => {
    const gradeStudentId = gradeStudentIdMap.get(archiveCell.gradeStudentId)
    const gradeItemId = gradeItemIdMap.get(archiveCell.gradeItemId)
    if (!gradeStudentId || !gradeItemId) {
      droppedCells++
      return null
    }
    return { gradeStudentId, gradeItemId }
  }

  for (const archiveOverride of archive.gradeOverrides) {
    const cell = resolveCell(archiveOverride)
    if (!cell) continue
    await writeIdFirstRow({
      archiveId: archiveOverride.id,
      archiveUpdatedAt: archiveOverride.updatedAt,
      policy,
      findById: (id) => tx.gradeOverride.findUnique({ where: { id } }),
      findByKey: () =>
        tx.gradeOverride.findUnique({
          where: { gradeStudentId_gradeItemId: cell },
        }),
      create: (id) =>
        tx.gradeOverride.create({
          data: {
            ...(id ? { id } : {}),
            ...cell,
            overrideLabel: archiveOverride.overrideLabel,
            ...policy.createdTimestamps(archiveOverride),
          },
        }),
      update: (existing, updatedAt, writeKey) =>
        tx.gradeOverride.update({
          where: { id: existing.id },
          data: {
            ...(writeKey ? cell : {}),
            overrideLabel: archiveOverride.overrideLabel,
            updatedAt,
          },
        }),
    })
  }

  for (const archiveFrozenScore of archive.gradeFrozenScores) {
    const cell = resolveCell(archiveFrozenScore)
    if (!cell) continue
    // 確定操作者は取り込み先に同じ User が居る保証が無い。
    // 居なければ null（操作者不明）にして値そのものは残し、件数を伝える
    const frozenByUserId = archiveFrozenScore.frozenByUserId
      ? ((
          await tx.user.findUnique({
            where: { id: archiveFrozenScore.frozenByUserId },
          })
        )?.id ?? null)
      : null
    if (archiveFrozenScore.frozenByUserId && !frozenByUserId) {
      unknownFrozenByCells++
    }
    const values = {
      weightedScore: archiveFrozenScore.weightedScore,
      weightedMaxScore: archiveFrozenScore.weightedMaxScore,
      percentage: archiveFrozenScore.percentage,
      gradeLabel: archiveFrozenScore.gradeLabel,
      frozenByUserId,
      frozenAt: new Date(archiveFrozenScore.frozenAt),
    }
    await writeIdFirstRow({
      archiveId: archiveFrozenScore.id,
      archiveUpdatedAt: archiveFrozenScore.updatedAt,
      policy,
      findById: (id) => tx.gradeFrozenScore.findUnique({ where: { id } }),
      findByKey: () =>
        tx.gradeFrozenScore.findUnique({
          where: { gradeStudentId_gradeItemId: cell },
        }),
      create: (id) =>
        tx.gradeFrozenScore.create({
          data: {
            ...(id ? { id } : {}),
            ...cell,
            ...values,
            ...policy.createdTimestamps(archiveFrozenScore),
          },
        }),
      update: (existing, updatedAt, writeKey) =>
        tx.gradeFrozenScore.update({
          where: { id: existing.id },
          data: { ...(writeKey ? cell : {}), ...values, updatedAt },
        }),
    })
  }

  for (const archiveExclusion of archive.gradeItemExclusions) {
    const cell = resolveCell(archiveExclusion)
    if (!cell) continue
    await writeIdFirstRow({
      archiveId: archiveExclusion.id,
      archiveUpdatedAt: archiveExclusion.updatedAt,
      policy,
      findById: (id) => tx.gradeItemExclusion.findUnique({ where: { id } }),
      findByKey: () =>
        tx.gradeItemExclusion.findUnique({
          where: { gradeStudentId_gradeItemId: cell },
        }),
      create: (id) =>
        tx.gradeItemExclusion.create({
          data: {
            ...(id ? { id } : {}),
            ...cell,
            ...policy.createdTimestamps(archiveExclusion),
          },
        }),
      update: (existing, updatedAt, writeKey) =>
        tx.gradeItemExclusion.update({
          where: { id: existing.id },
          data: { ...(writeKey ? cell : {}), updatedAt },
        }),
    })
  }

  if (droppedCells > 0) {
    warnings.push(
      `対象生徒または成績評価項目を解決できない上書き・固定値・除外設定 ${droppedCells}件を取り込みませんでした`
    )
  }
  if (unknownFrozenByCells > 0) {
    warnings.push(
      `固定したユーザーがこのPCに居ない固定値 ${unknownFrozenByCells}件は、固定した人を不明として取り込みました`
    )
  }
}

/**
 * 観点間の制約ルールを書く。参照を1つでも失うと判定の意味が変わる（集計対象が減れば
 * 平均が動き、空になれば「比較先以外の全項目」という別の設定に化ける）。黙って
 * 別物として動かさず、無効化して再設定を促す。
 *
 * 設定（集計対象の観点・ラベルの値・混在禁止ラベル）は制約の持ち物の集合なので、制約を
 * 書いたときだけ集合ごと入れ替える。各行は id → 一意キー → アーカイブの id で書く
 */
export async function writeGradeConstraints(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  gradeId: string,
  gradeItemIdMap: IdMap,
  policy: ImportValuePolicy,
  warnings: string[]
): Promise<void> {
  for (const archiveConstraint of archive.gradeConstraints) {
    const targetGradeItemId = archiveConstraint.targetGradeItemId
      ? (gradeItemIdMap.get(archiveConstraint.targetGradeItemId) ?? null)
      : null
    const lostTarget =
      archiveConstraint.targetGradeItemId !== null && targetGradeItemId === null

    const archiveViewpoints = archive.gradeConstraintViewpoints
      .filter((viewpoint) => viewpoint.constraintId === archiveConstraint.id)
      .sort((left, right) => left.order - right.order)
    const resolvedViewpoints = archiveViewpoints.flatMap((viewpoint) => {
      const gradeItemId = gradeItemIdMap.get(viewpoint.gradeItemId)
      return gradeItemId ? [{ viewpoint, gradeItemId }] : []
    })
    const lostViewpoint = resolvedViewpoints.length !== archiveViewpoints.length

    const brokenReason = lostTarget
      ? "取り込み時に比較先の成績評価項目を解決できなかったため無効化しました。再設定してください。"
      : lostViewpoint
        ? "取り込み時に集計対象の観点を解決できなかったため無効化しました。再設定してください。"
        : archiveConstraint.disabledReason
    if (lostTarget || lostViewpoint) {
      warnings.push(`制約ルール「${archiveConstraint.name}」: ${brokenReason}`)
    }

    const values = {
      gradeId,
      name: archiveConstraint.name,
      kind: archiveConstraint.kind,
      targetGradeItemId,
      aggregate: archiveConstraint.aggregate,
      tolerance: archiveConstraint.tolerance,
      expression: archiveConstraint.expression,
      color: archiveConstraint.color,
      // 診断は disabledReason へ。message は教員が書いた違反の説明で、
      // 結果表のツールチップに出るため汚さない。
      message: archiveConstraint.message,
      disabledReason: brokenReason,
      enabled: archiveConstraint.enabled && !brokenReason,
      order: archiveConstraint.order,
    }
    const written = await writeIdFirstRow({
      archiveId: archiveConstraint.id,
      archiveUpdatedAt: archiveConstraint.updatedAt,
      policy,
      findById: (id) => tx.gradeConstraint.findUnique({ where: { id } }),
      create: (id) =>
        tx.gradeConstraint.create({
          data: {
            ...(id ? { id } : {}),
            ...values,
            ...policy.createdTimestamps(archiveConstraint),
          },
        }),
      update: (existing, updatedAt) =>
        tx.gradeConstraint.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        }),
    })
    if (written.kind === "kept") continue
    const constraintId = written.targetId

    // 集計対象の観点
    await tx.gradeConstraintViewpoint.deleteMany({ where: { constraintId } })
    // 同じ観点は1行だけ（`@@unique`）。重複していれば先に出てきた方を残す
    const writtenGradeItemIds = new Set<string>()
    for (const { viewpoint, gradeItemId } of resolvedViewpoints) {
      if (writtenGradeItemIds.has(gradeItemId)) continue
      writtenGradeItemIds.add(gradeItemId)
      await tx.gradeConstraintViewpoint.create({
        data: {
          ...(isUuid(viewpoint.id) &&
          !(await tx.gradeConstraintViewpoint.findUnique({
            where: { id: viewpoint.id },
          }))
            ? { id: viewpoint.id }
            : {}),
          constraintId,
          gradeItemId,
          order: viewpoint.order,
          ...policy.createdTimestamps(viewpoint),
        },
      })
    }

    // ラベル→数値の対応
    await tx.gradeConstraintLabelValue.deleteMany({ where: { constraintId } })
    const writtenLabels = new Set<string>()
    for (const labelValue of archive.gradeConstraintLabelValues.filter(
      (candidate) => candidate.constraintId === archiveConstraint.id
    )) {
      if (writtenLabels.has(labelValue.label)) continue
      writtenLabels.add(labelValue.label)
      await tx.gradeConstraintLabelValue.create({
        data: {
          ...(isUuid(labelValue.id) &&
          !(await tx.gradeConstraintLabelValue.findUnique({
            where: { id: labelValue.id },
          }))
            ? { id: labelValue.id }
            : {}),
          constraintId,
          label: labelValue.label,
          // Decimal は文字列のまま渡す（有効桁16桁を超える値を丸めない）
          value: labelValue.value,
          order: labelValue.order,
          ...policy.createdTimestamps(labelValue),
        },
      })
    }

    // 混在禁止ラベル
    await tx.gradeConstraintExclusionLabel.deleteMany({
      where: { constraintId },
    })
    const writtenExclusionLabels = new Set<string>()
    for (const exclusionLabel of archive.gradeConstraintExclusionLabels.filter(
      (candidate) => candidate.constraintId === archiveConstraint.id
    )) {
      if (writtenExclusionLabels.has(exclusionLabel.label)) continue
      writtenExclusionLabels.add(exclusionLabel.label)
      await tx.gradeConstraintExclusionLabel.create({
        data: {
          ...(isUuid(exclusionLabel.id) &&
          !(await tx.gradeConstraintExclusionLabel.findUnique({
            where: { id: exclusionLabel.id },
          }))
            ? { id: exclusionLabel.id }
            : {}),
          constraintId,
          label: exclusionLabel.label,
          order: exclusionLabel.order,
          ...policy.createdTimestamps(exclusionLabel),
        },
      })
    }
  }
}

/**
 * 比較を書く。相手が同じ成績算出の項目なら、いま書いた項目へ付け替える。別の成績算出の
 * 項目なら uuid 一次 → 成績算出名＋項目名 二次で取り込み先の項目へ当てる。
 * 当たらなければその比較は書かない（相手の無い比較は記号を出せない）
 */
export async function writeGradeComparisons(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  gradeItemIdMap: IdMap,
  policy: ImportValuePolicy,
  warnings: string[]
): Promise<void> {
  const comparedGradeItemIdMap: IdMap = new Map()
  for (const comparedItemRef of archive.comparedGradeItemRefs) {
    const byId = await tx.gradeItem.findUnique({
      where: { id: comparedItemRef.id },
    })
    if (byId) {
      comparedGradeItemIdMap.set(comparedItemRef.id, byId.id)
      continue
    }
    const sameNameGradeItems = await tx.gradeItem.findMany({
      where: {
        name: comparedItemRef.gradeItemName,
        grade: { name: comparedItemRef.gradeName },
      },
    })
    const byName = pickOldest(sameNameGradeItems)
    if (!byName) continue
    comparedGradeItemIdMap.set(comparedItemRef.id, byName.id)
    const ambiguity = describeAmbiguity(
      `比較先「${comparedItemRef.gradeName} > ${comparedItemRef.gradeItemName}」`,
      sameNameGradeItems.length,
      `作成 ${byName.createdAt.toISOString().slice(0, 10)}`
    )
    if (ambiguity) warnings.push(ambiguity)
  }

  let droppedComparisons = 0
  for (const archiveComparison of archive.gradeComparisons) {
    const gradeItemId = gradeItemIdMap.get(archiveComparison.gradeItemId)
    const comparedGradeItemId =
      gradeItemIdMap.get(archiveComparison.comparedGradeItemId) ??
      comparedGradeItemIdMap.get(archiveComparison.comparedGradeItemId)
    if (!gradeItemId || !comparedGradeItemId) {
      droppedComparisons++
      continue
    }
    // 同じ組は1行だけ（`@@unique`）。一意制約を張る前のアーカイブには重複が在りうるので、
    // 2つ目以降は一意キーで1つ目に寄る
    const pairKey = { gradeItemId, comparedGradeItemId }
    await writeIdFirstRow({
      archiveId: archiveComparison.id,
      archiveUpdatedAt: archiveComparison.updatedAt,
      policy,
      findById: (id) => tx.gradeComparison.findUnique({ where: { id } }),
      findByKey: () =>
        tx.gradeComparison.findUnique({
          where: { gradeItemId_comparedGradeItemId: pairKey },
        }),
      create: (id) =>
        tx.gradeComparison.create({
          data: {
            ...(id ? { id } : {}),
            ...pairKey,
            order: archiveComparison.order,
            ...policy.createdTimestamps(archiveComparison),
          },
        }),
      update: (existing, updatedAt, writeKey) =>
        tx.gradeComparison.update({
          where: { id: existing.id },
          data: {
            ...(writeKey ? pairKey : {}),
            order: archiveComparison.order,
            updatedAt,
          },
        }),
    })
  }
  if (droppedComparisons > 0) {
    warnings.push(
      `比較先の成績算出・成績評価項目が取り込み先に見つからない比較 ${droppedComparisons}件を取り込みませんでした`
    )
  }
}
