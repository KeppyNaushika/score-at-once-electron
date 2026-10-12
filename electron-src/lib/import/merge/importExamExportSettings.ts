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
    const existing = await tx.examAnswerOverlayStyle.findUnique({
      where: {
        examId_overlayKind: {
          examId: newExamId,
          overlayKind: style.overlayKind,
        },
      },
    })
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        style.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examAnswerOverlayStyle.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        })
      }
      continue
    }
    await tx.examAnswerOverlayStyle.create({
      data: {
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
    const existing = await tx.examAnswerOverlayVisibility.findUnique({
      where: {
        examId_status: { examId: newExamId, status: visibility.status },
      },
    })
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        visibility.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examAnswerOverlayVisibility.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        })
      }
      continue
    }
    await tx.examAnswerOverlayVisibility.create({
      data: {
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

    const existing = await tx.examIndividualReportSettings.findUnique({
      where: { examId: newExamId },
    })
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        reportSettings.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examIndividualReportSettings.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        })
      }
    } else {
      await tx.examIndividualReportSettings.create({
        data: {
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
    const existing = await tx.examIndividualReportTableSection.findUnique({
      where: {
        examId_tableKind: {
          examId: newExamId,
          tableKind: section.tableKind,
        },
      },
    })
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        section.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examIndividualReportTableSection.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        })
      }
      continue
    }
    await tx.examIndividualReportTableSection.create({
      data: {
        examId: newExamId,
        tableKind: section.tableKind,
        ...values,
        ...policy.createdTimestamps(section),
      },
    })
  }

  for (const visibility of examData.individualReportStatisticVisibilities ??
    []) {
    const existing =
      await tx.examIndividualReportStatisticVisibility.findUnique({
        where: {
          examId_statisticKind_scope: {
            examId: newExamId,
            statisticKind: visibility.statisticKind,
            scope: visibility.scope,
          },
        },
      })
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        visibility.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examIndividualReportStatisticVisibility.update({
          where: { id: existing.id },
          data: { shown: visibility.shown, updatedAt },
        })
      }
      continue
    }
    await tx.examIndividualReportStatisticVisibility.create({
      data: {
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

    const existing = await tx.examIndividualReportGraphSettings.findUnique({
      where: { examId: newExamId },
    })
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        graphSettings.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examIndividualReportGraphSettings.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        })
      }
    } else {
      await tx.examIndividualReportGraphSettings.create({
        data: {
          examId: newExamId,
          ...values,
          ...policy.createdTimestamps(graphSettings),
        },
      })
    }
  }
}
