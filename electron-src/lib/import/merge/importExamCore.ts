/**
 * ID統合インポート: 試験骨格（Exam根・ExamPage・CropRegion・参加情報）の処理
 *
 * **id が一致すれば同じ行**: 試験・ページ・採点領域・参加・小計グループの採用・受験者の
 * どれも、まずアーカイブの id で取り込み先を引き、在れば同じ行として規則どおり値（親を指す
 * 列も含む）を書く。無ければ一意キー（(試験, 生徒) など）で引き、それも無ければアーカイブの
 * id で作る。試験の id が一致したかは、事前照合ではなく実行の時点で決める（呼び出し側）。
 *
 * **値の扱いは importValuePolicy に一本化されている**（上書きする／統合する／別で追加する）。
 * 一致した行を置き換えるかどうかも、新しく作る行の時刻も、この規則だけで決まる。
 *
 * 「別で追加する」を人が選んだ場合、id は呼び出し前に振り直されている
 * （separateExamRewriter）ので、ここから見ると単なるID不一致＝新規作成になる。
 * そのとき同じ名前の試験が既にあれば、試験名に ` (2)`・` (3)` … を付ける（separateExamName）。
 * 試験名に unique は無く、制約のためではなく一覧で見分けるための添え字。
 */

import * as crypto from "crypto"

import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import { lastPathSegmentOf } from "../exam-archive/archiveValueValidator"
import { separateExamName } from "../shared/separateExamName"
import type { ImportValuePolicy } from "./importValuePolicy"
import { replacementUpdatedAt } from "./importValuePolicy"
import type { IdMappings, ImportCounts, PrismaTransaction } from "./types"

/**
 * アーカイブ内の模範解答画像パスを、取り込み先の試験ディレクトリのパスへ読み替える。
 * 画像の実体をそこへ置くのは imageImporter の copyImportImages で、
 * `master-images` という置き先の規則を共有している。
 */
function toImportedMasterImagePath(
  newExamId: string,
  archiveImagePath: string | null
): string | null {
  if (!archiveImagePath) return null
  // ファイル名の形は展開時に確かめてある（archiveValueValidator.ts）
  return `exams/${newExamId}/master-images/${lastPathSegmentOf(archiveImagePath)}`
}

/**
 * 既にある試験の列を、人が選んだ操作に従って書き換える。
 *
 * **Exam の列は id / examName / referenceDate / description / markerCorrectionEnabled /
 * anonymousScoringEnforced / createdAt / updatedAt で全部**（prisma/schema.prisma）。
 * id は同定そのもの、createdAt は「既にある行」なので動かさない。残り6列がここの対象。
 * 列を足したらここにも足すこと。
 */
async function applyExamColumns(
  exam: ExtractedArchiveData["examData"]["exam"],
  existingExamId: string,
  policy: ImportValuePolicy,
  warnings: string[],
  tx: PrismaTransaction
): Promise<void> {
  const existingExam = await tx.exam.findUnique({
    where: { id: existingExamId },
  })
  if (!existingExam) return

  const updatedAt = replacementUpdatedAt(
    policy,
    exam.updatedAt,
    existingExam.updatedAt
  )
  if (!updatedAt) return

  await tx.exam.update({
    where: { id: existingExamId },
    data: {
      examName: exam.examName,
      referenceDate: exam.referenceDate ? new Date(exam.referenceDate) : null,
      description: exam.description,
      // 旧アーカイブ（〜v1.11.0）はこの列を持たないので既定の false へ倒れる
      markerCorrectionEnabled: exam.markerCorrectionEnabled ?? false,
      // 旧形式（凍結）はこの列を持たない。読み込んだ側の試験は固定していなかったものとして既定へ倒す
      anonymousScoringEnforced: false,
      updatedAt,
    },
  })

  warnings.push(
    policy.action === "overwrite"
      ? `試験「${existingExam.examName}」の情報（試験名・試験日・説明・マーク補正の既定）を、` +
          `取り込んだデータで上書きしました。`
      : `試験「${existingExam.examName}」の情報（試験名・試験日・説明・マーク補正の既定）を、` +
          `取り込んだデータの方が新しいため更新しました。`
  )
}

/**
 * 既にあるページの列を規則に従って書き換える。
 *
 * ExamPage の列は id / examId / pageNumber / imagePath / pageSize / createdAt / updatedAt。
 * id が一致したページは同じページなので、親（examId）もアーカイブの値（取り込む試験）にする。
 * 模範解答画像だけは実体（ファイル）を伴うので、置き換えるのは**アーカイブが画像を
 * 持っているときだけ**にする。持っていないアーカイブで既存の画像を消すと、
 * 参照の切れたページになり画面から復旧できない。
 */
async function applyExamPageColumns(
  existingPage: { id: string; imagePath: string | null; updatedAt: Date },
  archivePage: ExtractedArchiveData["examData"]["examPages"][number],
  newExamId: string,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  const importedImagePath = toImportedMasterImagePath(
    newExamId,
    archivePage.imagePath
  )
  const updatedAt = replacementUpdatedAt(
    policy,
    archivePage.updatedAt,
    existingPage.updatedAt
  )

  // 規則が「置き換えない」と言っても、模範解答を失ったページにアーカイブ側の画像が
  // あるなら補う（欠けを埋めるだけで、既にあるものは書き換えない）
  if (!updatedAt) {
    if (!existingPage.imagePath && importedImagePath) {
      await tx.examPage.update({
        where: { id: existingPage.id },
        data: { imagePath: importedImagePath, pageSize: archivePage.pageSize },
      })
    }
    return
  }

  await tx.examPage.update({
    where: { id: existingPage.id },
    data: {
      examId: newExamId,
      pageNumber: archivePage.pageNumber,
      imagePath: importedImagePath ?? existingPage.imagePath,
      pageSize: archivePage.pageSize,
      updatedAt,
    },
  })
}

/**
 * アーカイブのページ1枚を、既にある行があれば規則に従って書き換え、無ければ新しく作る。
 *
 * 既にある行の探し方は呼び出し側で違う（試験ID一致なら試験のページを先にまとめて引く）
 * ので、探した結果を受け取る。
 */
async function importExamPage(
  archivePage: ExtractedArchiveData["examData"]["examPages"][number],
  existingPage: {
    id: string
    imagePath: string | null
    updatedAt: Date
  } | null,
  newExamId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  if (existingPage) {
    await applyExamPageColumns(existingPage, archivePage, newExamId, policy, tx)
    idMappings.examPage[archivePage.id] = archivePage.id
    counts.unchanged.pages++
    return
  }

  await tx.examPage.create({
    data: {
      id: archivePage.id,
      examId: newExamId,
      pageNumber: archivePage.pageNumber,
      imagePath: toImportedMasterImagePath(newExamId, archivePage.imagePath),
      pageSize: archivePage.pageSize,
      ...policy.createdTimestamps(archivePage),
    },
  })
  idMappings.examPage[archivePage.id] = archivePage.id
  counts.created.pages++
}

/**
 * アーカイブの採点領域1つを、既にある行があれば規則に従って書き換え、無ければ新しく作る。
 *
 * 既にある行の探し方は呼び出し側で違う（試験ID一致なら試験の領域を先にまとめて引く）
 * ので、探した結果を受け取る。
 */
async function importCropRegion(
  region: ExtractedArchiveData["examData"]["cropRegions"][number],
  existingRegion: { id: string; updatedAt: Date } | null,
  newExamPageId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  if (existingRegion) {
    const updatedAt = replacementUpdatedAt(
      policy,
      region.updatedAt,
      existingRegion.updatedAt
    )
    if (updatedAt) {
      await tx.cropRegion.update({
        where: { id: existingRegion.id },
        data: {
          examPageId: newExamPageId,
          label: region.label,
          type: region.type,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          points: region.points,
          orderIndex: region.orderIndex,
          updatedAt,
        },
      })
      counts.updated.regions++
    } else {
      counts.unchanged.regions++
    }
    idMappings.cropRegion[region.id] = region.id
    return
  }

  await tx.cropRegion.create({
    data: {
      id: region.id,
      examPageId: newExamPageId,
      label: region.label,
      type: region.type,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      points: region.points,
      orderIndex: region.orderIndex,
      ...policy.createdTimestamps(region),
    },
  })
  idMappings.cropRegion[region.id] = region.id
  counts.created.regions++
}

/**
 * 試験の根。`isExamIdMatch` は実行の時点で取り込み先に同じ id の試験があるか
 */
export async function processExam(
  data: ExtractedArchiveData,
  isExamIdMatch: boolean,
  idMappings: IdMappings,
  warnings: string[],
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<string> {
  const exam = data.examData.exam
  idMappings.exam[exam.id] = exam.id

  if (isExamIdMatch) {
    // 同じ試験（上書き / 統合 / 別で追加なら書かない）
    await applyExamColumns(exam, exam.id, policy, warnings, tx)
    return exam.id
  }

  // 別の試験として取り込むときは、同じ名前の試験と見分けられるよう名前に番号を付ける
  const examName =
    policy.action === "separate"
      ? await separateExamName(
          exam.examName,
          async (candidateName) =>
            (await tx.exam.findFirst({
              where: { examName: candidateName },
            })) !== null
        )
      : exam.examName

  // Exam の列は id / examName / referenceDate / description / markerCorrectionEnabled /
  // anonymousScoringEnforced / createdAt / updatedAt で全部。列を足したらここも足すこと。
  await tx.exam.create({
    data: {
      id: exam.id,
      examName,
      referenceDate: exam.referenceDate ? new Date(exam.referenceDate) : null,
      description: exam.description,
      // 旧アーカイブ（〜v1.11.0）はこの列を持たないので既定の false へ倒れる
      markerCorrectionEnabled: exam.markerCorrectionEnabled ?? false,
      ...policy.createdTimestamps(exam),
    },
  })

  if (policy.action === "separate") {
    warnings.push(
      `「${exam.examName}」を別の試験として取り込みました` +
        `${examName === exam.examName ? "" : `（試験名は「${examName}」）`}。既存の試験はそのまま残っています。`
    )
  }

  return exam.id
}

/**
 * 試験の参加者（UserExam）。アーカイブの行を id で取り込み、取り込んだ人の参加も確かめる。
 *
 * UserExam の列は id / userId / examId / role / canExportResults / invitedAt / invitedBy /
 * createdAt / updatedAt。canExportResults は旧形式（凍結）に無いので書かない。
 * 採点者として結べなかった利用者（`idMappings.user` に無い人）の参加は取り込めない
 * （親の利用者が取り込み先に無い）。
 */
export async function processUserExam(
  data: ExtractedArchiveData,
  isExamIdMatch: boolean,
  newExamId: string,
  currentUserId: string,
  idMappings: IdMappings,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  for (const userExam of data.examData.userExams) {
    const userId = idMappings.user[userExam.userId]
    if (!userId) continue
    const invitedBy = userExam.invitedBy
      ? (idMappings.user[userExam.invitedBy] ?? null)
      : null

    const existing =
      (await tx.userExam.findUnique({ where: { id: userExam.id } })) ??
      (await tx.userExam.findUnique({
        where: { userId_examId: { userId, examId: newExamId } },
      }))

    if (!existing) {
      await tx.userExam.create({
        data: {
          id: userExam.id,
          userId,
          examId: newExamId,
          role: userExam.role,
          invitedAt: new Date(userExam.invitedAt),
          invitedBy,
          ...policy.createdTimestamps(userExam),
        },
      })
      idMappings.userExam[userExam.id] = userExam.id
      continue
    }

    idMappings.userExam[userExam.id] = existing.id
    const updatedAt = replacementUpdatedAt(
      policy,
      userExam.updatedAt,
      existing.updatedAt
    )
    if (!updatedAt) continue
    // 親（利用者・試験）を変えると別の行と (userId, examId) が重なるなら、親は変えない
    const keyTaken =
      (existing.userId !== userId || existing.examId !== newExamId) &&
      (await tx.userExam.findUnique({
        where: { userId_examId: { userId, examId: newExamId } },
      })) !== null
    await tx.userExam.update({
      where: { id: existing.id },
      data: {
        ...(keyTaken ? {} : { userId, examId: newExamId }),
        role: userExam.role,
        invitedAt: new Date(userExam.invitedAt),
        invitedBy,
        updatedAt,
      },
    })
  }

  // 取り込んだ人がこの試験に参加していなければ加える。参加した事実はアーカイブに
  // 書かれていない（この取り込みで今いま起きた）ので取り込み時刻
  const currentUserExam = await tx.userExam.findUnique({
    where: { userId_examId: { userId: currentUserId, examId: newExamId } },
  })
  if (currentUserExam) return
  await tx.userExam.create({
    data: {
      id: crypto.randomUUID(),
      userId: currentUserId,
      examId: newExamId,
      // 新しく作った試験は取り込んだ人のもの。既にある試験には採点者として加わる
      role: isExamIdMatch ? "EDITOR" : "OWNER",
      invitedAt: policy.importedAt,
      invitedBy: null,
    },
  })
}

export async function processExamSubtotalGroups(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  for (const examSubtotalGroup of data.examData.examSubtotalGroups) {
    const newGroupId =
      idMappings.subtotalGroup[examSubtotalGroup.subtotalGroupId]
    if (!newGroupId) continue

    // id が一致すれば同じ行。無ければ DB が守っている一意キー (試験, グループ) で引く
    // （同じ組み合わせの別 id の行があるのに作ると、unique 違反で取り込みが巻き戻る）
    const existing =
      (await tx.examSubtotalGroup.findUnique({
        where: { id: examSubtotalGroup.id },
      })) ??
      (await tx.examSubtotalGroup.findUnique({
        where: {
          examId_subtotalGroupId: {
            examId: newExamId,
            subtotalGroupId: newGroupId,
          },
        },
      }))

    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        examSubtotalGroup.updatedAt,
        existing.updatedAt
      )
      if (!updatedAt) continue
      const keyTaken =
        (existing.examId !== newExamId ||
          existing.subtotalGroupId !== newGroupId) &&
        (await tx.examSubtotalGroup.findUnique({
          where: {
            examId_subtotalGroupId: {
              examId: newExamId,
              subtotalGroupId: newGroupId,
            },
          },
        })) !== null
      await tx.examSubtotalGroup.update({
        where: { id: existing.id },
        data: {
          ...(keyTaken
            ? {}
            : { examId: newExamId, subtotalGroupId: newGroupId }),
          selectedForTable: examSubtotalGroup.selectedForTable ?? false,
          selectedForBoxPlot: examSubtotalGroup.selectedForBoxPlot ?? false,
          updatedAt,
        },
      })
      continue
    }

    await tx.examSubtotalGroup.create({
      data: {
        id: examSubtotalGroup.id,
        examId: newExamId,
        subtotalGroupId: newGroupId,
        selectedForTable: examSubtotalGroup.selectedForTable ?? false,
        selectedForBoxPlot: examSubtotalGroup.selectedForBoxPlot ?? false,
        ...policy.createdTimestamps(examSubtotalGroup),
      },
    })
  }
}

export async function processExamStudents(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<{ orderWrittenCount: number }> {
  // 詰め直しの起動条件は「作成**または更新**したとき」。上書き／統合は既存行の
  // customOrder も書き換えるので、行が1つも増えない取り込みでも番号は重なる
  let orderWrittenCount = 0

  for (const examStudent of data.examData.examStudents) {
    const newStudentId = idMappings.student[examStudent.studentId]
    if (!newStudentId) continue

    // id が一致すれば同じ行。無ければ一意キー (試験, 生徒) で引く
    const existing =
      (await tx.examStudent.findUnique({ where: { id: examStudent.id } })) ??
      (await tx.examStudent.findUnique({
        where: {
          examId_studentId: { examId: newExamId, studentId: newStudentId },
        },
      }))

    if (existing) {
      idMappings.examStudent[examStudent.id] = existing.id
      const updatedAt = replacementUpdatedAt(
        policy,
        examStudent.updatedAt,
        existing.updatedAt
      )
      if (!updatedAt) continue
      const keyTaken =
        (existing.examId !== newExamId ||
          existing.studentId !== newStudentId) &&
        (await tx.examStudent.findUnique({
          where: {
            examId_studentId: { examId: newExamId, studentId: newStudentId },
          },
        })) !== null
      await tx.examStudent.update({
        where: { id: existing.id },
        data: {
          ...(keyTaken ? {} : { examId: newExamId, studentId: newStudentId }),
          status: examStudent.status,
          // 並び順は列全体の性質なので、値をそのまま入れると重複と穴ができる。
          // 取り込みの最後に名簿ごと詰め直す（reorderAfterImport）
          customOrder: examStudent.customOrder,
          updatedAt,
        },
      })
      orderWrittenCount++
      continue
    }

    await tx.examStudent.create({
      data: {
        id: examStudent.id,
        examId: newExamId,
        studentId: newStudentId,
        status: examStudent.status,
        customOrder: examStudent.customOrder,
        ...policy.createdTimestamps(examStudent),
      },
    })
    idMappings.examStudent[examStudent.id] = examStudent.id
    orderWrittenCount++
  }

  return { orderWrittenCount }
}

export async function processExamPages(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  for (const page of data.examData.examPages) {
    const existingById = await tx.examPage.findUnique({
      where: { id: page.id },
    })
    await importExamPage(
      page,
      existingById,
      newExamId,
      idMappings,
      counts,
      policy,
      tx
    )
  }
}

export async function processCropRegions(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  counts: ImportCounts,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  for (const region of data.examData.cropRegions) {
    const newPageId = idMappings.examPage[region.examPageId]
    if (!newPageId) continue

    const existingById = await tx.cropRegion.findUnique({
      where: { id: region.id },
    })
    await importCropRegion(
      region,
      existingById,
      newPageId,
      idMappings,
      counts,
      policy,
      tx
    )
  }
}
