/**
 * 統合アーカイブ（.sao）の書き出しのテスト用に、ファイルパスを持つ行と、その位置のファイルを作る
 *
 * `createUnifiedArchiveFixture` の試験Aはページの画像パスが空で、答案画像も解答用紙の定義も
 * 持たない。ここで、ファイルパスを持つ3列（ExamPage / StudentAnswerImage / AsbImageElement の
 * imagePath）の全てに値を入れる。試験Bのページは空パスのまま（集めない値の例）。
 */

import type { PrismaClient } from "@prisma/client"
import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

import type { UnifiedArchiveFixture } from "./unifiedArchiveFixture"

export interface UnifiedArchiveFileFixture {
  asbDefinitionId: string
  asbAuthorId: string
  /** 試験Aの模範解答ページの画像（データディレクトリからの相対パス） */
  examPageImagePaths: string[]
  /** 試験Aの答案画像 */
  studentAnswerImagePaths: string[]
  /** 解答用紙の定義の画像 */
  asbImagePaths: string[]
}

/** 試験Aのページ・答案画像と、解答用紙の定義（画像つき）に画像パスを入れる */
export async function createUnifiedArchiveFileFixture(
  prisma: PrismaClient,
  fixture: UnifiedArchiveFixture
): Promise<UnifiedArchiveFileFixture> {
  const examId = fixture.examA.exam.id

  const examPageImagePaths = await Promise.all(
    fixture.examA.pages.map(async (page) => {
      const imagePath = `exams/${examId}/master-answers/page${page.pageNumber}.png`
      await prisma.examPage.update({
        where: { id: page.id },
        data: { imagePath },
      })
      return imagePath
    })
  )

  const studentAnswerImagePaths: string[] = []
  for (const page of fixture.examA.pages) {
    for (const examStudent of fixture.examA.examStudents) {
      const imagePath = `exams/${examId}/answer-sheets/${examStudent.id}_page${page.pageNumber}.png`
      await prisma.studentAnswerImage.create({
        data: {
          examPageId: page.id,
          examStudentId: examStudent.id,
          imagePath,
        },
      })
      studentAnswerImagePaths.push(imagePath)
    }
  }

  const asbAuthor = await prisma.user.create({
    data: { username: `asb_${crypto.randomUUID()}`, name: "解答用紙の作成者" },
  })
  const asbDefinitionId = crypto.randomUUID()
  const asbImagePath = `answer-sheet-builder/${asbDefinitionId}/images/figure.png`
  await prisma.asbDefinition.create({
    data: {
      id: asbDefinitionId,
      name: "解答用紙",
      userId: asbAuthor.id,
      majorQuestions: {
        create: {
          label: "1",
          subQuestions: {
            create: {
              label: "(1)",
              imageElements: {
                create: { imagePath: asbImagePath, originalName: "figure.png" },
              },
            },
          },
        },
      },
    },
  })

  return {
    asbDefinitionId,
    asbAuthorId: asbAuthor.id,
    examPageImagePaths,
    studentAnswerImagePaths,
    asbImagePaths: [asbImagePath],
  }
}

/**
 * データディレクトリの各相対パスの位置に、パスごとに中身の違う小さなファイルを置く。
 * 返り値は相対パス → 置いた中身
 */
export function writeDataDirectoryFiles(
  dataDirectory: string,
  relativePaths: readonly string[]
): Map<string, Buffer> {
  const contentsByPath = new Map<string, Buffer>()
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(dataDirectory, ...relativePath.split("/"))
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    const contents = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      Buffer.from(relativePath, "utf8"),
    ])
    fs.writeFileSync(absolutePath, contents)
    contentsByPath.set(relativePath, contents)
  }
  return contentsByPath
}
