/**
 * ID統合インポート: 試験の出力設定の処理
 *
 * 重ね描きのスタイル・可視性、個人成績表の設定・節・統計の表示・グラフの設定を扱う。
 * 親の試験が新規作成/マッチした場合にのみ呼ばれる。
 *
 * **値の扱いは importValuePolicy に一本化されている**（上書きする／統合する／別で追加する）。
 * 既にある行を置き換えるかどうかも、新しく作る行の時刻も、この規則だけで決まる。
 * かつては「既にあれば触らない」で一律にスキップしていたため、書き出した側で直した
 * 出力設定が、取り込んでも黙って古いままだった。
 *
 * **id が一致すれば同じ行。** どの表もまずアーカイブの id で引き、無ければ一意キー
 * （試験＋種類など）で引き、それも無ければアーカイブの id で作る。id で当たった行の親（試験）と
 * 種類は、別の行と一意キーが重なるときだけ変えずに残す。
 */

import { convertOverlayRowToMm } from "../../prisma/answerOverlayLengthConversion"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { ImportValuePolicy } from "./importValuePolicy"
import { replacementUpdatedAt } from "./importValuePolicy"
import type { PrismaTransaction } from "./types"

/**
 * 出力設定（重ね描きのスタイル・可視性・個人成績表）を復元する。
 *
 * 旧アーカイブの重ね描きのスタイルは長さを答案画像の画素で持つ（形式は凍結しているので
 * 変換器は足さない）。`overlayPixelsPerMm`（`legacyArchivePixelsPerMm` で同梱の答案画像から
 * 決めたもの）があれば mm へ直して書き、無ければ（答案画像を読めなかった）"px" のまま書いて
 * 起動時の変換に任せる。
 */
export async function processExamExportSettings(
  data: ExtractedArchiveData,
  newExamId: string,
  overlayPixelsPerMm: number | null,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  const examData = data.examData

  for (const style of examData.answerOverlayStyles ?? []) {
    const lengths =
      overlayPixelsPerMm === null
        ? {
            lengthUnit: "px",
            offsetX: style.offsetX,
            offsetY: style.offsetY,
            size: style.size,
          }
        : {
            lengthUnit: "mm",
            ...convertOverlayRowToMm(style, overlayPixelsPerMm),
          }
    const values = {
      position: style.position,
      anchor: style.anchor,
      ...lengths,
      color: style.color,
      opacity: style.opacity,
    }
    const key = { examId: newExamId, overlayKind: style.overlayKind }
    const byKey = await tx.examAnswerOverlayStyle.findUnique({
      where: { examId_overlayKind: key },
    })
    const existing =
      (await tx.examAnswerOverlayStyle.findUnique({
        where: { id: style.id },
      })) ?? byKey
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        style.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examAnswerOverlayStyle.update({
          where: { id: existing.id },
          data: { ...(byKey ? {} : key), ...values, updatedAt },
        })
      }
      continue
    }
    await tx.examAnswerOverlayStyle.create({
      data: {
        id: style.id,
        examId: newExamId,
        overlayKind: style.overlayKind,
        ...values,
        ...policy.createdTimestamps(style),
      },
    })
  }

  for (const visibility of examData.answerOverlayVisibilities ?? []) {
    const values = {
      showMark: visibility.showMark,
      showScore: visibility.showScore,
    }
    const key = { examId: newExamId, status: visibility.status }
    const byKey = await tx.examAnswerOverlayVisibility.findUnique({
      where: { examId_status: key },
    })
    const existing =
      (await tx.examAnswerOverlayVisibility.findUnique({
        where: { id: visibility.id },
      })) ?? byKey
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        visibility.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examAnswerOverlayVisibility.update({
          where: { id: existing.id },
          data: { ...(byKey ? {} : key), ...values, updatedAt },
        })
      }
      continue
    }
    await tx.examAnswerOverlayVisibility.create({
      data: {
        id: visibility.id,
        examId: newExamId,
        status: visibility.status,
        ...values,
        ...policy.createdTimestamps(visibility),
      },
    })
  }

  const reportSettings = examData.individualReportSettings
  if (reportSettings) {
    const {
      id: _id,
      examId: _examId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...values
    } = reportSettings
    void _id
    void _examId
    void _createdAt
    void _updatedAt

    const byKey = await tx.examIndividualReportSettings.findUnique({
      where: { examId: newExamId },
    })
    const existing =
      (await tx.examIndividualReportSettings.findUnique({
        where: { id: reportSettings.id },
      })) ?? byKey
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        reportSettings.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examIndividualReportSettings.update({
          where: { id: existing.id },
          data: {
            ...(byKey ? {} : { examId: newExamId }),
            ...values,
            updatedAt,
          },
        })
      }
    } else {
      await tx.examIndividualReportSettings.create({
        data: {
          id: reportSettings.id,
          examId: newExamId,
          ...values,
          ...policy.createdTimestamps(reportSettings),
        },
      })
    }
  }

  for (const section of examData.individualReportTableSections ?? []) {
    const values = {
      enabled: section.enabled,
      columns: section.columns,
      fontSize: section.fontSize,
    }
    const key = { examId: newExamId, tableKind: section.tableKind }
    const byKey = await tx.examIndividualReportTableSection.findUnique({
      where: { examId_tableKind: key },
    })
    const existing =
      (await tx.examIndividualReportTableSection.findUnique({
        where: { id: section.id },
      })) ?? byKey
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        section.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examIndividualReportTableSection.update({
          where: { id: existing.id },
          data: { ...(byKey ? {} : key), ...values, updatedAt },
        })
      }
      continue
    }
    await tx.examIndividualReportTableSection.create({
      data: {
        id: section.id,
        examId: newExamId,
        tableKind: section.tableKind,
        ...values,
        ...policy.createdTimestamps(section),
      },
    })
  }

  for (const visibility of examData.individualReportStatisticVisibilities ??
    []) {
    const key = {
      examId: newExamId,
      statisticKind: visibility.statisticKind,
      scope: visibility.scope,
    }
    const byKey = await tx.examIndividualReportStatisticVisibility.findUnique({
      where: { examId_statisticKind_scope: key },
    })
    const existing =
      (await tx.examIndividualReportStatisticVisibility.findUnique({
        where: { id: visibility.id },
      })) ?? byKey
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        visibility.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examIndividualReportStatisticVisibility.update({
          where: { id: existing.id },
          data: { ...(byKey ? {} : key), shown: visibility.shown, updatedAt },
        })
      }
      continue
    }
    await tx.examIndividualReportStatisticVisibility.create({
      data: {
        id: visibility.id,
        examId: newExamId,
        statisticKind: visibility.statisticKind,
        scope: visibility.scope,
        shown: visibility.shown,
        ...policy.createdTimestamps(visibility),
      },
    })
  }

  const graphSettings = examData.individualReportGraphSettings
  if (graphSettings) {
    const {
      id: _id,
      examId: _examId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...values
    } = graphSettings
    void _id
    void _examId
    void _createdAt
    void _updatedAt

    const byKey = await tx.examIndividualReportGraphSettings.findUnique({
      where: { examId: newExamId },
    })
    const existing =
      (await tx.examIndividualReportGraphSettings.findUnique({
        where: { id: graphSettings.id },
      })) ?? byKey
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        graphSettings.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examIndividualReportGraphSettings.update({
          where: { id: existing.id },
          data: {
            ...(byKey ? {} : { examId: newExamId }),
            ...values,
            updatedAt,
          },
        })
      }
    } else {
      await tx.examIndividualReportGraphSettings.create({
        data: {
          id: graphSettings.id,
          examId: newExamId,
          ...values,
          ...policy.createdTimestamps(graphSettings),
        },
      })
    }
  }
}
