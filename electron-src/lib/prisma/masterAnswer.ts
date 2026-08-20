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

import { DELETION_COUNT_NAME } from "@/lib/shared/deletionCountNames"
import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

import {
  getAbsolutePathFromData,
  getMasterAnswersDirectory,
  getRelativePathFromData,
} from "../dataManager"
import { recordAuditLog } from "./auditLog"
import { resolveExamScope } from "./auditScope"
import prisma from "./client"
import { deleteAfterRecount } from "./deleteAfterRecount"

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

interface DeleteMasterAnswerResult {
  deletedPage: ExamPage | null
}

/**
 * 模範解答ページを消すと巻き添えになる答案を、削除の確認で見せる形で数える。
 *
 * **画面と同じ定義で数えること。** 画面（`MasterAnswerCard`）はページに載っている
 * `studentAnswerImages` の件数を出している（段階26）。
 */
const countMasterAnswerDeletionCounts = async (
  client: Prisma.TransactionClient,
  examPageId: string
): Promise<ConfirmedDeletionCount[]> => {
  const answerSheetCount = await client.studentAnswerImage.count({
    where: { examPageId },
  })
  if (answerSheetCount === 0) return []
  return [
    {
      countedName: DELETION_COUNT_NAME.pageAnswerSheet,
      shownCount: answerSheetCount,
    },
  ]
}

/**
 * 模範解答ページを削除する。ページ番号は1から振り直す。
 *
 * ページに紐づく答案画像・採点領域・採点結果もカスケード削除される。画像を取り替えたい
 * だけなら replaceMasterAnswerImage を使う。呼び出し側は、答案が取り込まれている場合に
 * 何件消えるかを示して確認を取ること。
 */
export const deleteMasterAnswer = async (
  examPageId: string,
  confirmedCounts: ConfirmedDeletionCount[]
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

  await deleteAfterRecount({
    confirmedCounts,
    recount: (tx) => countMasterAnswerDeletionCounts(tx, examPageId),
    remove: async (tx) => {
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
    },
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

/**
 * 模範解答ページを1つ隣へ動かす。
 *
 * **運ぶのは「どのページをどちらへ」という意図だけ。** かつては renderer が
 * 並べ直した一覧から全ページの絶対 `pageNumber` を送っていたため、他の教員が
 * 先に別のページを動かしていると、その結果ごと踏み潰していた。並びを作るのが
 * main（書く直前に DB から読む）なら、相手の移動を読み込んだ上で1つ動かせる。
 *
 * **隣は番号の大小では決まらない。** `pageNumber` は表示上の序数であって一意では
 * なく（2台が同時にページを足すと同じ番号の行が別 id で並ぶ。詳細は
 * studentAnswer/crud.ts の getStudentAnswersDataset のコメント）、並びは
 * `pageNumber` → `id` の組で決まる。この試験の他の経路もすべてこの並びで読む。
 *
 * 番号は入れ替えた後の並びから 1..N へ振り直す。**動いていない行は書かない**ので、
 * 番号が正常なら書き換わるのは2行だけで、同値や飛びがあるときだけそこが直る
 * （削除時の採番と同じ扱い）。
 *
 * 端のページは動かす先が無いので `moved: false` を返す（失敗ではない）。
 */
export const moveExamPage = async (
  examPageId: string,
  direction: "left" | "right"
): Promise<{ moved: boolean }> => {
  const page = await prisma.examPage.findUnique({ where: { id: examPageId } })
  if (!page) {
    throw new Error(`模範解答ページが見つかりません: ${examPageId}`)
  }

  const pages = await prisma.examPage.findMany({
    where: { examId: page.examId },
    orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
  })

  const position = pages.findIndex((candidate) => candidate.id === page.id)
  const nextPosition = direction === "left" ? position - 1 : position + 1
  if (nextPosition < 0 || nextPosition >= pages.length) return { moved: false }

  // 行はそのまま。動かすのは配列の位置だけ
  const reordered = [...pages]
  const [movedPage] = reordered.splice(position, 1)
  reordered.splice(nextPosition, 0, movedPage)

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const [index, target] of reordered.entries()) {
      if (target.pageNumber === index + 1) continue
      await tx.examPage.update({
        where: { id: target.id },
        data: { pageNumber: index + 1 },
      })
    }
  })

  const scope = await resolveExamScope(page.examId)
  await recordAuditLog({
    action: "exam.page.reorder",
    entityType: "ExamPage",
    entityId: page.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
  })

  return { moved: true }
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
