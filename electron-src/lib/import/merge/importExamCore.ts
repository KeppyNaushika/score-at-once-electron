/**
 * ID統合インポート: 試験骨格（Exam根・ExamPage・CropRegion・参加情報）の処理
 *
 * 試験ID一致時は既存の試験へ（ExamPage/CropRegionはID一致でマッピング）、
 * 不一致時は新規作成する。UserExam/ExamSubtotalGroup/ExamStudentの参加情報も扱う。
 *
 * **値の扱いは importValuePolicy に一本化されている**（上書きする／統合する／別で追加する）。
 * 一致した行を置き換えるかどうかも、新しく作る行の時刻も、この規則だけで決まる。
 *
 * 「別で追加する」を人が選んだ場合、id は呼び出し前に振り直されている
 * （separateExamRewriter）ので、ここから見ると単なるID不一致＝新規作成になる。
 * 名前だけは既存とぶつかるため、この処理がサフィックスを付ける。
 */

import * as crypto from "crypto"
import * as path from "path"

import type { FileOverviewData } from "../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import { generateUniqueExamName } from "../exam-archive/uniqueNameGenerators"
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
  return `exams/${newExamId}/master-images/${path.basename(archiveImagePath)}`
}

/**
 * 既にある試験の列を、人が選んだ操作に従って書き換える。
 *
 * **Exam の列は id / examName / referenceDate / description / markerCorrectionEnabled /
 * createdAt / updatedAt で全部**（prisma/schema.prisma）。id は同定そのもの、
 * createdAt は「既にある行」なので動かさない。残り4列がここの対象。
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
      updatedAt,
    },
  })

  warnings.push(
    policy.action === "overwrite"
      ? `試験「${existingExam.examName}」の情報（試験名・試験日・説明・マーク補正の既定）を、` +
          `読み込んだデータで上書きしました。`
      : `試験「${existingExam.examName}」の情報（試験名・試験日・説明・マーク補正の既定）を、` +
          `読み込んだデータの方が新しいため更新しました。`
  )
}

/**
 * 既にあるページの列を規則に従って書き換える。
 *
 * ExamPage の列は id / examId / pageNumber / imagePath / pageSize / createdAt / updatedAt。
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
      pageNumber: archivePage.pageNumber,
      imagePath: importedImagePath ?? existingPage.imagePath,
      pageSize: archivePage.pageSize,
      updatedAt,
    },
  })
}

export async function processExam(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  idMappings: IdMappings,
  counts: ImportCounts,
  warnings: string[],
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<string> {
  const exam = data.examData.exam
  const isExamIdMatch = preMatchResult.exam?.isIdMatch ?? false
  const importAsSeparateExam = policy.action === "separate"

  if (isExamIdMatch && preMatchResult.exam?.existingExamId) {
    // 試験ID一致 → 既存試験を使用（上書き / 統合）
    const newExamId = preMatchResult.exam.existingExamId
    idMappings.exam[exam.id] = newExamId

    await applyExamColumns(exam, newExamId, policy, warnings, tx)

    // 既存のExamPageとCropRegionをID一致でマッピング
    await mapExistingExamPages(data, newExamId, idMappings, counts, policy, tx)
    await mapExistingCropRegions(
      data,
      newExamId,
      idMappings,
      counts,
      policy,
      tx
    )

    return newExamId
  }

  // 試験ID不一致 → 新規作成
  const existingById = await tx.exam.findUnique({
    where: { id: exam.id },
  })
  if (existingById) {
    idMappings.exam[exam.id] = exam.id
    warnings.push(
      `試験ID「${exam.id}」は既に使用されています。既存試験にデータがマージされます。`
    )
    return exam.id
  }

  // 別物として並べるので、一覧で見分けられるよう名前をずらす
  const examName = importAsSeparateExam
    ? await generateUniqueExamName(tx, exam.examName)
    : exam.examName

  // Exam の列は id / examName / referenceDate / description / markerCorrectionEnabled /
  // createdAt / updatedAt で全部。列を足したらここも足すこと。
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
  idMappings.exam[exam.id] = exam.id

  if (importAsSeparateExam) {
    warnings.push(
      `「${exam.examName}」を別の試験として取り込みました` +
        `${examName === exam.examName ? "" : `（試験名は「${examName}」）`}。既存の試験はそのまま残っています。`
    )
  }

  return exam.id
}

async function mapExistingExamPages(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  const existingExamPages = await tx.examPage.findMany({
    where: { examId: newExamId },
  })
  const existingPageById = new Map(
    existingExamPages.map((page) => [page.id, page])
  )

  for (const page of data.examData.examPages) {
    const existingPage =
      existingPageById.get(page.id) ??
      (await tx.examPage.findUnique({ where: { id: page.id } }))

    if (existingPage) {
      await applyExamPageColumns(existingPage, page, newExamId, policy, tx)
      idMappings.examPage[page.id] = page.id
      counts.unchanged.pages++
      continue
    }

    await tx.examPage.create({
      data: {
        id: page.id,
        examId: newExamId,
        pageNumber: page.pageNumber,
        imagePath: toImportedMasterImagePath(newExamId, page.imagePath),
        pageSize: page.pageSize,
        ...policy.createdTimestamps(page),
      },
    })
    idMappings.examPage[page.id] = page.id
    counts.created.pages++
  }
}

async function mapExistingCropRegions(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  const existingCropRegions = await tx.cropRegion.findMany({
    where: {
      examPage: { examId: newExamId },
    },
  })
  const existingRegionById = new Map(
    existingCropRegions.map((cropRegion) => [cropRegion.id, cropRegion])
  )

  for (const region of data.examData.cropRegions) {
    const mappedPageId = idMappings.examPage[region.examPageId]
    if (!mappedPageId) continue

    const existingRegion =
      existingRegionById.get(region.id) ??
      (await tx.cropRegion.findUnique({ where: { id: region.id } }))

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
            examPageId: mappedPageId,
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
      continue
    }

    await tx.cropRegion.create({
      data: {
        id: region.id,
        examPageId: mappedPageId,
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
}

export async function processUserExam(
  isExamIdMatch: boolean,
  newExamId: string,
  currentUserId: string,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  if (isExamIdMatch) {
    const existingUserExam = await tx.userExam.findUnique({
      where: {
        userId_examId: {
          userId: currentUserId,
          examId: newExamId,
        },
      },
    })
    if (existingUserExam) return

    await tx.userExam.create({
      data: {
        id: crypto.randomUUID(),
        userId: currentUserId,
        examId: newExamId,
        role: "MEMBER",
        // 参加した事実はアーカイブに書かれていない（この取り込みで今いま起きた）ので
        // 取り込み時刻。ここは規則の対象外＝アーカイブ由来の値を持たない行
        invitedAt: policy.importedAt,
        invitedBy: null,
      },
    })
    return
  }

  await tx.userExam.create({
    data: {
      id: crypto.randomUUID(),
      userId: currentUserId,
      examId: newExamId,
      role: "OWNER",
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

    // **探すキーは DB が守っているキーに合わせる。** id は uuidv4 なので端末ごとに異なり、
    // アーカイブ側の id とも一致しない。ここで id を探しにいくと、同じ組み合わせの行が
    // あるのに見つけられず create 側へ落ち、unique 違反でアーカイブ取り込みが
    // トランザクションごと巻き戻る。
    const existing = await tx.examSubtotalGroup.findUnique({
      where: {
        examId_subtotalGroupId: {
          examId: newExamId,
          subtotalGroupId: newGroupId,
        },
      },
    })

    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        examSubtotalGroup.updatedAt,
        existing.updatedAt
      )
      if (!updatedAt) continue
      await tx.examSubtotalGroup.update({
        where: { id: existing.id },
        data: {
          selectedForTable: examSubtotalGroup.selectedForTable ?? false,
          selectedForBoxPlot: examSubtotalGroup.selectedForBoxPlot ?? false,
          updatedAt,
        },
      })
      continue
    }

    await tx.examSubtotalGroup.create({
      data: {
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
  isExamIdMatch: boolean,
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

    const existing = isExamIdMatch
      ? ((await tx.examStudent.findFirst({
          where: { examId: newExamId, studentId: newStudentId },
        })) ??
        (await tx.examStudent.findUnique({ where: { id: examStudent.id } })))
      : await tx.examStudent.findUnique({ where: { id: examStudent.id } })

    if (existing) {
      idMappings.examStudent[examStudent.id] = existing.id
      const updatedAt = replacementUpdatedAt(
        policy,
        examStudent.updatedAt,
        existing.updatedAt
      )
      if (!updatedAt) continue
      await tx.examStudent.update({
        where: { id: existing.id },
        data: {
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
    if (existingById) {
      await applyExamPageColumns(existingById, page, newExamId, policy, tx)
      idMappings.examPage[page.id] = page.id
      counts.unchanged.pages++
    } else {
      await tx.examPage.create({
        data: {
          id: page.id,
          examId: newExamId,
          pageNumber: page.pageNumber,
          imagePath: toImportedMasterImagePath(newExamId, page.imagePath),
          pageSize: page.pageSize,
          ...policy.createdTimestamps(page),
        },
      })
      idMappings.examPage[page.id] = page.id
      counts.created.pages++
    }
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
    if (existingById) {
      const updatedAt = replacementUpdatedAt(
        policy,
        region.updatedAt,
        existingById.updatedAt
      )
      if (updatedAt) {
        await tx.cropRegion.update({
          where: { id: existingById.id },
          data: {
            examPageId: newPageId,
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
      continue
    }

    await tx.cropRegion.create({
      data: {
        id: region.id,
        examPageId: newPageId,
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
}
