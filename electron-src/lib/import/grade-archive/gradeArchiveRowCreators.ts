/**
 * 成績算出アーカイブの行を、取り込み先の実 id へ付け替えながら作る。
 *
 * どれも `importGradeArchive` のトランザクションの中で、成績本体・評価項目を作った
 * あとに呼ぶ。解決できなかった参照を持つ行は作らず、件数を warnings で伝える。
 */

import type { Prisma } from "@prisma/client"

import { writeConstraintConfig } from "../../prisma/gradeConstraint"
import { buildEstimationSourceRows } from "../../prisma/gradeDataSource"
import { describeAmbiguity, pickOldest } from "../humanKeyMatching"
import type { IdMap, LatestGradeArchiveData } from "./gradeArchiveRefResolvers"

/**
 * 名簿（対象生徒）を作る。
 *
 * @returns アーカイブの対象生徒 uuid → 作った（または寄せた）対象者の id
 */
export async function createGradeStudents(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  gradeId: string,
  studentIdMap: IdMap,
  warnings: string[]
): Promise<IdMap> {
  const gradeStudentIdMap: IdMap = new Map()
  // アーカイブの別々の生徒が取り込み先の同じ生徒へ解決することがある
  // （片方が uuid で、もう片方が学籍番号で当たる場合）。@@unique(gradeId, studentId)
  // があるので素直に作ると2回目で落ちて取り込み全体がロールバックする。
  // 先に作った対象者へ寄せ、寄せたことを伝える
  const gradeStudentIdByStudentId = new Map<string, string>()
  let mergedGradeStudents = 0
  for (const archiveGradeStudent of archive.gradeStudents) {
    const studentId = studentIdMap.get(archiveGradeStudent.studentId)
    if (!studentId) continue
    const alreadyCreated = gradeStudentIdByStudentId.get(studentId)
    if (alreadyCreated) {
      gradeStudentIdMap.set(archiveGradeStudent.id, alreadyCreated)
      mergedGradeStudents++
      continue
    }
    const created = await tx.gradeStudent.create({
      data: {
        gradeId,
        studentId,
        customOrder: archiveGradeStudent.customOrder,
      },
    })
    gradeStudentIdMap.set(archiveGradeStudent.id, created.id)
    gradeStudentIdByStudentId.set(studentId, created.id)
  }
  if (mergedGradeStudents > 0) {
    warnings.push(
      `アーカイブの対象生徒${mergedGradeStudents}名が取り込み先の同じ生徒に一致したため、1名にまとめました`
    )
  }
  return gradeStudentIdMap
}

/** データソースの参照先（取り込み先の実 id） */
interface DataSourceRefIdMaps {
  examIdMap: IdMap
  subtotalIdMap: IdMap
  cropRegionIdMap: IdMap
  courseworkItemIdMap: IdMap
  courseworkIdMap: IdMap
}

/** データソースと、その推定の参照を作る */
export async function createDataSources(
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
  warnings: string[]
): Promise<void> {
  const dataSourceIdMap: IdMap = new Map()
  for (const archiveDataSource of archive.gradeDataSources) {
    const gradeItemId = gradeItemIdMap.get(archiveDataSource.gradeItemId)
    if (!gradeItemId) continue
    const created = await tx.gradeDataSource.create({
      data: {
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
          ? (courseworkItemIdMap.get(archiveDataSource.courseworkItemId) ??
            null)
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
      },
    })
    dataSourceIdMap.set(archiveDataSource.id, created.id)
  }

  // 推定の参照は全データソース作成後に張る（同一成績内の前方参照があるため）
  const estimationSourceIdsByDataSource = new Map<string, string[]>()
  let droppedEstimationSources = 0
  for (const estimationSource of archive.gradeDataSourceEstimationSources) {
    const dataSourceId = dataSourceIdMap.get(estimationSource.dataSourceId)
    const sourceDataSourceId = dataSourceIdMap.get(
      estimationSource.sourceDataSourceId
    )
    if (!dataSourceId || !sourceDataSourceId) {
      droppedEstimationSources++
      continue
    }
    const existing = estimationSourceIdsByDataSource.get(dataSourceId)
    if (existing) existing.push(sourceDataSourceId)
    else estimationSourceIdsByDataSource.set(dataSourceId, [sourceDataSourceId])
  }
  if (droppedEstimationSources > 0) {
    warnings.push(
      `欠損推定の参照${droppedEstimationSources}件を解決できなかったため取り込みませんでした。` +
        `該当データソースの推定設定を確認してください。`
    )
  }
  for (const [
    dataSourceId,
    sourceDataSourceIds,
  ] of estimationSourceIdsByDataSource) {
    await tx.gradeDataSource.update({
      where: { id: dataSourceId },
      data: {
        estimationSources: {
          create: buildEstimationSourceRows(dataSourceId, sourceDataSourceIds),
        },
      },
    })
  }
}

/**
 * セル3種（上書き・確定値・除外）を作る。名簿に載らなかった生徒（照合できなかった生徒）の
 * セルは作らない。作れてしまうと、どの画面にも出ない孤児が復活する（#962）
 */
export async function createGradeCells(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  gradeStudentIdMap: IdMap,
  gradeItemIdMap: IdMap,
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
    await tx.gradeOverride.create({
      data: { ...cell, overrideLabel: archiveOverride.overrideLabel },
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
    await tx.gradeFrozenScore.create({
      data: {
        ...cell,
        weightedScore: archiveFrozenScore.weightedScore,
        weightedMaxScore: archiveFrozenScore.weightedMaxScore,
        percentage: archiveFrozenScore.percentage,
        gradeLabel: archiveFrozenScore.gradeLabel,
        frozenByUserId,
        frozenAt: new Date(archiveFrozenScore.frozenAt),
      },
    })
  }

  for (const archiveExclusion of archive.gradeItemExclusions) {
    const cell = resolveCell(archiveExclusion)
    if (!cell) continue
    await tx.gradeItemExclusion.create({ data: cell })
  }

  if (droppedCells > 0) {
    warnings.push(
      `対象生徒または評価項目を解決できない上書き・確定値・除外設定 ${droppedCells}件を取り込みませんでした`
    )
  }
  if (unknownFrozenByCells > 0) {
    warnings.push(
      `確定した利用者がこの端末に居ない確定値 ${unknownFrozenByCells}件は、確定者を不明として取り込みました`
    )
  }
}

/**
 * 観点間の制約ルールを作る。参照を1つでも失うと判定の意味が変わる（集計対象が減れば
 * 平均が動き、空になれば「比較先以外の全項目」という別の設定に化ける）。黙って
 * 別物として動かさず、無効化して再設定を促す。
 */
export async function createGradeConstraints(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  gradeId: string,
  gradeItemIdMap: IdMap,
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
    const resolvedViewpointIds = archiveViewpoints.flatMap((viewpoint) => {
      const gradeItemId = gradeItemIdMap.get(viewpoint.gradeItemId)
      return gradeItemId ? [gradeItemId] : []
    })
    const lostViewpoint =
      resolvedViewpointIds.length !== archiveViewpoints.length

    const brokenReason = lostTarget
      ? "取り込み時に比較先の評価項目を解決できなかったため無効化しました。再設定してください。"
      : lostViewpoint
        ? "取り込み時に集計対象の観点を解決できなかったため無効化しました。再設定してください。"
        : archiveConstraint.disabledReason
    if (lostTarget || lostViewpoint) {
      warnings.push(`制約ルール「${archiveConstraint.name}」: ${brokenReason}`)
    }

    const createdConstraint = await tx.gradeConstraint.create({
      data: {
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
      },
    })

    // 設定リレーションのidは親idから決定論的に作るため本体作成後に書く
    await writeConstraintConfig(tx, createdConstraint.id, {
      viewpointGradeItemIds: resolvedViewpointIds,
      labelValues: Object.fromEntries(
        archive.gradeConstraintLabelValues
          .filter(
            (labelValue) => labelValue.constraintId === archiveConstraint.id
          )
          .sort((left, right) => left.order - right.order)
          // Decimal は文字列のまま渡す（tolerance と同じ扱い）。
          // number へ倒すと有効桁16桁を超える値が丸まる
          .map((labelValue) => [labelValue.label, labelValue.value])
      ),
      exclusionLabels: archive.gradeConstraintExclusionLabels
        .filter(
          (exclusionLabel) =>
            exclusionLabel.constraintId === archiveConstraint.id
        )
        .sort((left, right) => left.order - right.order)
        .map((exclusionLabel) => exclusionLabel.label),
    })
  }
}

/**
 * 比較を作る。相手が同じ成績算出の項目なら、いま作った項目へ付け替える。別の成績算出の
 * 項目なら uuid 一次 → 成績算出名＋項目名 二次で取り込み先の項目へ当てる。
 * 当たらなければその比較は作らない（相手の無い比較は記号を出せない）
 */
export async function createGradeComparisons(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  gradeItemIdMap: IdMap,
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
  // 同じ組は1行だけ（`@@unique`）。一意制約を張る前のアーカイブには重複が在りうるので、
  // 先に出てきた方だけを作る
  const createdPairs = new Set<string>()
  for (const archiveComparison of archive.gradeComparisons) {
    const gradeItemId = gradeItemIdMap.get(archiveComparison.gradeItemId)
    const comparedGradeItemId =
      gradeItemIdMap.get(archiveComparison.comparedGradeItemId) ??
      comparedGradeItemIdMap.get(archiveComparison.comparedGradeItemId)
    if (!gradeItemId || !comparedGradeItemId) {
      droppedComparisons++
      continue
    }
    const pairKey = JSON.stringify([gradeItemId, comparedGradeItemId])
    if (createdPairs.has(pairKey)) continue
    createdPairs.add(pairKey)
    await tx.gradeComparison.create({
      data: {
        gradeItemId,
        comparedGradeItemId,
        order: archiveComparison.order,
      },
    })
  }
  if (droppedComparisons > 0) {
    warnings.push(
      `比較先の成績算出・評価項目が取り込み先に見つからない比較 ${droppedComparisons}件を取り込みませんでした`
    )
  }
}
