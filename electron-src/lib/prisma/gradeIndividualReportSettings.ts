/**
 * 個人成績通知書の設定（GradeIndividualReportSettings）の読み書き。
 *
 * かつては `GradeExportSettings.settingsJson` に設定をまるごと JSON で入れていた。塊で
 * 読み書きすると、**続けて2つチェックを入れたときに先の1つが消える**（取り直しが着地する
 * 前に、古い写しへ2度目を重ねて書くため）。列にすれば、触った列だけを書ける。
 *
 * **既定値は schema.prisma が持つ**（`@default`）。行がまだ無いときに一部だけ書いても、
 * 残りは DB の既定で埋まる。
 */

import type { GradeIndividualReportSettings } from "@prisma/client"

import type { GradeReportSettings } from "../../../src/types/gradeReport.types"
import prisma from "./client"

/** 設定を引く。まだ無ければ `null`（画面が既定で描く） */
export async function getGradeIndividualReportSettings(
  gradeId: string
): Promise<GradeIndividualReportSettings | null> {
  return prisma.gradeIndividualReportSettings.findUnique({ where: { gradeId } })
}

/**
 * 触った列だけを書く（行がまだ無ければ、残りは DB の既定で作る）。
 *
 * 更新は**触る列だけ**を載せる（`Partial`）。この行にはヌル許容の列が無いので、
 * 「載せていない」と「空にする」が `undefined` で衝突しない。
 */
export async function updateGradeIndividualReportSettings(
  gradeId: string,
  values: Partial<GradeReportSettings>
): Promise<void> {
  await prisma.gradeIndividualReportSettings.upsert({
    where: { gradeId },
    update: values,
    create: { gradeId, ...values },
  })
}
