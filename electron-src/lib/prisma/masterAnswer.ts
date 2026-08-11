/**
 * 模範解答ページ（ExamPage）の Prisma 操作関数
 *
 * ExamPage が模範解答画像そのものを持つ。かつては MasterImage という別テーブルだったが、
 * 1ページ1枚しか作れず読む側は全箇所が `masterImages[0]` を書いていたため畳んだ。
 * ここは 01-upload（アップロード・差し替え・削除・並び替え）の操作を担当する。
 * ページを他の画面向けに読み出す include は examPage.ts 側にある。
 */

import type { ExamPage, Prisma } from "@prisma/client"
import * as fsPromises from "fs/promises"
import * as path from "path"

import {
  getAbsolutePathFromData,
  getMasterAnswersDirectory,
  getRelativePathFromData,
} from "../dataManager"
import { recordAuditLog } from "./auditLog"
import { resolveExamScope } from "./auditScope"
import prisma from "./client"

/**
 * アップロード1件分のファイル。PDF は renderer 側で画像へ変換されてから渡ってくるので、
 * ここへ来るのは常に画像1枚分である。
 */
export interface MasterAnswerFileData {
  name: string
  type: string
  buffer: ArrayBuffer
  path?: string
}

/** 画像を試験の模範解答ディレクトリへ保存し、data からの相対パスを返す */
async function saveMasterAnswerFile(
  examId: string,
  fileData: MasterAnswerFileData,
  uniqueSuffix: string
): Promise<string> {
  const examAnswerDir = getMasterAnswersDirectory(examId)
  await fsPromises.mkdir(examAnswerDir, { recursive: true })

  const destinationPath = path.join(
    examAnswerDir,
    `${Date.now()}-${uniqueSuffix}-${fileData.name}`
  )
  await fsPromises.writeFile(destinationPath, Buffer.from(fileData.buffer))

  return getRelativePathFromData(destinationPath)
}

/**
 * 画像ファイルを消す。既に無い場合は黙って通す。
 * DB 側は消えているので、ここで失敗しても操作自体は成立している。
 */
async function removeImageFile(relativePath: string | null): Promise<void> {
  if (!relativePath) return
  try {
    await fsPromises.unlink(getAbsolutePathFromData(relativePath))
  } catch (fileError: unknown) {
    if (
      fileError &&
      typeof fileError === "object" &&
      "code" in fileError &&
      fileError.code !== "ENOENT"
    ) {
      console.warn(`Failed to delete image file ${relativePath}:`, fileError)
    }
  }
}

/** 模範解答画像をアップロードし、末尾に続けてページを作成する */
export const uploadMasterAnswers = async (
  examId: string,
  filesData: MasterAnswerFileData[]
): Promise<ExamPage[]> => {
  const exam = await prisma.exam.findUnique({ where: { id: examId } })
  if (!exam) {
    throw new Error("Exam not found for master answer upload")
  }

  const lastPage = await prisma.examPage.findFirst({
    where: { examId },
    orderBy: { pageNumber: "desc" },
  })
  const highestPageNumber = lastPage?.pageNumber ?? 0

  const uploadedPages: ExamPage[] = []

  for (const [index, fileData] of filesData.entries()) {
    try {
      const imagePath = await saveMasterAnswerFile(
        examId,
        fileData,
        String(index)
      )

      uploadedPages.push(
        await prisma.examPage.create({
          data: {
            examId,
            pageNumber: highestPageNumber + 1 + index,
            imagePath,
          },
        })
      )
    } catch (error) {
      console.error(`Failed to upload or save answer ${fileData.name}:`, error)
    }
  }

  if (uploadedPages.length > 0) {
    const scope = await resolveExamScope(examId)
    await recordAuditLog({
      action: "exam.page.upload",
      entityType: "ExamPage",
      entityId: uploadedPages[0].id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
    })
  }

  return uploadedPages
}

/**
 * ページの模範解答画像だけを差し替える。
 *
 * 採点領域・答案画像・採点結果はページに紐づいたまま残る。模範解答を刷り直したときに、
 * ページを消して作り直す（＝答案も消える）以外の手段が無かったため用意した。
 * 用紙サイズは教員が設定した値なので引き継ぐ。
 */
export const replaceMasterAnswerImage = async (
  examPageId: string,
  fileData: MasterAnswerFileData
): Promise<ExamPage> => {
  const currentPage = await prisma.examPage.findUnique({
    where: { id: examPageId },
  })
  if (!currentPage) {
    throw new Error(`Exam page not found for replacement (id: ${examPageId})`)
  }

  const imagePath = await saveMasterAnswerFile(
    currentPage.examId,
    fileData,
    "replaced"
  )

  let updatedPage: ExamPage
  try {
    updatedPage = await prisma.examPage.update({
      where: { id: examPageId },
      data: { imagePath },
    })
  } catch (error) {
    // 更新できなかった新しい画像は誰からも参照されない。片付けないと、
    // 差し替えに失敗するたびにフル解像度の画像が共有ディレクトリへ溜まっていく
    await removeImageFile(imagePath)
    throw error
  }

  // 新しい画像を書き込んで DB を更新し終えてから消す。
  // 先に消すと、書き込みに失敗したときに元の画像も失われる
  await removeImageFile(currentPage.imagePath)

  const scope = await resolveExamScope(currentPage.examId)
  await recordAuditLog({
    action: "exam.page.replace",
    entityType: "ExamPage",
    entityId: examPageId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
  })

  return updatedPage
}

export interface DeleteMasterAnswerResult {
  deletedPage: ExamPage | null
}

/**
 * 模範解答ページを削除する。ページ番号は1から振り直す。
 *
 * ページに紐づく答案画像・採点領域・採点結果もカスケード削除される。画像を取り替えたい
 * だけなら replaceMasterAnswerImage を使う。呼び出し側は、答案が取り込まれている場合に
 * 何件消えるかを示して確認を取ること。
 */
export const deleteMasterAnswer = async (
  examPageId: string
): Promise<DeleteMasterAnswerResult> => {
  const targetPage = await prisma.examPage.findUnique({
    where: { id: examPageId },
    include: { studentAnswerImages: true },
  })

  if (!targetPage) {
    console.warn(`No exam page found for deletion (id: ${examPageId}).`)
    return { deletedPage: null }
  }

  const { examId } = targetPage

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.examPage.delete({ where: { id: examPageId } })

    // 並びが採番結果を決めるので、id をタイブレークに入れて決定的にする
    // （pageNumber は一意ではない。詳細は studentAnswer/crud.ts の
    //  getStudentAnswersDataset のコメント）
    const pages = await tx.examPage.findMany({
      where: { examId },
      orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
    })

    for (const [index, page] of pages.entries()) {
      if (page.pageNumber !== index + 1) {
        await tx.examPage.update({
          where: { id: page.id },
          data: { pageNumber: index + 1 },
        })
      }
    }
  })

  // DB から消えた後に画像を消す。答案画像はページと一緒にカスケード削除されるため、
  // ここで実体を消さないとファイルだけが取り残される
  await removeImageFile(targetPage.imagePath)
  for (const studentAnswerImage of targetPage.studentAnswerImages) {
    await removeImageFile(studentAnswerImage.imagePath)
  }

  const scope = await resolveExamScope(examId)
  await recordAuditLog({
    action: "exam.page.delete",
    entityType: "ExamPage",
    entityId: examPageId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
  })

  return { deletedPage: targetPage }
}

/** 模範解答ページの順序を一括更新する（一時番号経由でユニーク制約を回避） */
export const updateMasterAnswersOrder = async (
  pageOrders: { id: string; pageNumber: number }[]
): Promise<Prisma.BatchPayload> => {
  if (pageOrders.length === 0) {
    return { count: 0 }
  }

  const pages = await prisma.examPage.findMany({
    where: { id: { in: pageOrders.map((pageOrder) => pageOrder.id) } },
  })
  if (pages.length === 0) {
    throw new Error("No exam pages found for reordering")
  }

  const { examId } = pages[0]
  const highestPageNumber = Math.max(...pages.map((page) => page.pageNumber))
  const offset = highestPageNumber + pageOrders.length + 100

  // 実在するページだけを並べ替える。協調採点では他の教員が先にページを消していることが
  // あり、消えた1件で update が P2025 を投げるとトランザクションごと巻き戻って
  // 「1ページも並び替わらない」になる。残ったページは並べ替えて構わない
  const existingPageIds = new Set(pages.map((page) => page.id))
  const applicableOrders = pageOrders.filter((pageOrder) =>
    existingPageIds.has(pageOrder.id)
  )

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 一度すべてを衝突しない番号へ逃がしてから確定させる
    for (const [index, pageOrder] of applicableOrders.entries()) {
      await tx.examPage.update({
        where: { id: pageOrder.id },
        data: { pageNumber: offset + index },
      })
    }
    for (const pageOrder of applicableOrders) {
      await tx.examPage.update({
        where: { id: pageOrder.id },
        data: { pageNumber: pageOrder.pageNumber },
      })
    }
  })

  const scope = await resolveExamScope(examId)
  await recordAuditLog({
    action: "exam.page.reorder",
    entityType: "ExamPage",
    entityId: examId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
  })

  return { count: applicableOrders.length }
}

/**
 * 試験IDで模範解答ページ一覧を取得する（ページ番号順）。
 * 名前のとおり模範解答画像を持つページだけを返す（旧 MasterImage の行に相当）。
 * 画像の有無に関わらず全ページが要るなら examPage.ts の getExamPagesByExamId を使う。
 */
export const getMasterAnswersByExamId = async (
  examId: string
): Promise<ExamPage[]> => {
  return prisma.examPage.findMany({
    where: { examId, imagePath: { not: null } },
    orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
  })
}

/** 模範解答ページの用紙サイズを更新する */
export const updateExamPagePageSize = async (
  examPageId: string,
  pageSize: string
): Promise<ExamPage> => {
  return prisma.examPage.update({
    where: { id: examPageId },
    data: { pageSize },
  })
}
