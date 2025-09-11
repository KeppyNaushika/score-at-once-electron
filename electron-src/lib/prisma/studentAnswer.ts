import * as fs from "fs/promises"
import * as path from "path"
import {
  getAnswerSheetsDirectory,
  getRelativePathFromData,
} from "../dataManager"
import prisma from "./client"

// 答案画像のアップロード
export async function uploadStudentAnswers(
  projectId: string,
  filesData: {
    name: string
    type: string
    buffer: ArrayBuffer
    studentId?: string
    pageNumber?: number
  }[],
) {
  try {
    const projectDir = getAnswerSheetsDirectory(projectId)

    // プロジェクトディレクトリを作成
    await fs.mkdir(projectDir, { recursive: true })

    const uploadedSheets = []

    for (const fileData of filesData) {
      // ファイル名を正規化
      const timestamp = Date.now()
      const sanitizedName = fileData.name.replace(/[^a-zA-Z0-9\-_.]/g, "_")
      const fileName = `${timestamp}_${sanitizedName}`
      const filePath = path.join(projectDir, fileName)
      const relativePath = getRelativePathFromData(filePath)

      // ファイルを保存
      const buffer = Buffer.from(fileData.buffer)
      await fs.writeFile(filePath, buffer)

      // studentIdが必須の場合のみ処理を継続
      if (!fileData.studentId) {
        throw new Error(`Student ID is required for file: ${fileData.name}`)
      }

      // TODO: Fix this for new schema
      // 既存レコードの確認
      const existingRecord = null // await prisma.pageImage.findFirst({
      //   where: {
      //     projectPageId: projectPageId,
      //     studentId: fileData.studentId,
      //     imageType: "STUDENT_ANSWER"
      //   },
      // })

      // Find or create the appropriate ProjectPage for this pageNumber
      let projectPage = await prisma.projectPage.findFirst({
        where: {
          projectId: projectId,
          pageNumber: fileData.pageNumber || 1
        }
      })

      if (!projectPage) {
        projectPage = await prisma.projectPage.create({
          data: {
            projectId: projectId,
            pageNumber: fileData.pageNumber || 1
          }
        })
      }

      // データベースに記録（upsertで重複回避）
      const answerSheet = await prisma.pageImage.create({
        data: {
          projectPageId: projectPage.id, // Now using correct ProjectPage.id
          studentId: fileData.studentId,
          imagePath: relativePath,
          imageType: "STUDENT_ANSWER",
        },
      })

      // 上書きフラグを追加
      const resultSheet = {
        ...answerSheet,
        isOverwrite: !!existingRecord,
      }

      uploadedSheets.push(resultSheet)
    }

    return { success: true, answerSheets: uploadedSheets }
  } catch (error) {
    console.error("Error uploading answer sheets:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "答案のアップロードに失敗しました",
    }
  }
}

// プロジェクトの答案一覧を取得
export async function getStudentAnswersByProjectId(projectId: string) {
  try {
    const answerSheets = await prisma.pageImage.findMany({
      where: { 
        imageType: "STUDENT_ANSWER",
        projectPage: {
          projectId: projectId
        },
        studentId: { not: null } // Only include images with assigned students
      },
      include: {
        student: {
          include: {
            projectStudents: {
              where: { projectId },
              select: { customOrder: true, status: true }, // Include status to determine if absent
            },
          },
        },
        projectPage: {
          include: {
            project: true
          }
        },
      },
      orderBy: [{ studentId: "asc" }, { projectPage: { pageNumber: "asc" } }],
    })

    // Transform PageImage data to legacy format for backward compatibility
    const processedAnswerSheets = answerSheets
      .filter(sheet => sheet.student) // Ensure student exists
      .map((sheet) => {
        // Get ProjectStudent status to determine if absent
        const projectStudent = sheet.student?.projectStudents?.[0]
        const isAbsent = projectStudent?.status === "ABSENT"
        
        return {
          id: sheet.id,
          studentId: sheet.studentId,
          pageNumber: sheet.projectPage.pageNumber,
          projectPageId: sheet.projectPage.id, // Add projectPageId for page filtering
          imagePath: sheet.imagePath, // Keep imagePath for UI compatibility
          originalImagePath: sheet.imagePath, // Map imagePath to originalImagePath for backward compatibility
          isAbsent: isAbsent, // Properly determined from ProjectStudent.status
          student: sheet.student ? {
            id: sheet.student.id,
            lastName: sheet.student.lastName,
            firstName: sheet.student.firstName,
            lastNameKana: sheet.student.lastNameKana,
            firstNameKana: sheet.student.firstNameKana,
            studentId: sheet.student.studentId,
            projectStudents: sheet.student.projectStudents, // Include projectStudents for customOrder access
          } : null,
          projectId: sheet.projectPage.project.id,
          status: "ready" as const,
        }
      })

    return { success: true, answerSheets: processedAnswerSheets }
  } catch (error) {
    console.error("Error fetching answer sheets:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "答案の取得に失敗しました",
    }
  }
}

// 答案の削除
export async function deleteStudentAnswer(answerSheetId: string) {
  try {
    const answerSheet = await prisma.pageImage.findUnique({
      where: { id: answerSheetId },
    })

    if (!answerSheet) {
      throw new Error("答案が見つかりません")
    }

    // ファイルを削除
    const { getAbsolutePathFromData } = await import("../dataManager")
    const filePath = getAbsolutePathFromData(answerSheet.imagePath)

    try {
      await fs.unlink(filePath)
    } catch (fileError) {
      console.warn("Failed to delete file:", fileError)
    }

    // データベースから削除
    await prisma.pageImage.delete({
      where: { id: answerSheetId },
    })

    return { success: true }
  } catch (error) {
    console.error("Error deleting answer sheet:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "答案の削除に失敗しました",
    }
  }
}

// 答案と生徒の関連付け
export async function associateStudentAnswerWithStudent(
  answerSheetId: string,
  studentId: string,
) {
  try {
    const answerSheet = await prisma.pageImage.update({
      where: { id: answerSheetId },
      data: { studentId },
      include: {
        student: true,
        projectPage: {
          include: {
            project: true
          }
        },
      },
    })

    return { success: true, answerSheet }
  } catch (error) {
    console.error("Error associating answer sheet with student:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "生徒との関連付けに失敗しました",
    }
  }
}

// 答案の欠席状態を設定
export async function setStudentAnswerAbsent(
  answerSheetId: string,
  isAbsent: boolean,
) {
  try {
    const answerSheet = await prisma.pageImage.update({
      where: { id: answerSheetId },
      data: { 
        // TODO: Handle absent status in the new schema
        // isAbsent functionality needs to be implemented differently
      },
      include: {
        student: true,
        projectPage: {
          include: {
            project: true
          }
        },
      },
    })

    return { success: true, answerSheet }
  } catch (error) {
    console.error("Error setting answer sheet absent status:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "欠席状態の設定に失敗しました",
    }
  }
}

// 答案の詳細情報を取得
export async function getStudentAnswerById(answerSheetId: string) {
  try {
    const answerSheet = await prisma.pageImage.findUnique({
      where: { id: answerSheetId },
      include: {
        student: true,
        projectPage: {
          include: {
            project: {
              include: {
                projectPages: {
                  include: {
                    cropRegions: true,
                  }
                }
              }
            }
          },
        },
        // TODO: questionScores would need to be fetched separately in new schema
      },
    })

    if (!answerSheet) {
      throw new Error("答案が見つかりません")
    }

    return { success: true, answerSheet }
  } catch (error) {
    console.error("Error fetching answer sheet:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "答案の取得に失敗しました",
    }
  }
}

// 答案の配置情報を更新（生徒ID・ページ番号）
export async function updateStudentAnswerPlacement(
  answerSheetId: string,
  studentId: string | null,
  pageNumber: number,
) {
  try {
    // まず現在の答案情報を取得してprojectIdを確認
    const currentAnswerSheet = await prisma.pageImage.findUnique({
      where: { id: answerSheetId },
      select: { 
        projectPage: { 
          select: { 
            projectId: true 
          } 
        } 
      },
    })

    if (!currentAnswerSheet) {
      throw new Error("答案が見つかりません")
    }

    const answerSheet = await prisma.pageImage.update({
      where: { id: answerSheetId },
      data: {
        studentId,
        // TODO: Handle page changes in the new schema - might need to move to different ProjectPage
      },
      include: {
        student: {
          include: {
            projectStudents: {
              where: { projectId: currentAnswerSheet.projectPage.projectId },
              select: { customOrder: true },
            },
          },
        },
        projectPage: {
          include: {
            project: true
          }
        },
        // TODO: questionScores would need to be fetched separately in new schema
      },
    })

    return { success: true, answerSheet }
  } catch (error) {
    console.error("Error updating answer sheet placement:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "答案の配置更新に失敗しました",
    }
  }
}

// 2つの答案の配置を交換（ユニーク制約を考慮した安全な交換）
export async function swapStudentAnswerPlacements(
  answerSheetId1: string,
  answerSheetId2: string,
) {
  try {
    // トランザクション内で答案交換を実行
    const result = await prisma.$transaction(async (tx) => {
      // 2つの答案の現在の配置情報を取得
      const [answerSheet1, answerSheet2] = await Promise.all([
        tx.pageImage.findUnique({
          where: { id: answerSheetId1 },
          select: { 
            studentId: true, 
            projectPage: { 
              select: { 
                pageNumber: true, 
                projectId: true 
              } 
            } 
          },
        }),
        tx.pageImage.findUnique({
          where: { id: answerSheetId2 },
          select: { 
            studentId: true, 
            projectPage: { 
              select: { 
                pageNumber: true, 
                projectId: true 
              } 
            } 
          },
        }),
      ])

      if (!answerSheet1 || !answerSheet2) {
        throw new Error("答案が見つかりません")
      }

      // 一時的にanswerSheet1をnull配置に移動（制約回避）
      await tx.pageImage.update({
        where: { id: answerSheetId1 },
        data: {
          studentId: null,
          // TODO: Handle page swapping in new schema - might need to recreate PageImage in different ProjectPage
        },
      })

      // answerSheet2をanswerSheet1の元の位置に移動
      await tx.pageImage.update({
        where: { id: answerSheetId2 },
        data: {
          studentId: answerSheet1.studentId,
          // TODO: Handle pageNumber in new schema
        },
      })

      // answerSheet1をanswerSheet2の元の位置に移動
      await tx.pageImage.update({
        where: { id: answerSheetId1 },
        data: {
          studentId: answerSheet2.studentId,
          // TODO: Handle pageNumber in new schema
        },
      })

      // 更新後の答案情報を取得
      const [updatedAnswerSheet1, updatedAnswerSheet2] = await Promise.all([
        tx.pageImage.findUnique({
          where: { id: answerSheetId1 },
          include: {
            student: {
              include: {
                projectStudents: {
                  where: { projectId: answerSheet1.projectPage.projectId },
                  select: { customOrder: true },
                },
              },
            },
            projectPage: {
              include: {
                project: true
              }
            },
            // TODO: questionScores would need to be fetched separately in new schema
          },
        }),
        tx.pageImage.findUnique({
          where: { id: answerSheetId2 },
          include: {
            student: {
              include: {
                projectStudents: {
                  where: { projectId: answerSheet2.projectPage.projectId },
                  select: { customOrder: true },
                },
              },
            },
            projectPage: {
              include: {
                project: true
              }
            },
            // TODO: questionScores would need to be fetched separately in new schema
          },
        }),
      ])

      return { updatedAnswerSheet1, updatedAnswerSheet2 }
    })

    return {
      success: true,
      answerSheets: [result.updatedAnswerSheet1, result.updatedAnswerSheet2],
    }
  } catch (error) {
    console.error("Error swapping answer sheet placements:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "答案の配置交換に失敗しました",
    }
  }
}

// 複数の答案の配置を一括で変更（採点情報の移行も対応）
export async function batchUpdateStudentAnswerPlacements(
  moves: Array<{
    fileId: string
    finalStudentId: string | null
    finalPageNumber: number
  }>,
  withScoring: boolean = false
) {
  console.log("🔄 [Electron] Starting batch placement update:", {
    movesCount: moves.length,
    withScoring,
    moves: moves.map(m => ({ fileId: m.fileId.substring(0, 8) + "...", to: `${m.finalStudentId?.substring(0, 8) || 'null'}...p${m.finalPageNumber}` }))
  })

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 移動対象の答案情報と採点データを取得
      const answerSheets = await Promise.all(
        moves.map(move => 
          tx.pageImage.findUnique({
            where: { id: move.fileId },
            select: { 
              id: true,
              studentId: true,
              projectPage: {
                select: {
                  projectId: true,
                  pageNumber: true
                }
              }
            },
          })
        )
      )

      console.log("📄 [Electron] Found answer sheets:", answerSheets.filter(Boolean).length)

      // 見つからない答案をチェック
      const missingSheets = moves.filter((_, index) => !answerSheets[index])
      if (missingSheets.length > 0) {
        throw new Error(`答案が見つかりません: ${missingSheets.map(m => m.fileId).join(', ')}`)
      }

      let allQuestionScores: any[] = []

      if (withScoring) {
        // 全ての採点データを取得
        // TODO: QuestionScore querying needs to be updated for new schema
        // In new schema, scores are linked to students and crop regions, not answer sheets directly
        allQuestionScores = [] // await tx.questionScore.findMany({
        //   where: { 
        //     studentId: { 
        //       in: moves.map(m => m.finalStudentId).filter(Boolean) 
        //     } 
        //   },
        // })

        console.log("📊 [Electron] Found question scores:", allQuestionScores.length)

        // TODO: Delete scoring data needs to be updated for new schema
        // 一時的に採点データを削除（制約回避）
        // await tx.questionScore.deleteMany({
        //   where: { 
        //     studentId: { 
        //       in: moves.map(m => m.finalStudentId).filter(Boolean) 
        //     } 
        //   },
        // })
      }

      // 一時的に全ての答案をnull位置に移動（制約回避）
      await Promise.all(
        moves.map((_, index) => 
          tx.pageImage.update({
            where: { id: moves[index].fileId },
            data: {
              studentId: null,
              // TODO: Handle temporary pageNumber assignment in new schema
            },
          })
        )
      )

      // 各答案を最終位置に移動
      await Promise.all(
        moves.map(move => 
          tx.pageImage.update({
            where: { id: move.fileId },
            data: {
              studentId: move.finalStudentId,
              // TODO: Handle pageNumber assignment in new schema - might need to move to different ProjectPage
            },
          })
        )
      )

      if (withScoring && allQuestionScores.length > 0) {
        // 採点データを復元（答案IDは変更せず、位置情報が変わっただけ）
        await tx.questionScore.createMany({
          data: [], // TODO: Update for new schema
          // allQuestionScores.map((score) => ({
          //   cropRegionId: score.cropRegionId,
          //   studentId: score.studentId,
          //   status: score.status,
          //   scoredByUserId: score.scoredByUserId,
          // })),
        })
      }

      console.log("✅ [Electron] Batch placement update transaction completed")
      return { success: true }
    })

    console.log("✅ [Electron] Batch placement update completed successfully")
    return result
  } catch (error) {
    console.error("❌ [Electron] Error in batch placement update:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "一括配置変更に失敗しました",
    }
  }
}

// 2つの答案の配置を交換（採点情報も一緒に入れ替え）
export async function swapStudentAnswerPlacementsWithScoring(
  answerSheetId1: string,
  answerSheetId2: string,
) {
  console.log("🔄 [Electron] Starting swap with scoring:", answerSheetId1, "↔", answerSheetId2)
  console.log("🔄 [Electron] Transaction starting...")
  try {
    // トランザクション内で答案交換を実行
    const result = await prisma.$transaction(async (tx) => {
      // 2つの答案の現在の配置情報を取得
      const [answerSheet1, answerSheet2] = await Promise.all([
        tx.pageImage.findUnique({
          where: { id: answerSheetId1 },
          select: { 
            studentId: true, 
            projectPage: { 
              select: { 
                pageNumber: true, 
                projectId: true 
              } 
            } 
          },
        }),
        tx.pageImage.findUnique({
          where: { id: answerSheetId2 },
          select: { 
            studentId: true, 
            projectPage: { 
              select: { 
                pageNumber: true, 
                projectId: true 
              } 
            } 
          },
        }),
      ])

      console.log("📄 [Electron] Found answer sheets:", {
        answerSheet1: answerSheet1 ? { studentId: answerSheet1.studentId, pageNumber: answerSheet1.projectPage.pageNumber } : null,
        answerSheet2: answerSheet2 ? { studentId: answerSheet2.studentId, pageNumber: answerSheet2.projectPage.pageNumber } : null
      })

      if (!answerSheet1 || !answerSheet2) {
        throw new Error("答案が見つかりません")
      }

      // 両方の答案に関連する採点データを取得
      // TODO: QuestionScore queries need to be updated for new schema
      const [questionScores1, questionScores2] = [[], []] // await Promise.all([
      //   tx.questionScore.findMany({
      //     where: { studentId: answerSheet1.studentId },
      //   }),
      //   tx.questionScore.findMany({
      //     where: { studentId: answerSheet2.studentId },
      //   }),
      // ])

      console.log("📊 [Electron] Found question scores:", {
        questionScores1Count: questionScores1.length,
        questionScores2Count: questionScores2.length
      })

      // TODO: Score deletion needs to be updated for new schema
      // 採点データを一時的に削除（制約回避のため）
      // await Promise.all([
      //   tx.questionScore.deleteMany({
      //     where: { studentId: answerSheet1.studentId },
      //   }),
      //   tx.questionScore.deleteMany({
      //     where: { studentId: answerSheet2.studentId },
      //   }),
      // ])

      // 一時的にanswerSheet1をnull配置に移動（制約回避）
      await tx.pageImage.update({
        where: { id: answerSheetId1 },
        data: {
          studentId: null,
          // TODO: Handle page swapping in new schema - might need to recreate PageImage in different ProjectPage
        },
      })

      // answerSheet2をanswerSheet1の元の位置に移動
      await tx.pageImage.update({
        where: { id: answerSheetId2 },
        data: {
          studentId: answerSheet1.studentId,
          // TODO: Handle pageNumber in new schema
        },
      })

      // answerSheet1をanswerSheet2の元の位置に移動
      await tx.pageImage.update({
        where: { id: answerSheetId1 },
        data: {
          studentId: answerSheet2.studentId,
          // TODO: Handle pageNumber in new schema
        },
      })

      // 採点データを入れ替えて復元
      // TODO: Score migration needs to be updated for new schema
      // answerSheet1の採点データをanswerSheet2に移行
      // if (questionScores1.length > 0) {
      //   await tx.questionScore.createMany({
      //     data: questionScores1.map((score) => ({
      //       cropRegionId: score.cropRegionId,
      //       studentId: answerSheet2.studentId,
      //       status: score.status,
      //       scoredByUserId: score.scoredByUserId,
      //     })),
      //   })
      // }

      // answerSheet2の採点データをanswerSheet1に移行
      // if (questionScores2.length > 0) {
      //   await tx.questionScore.createMany({
      //     data: questionScores2.map((score) => ({
      //       cropRegionId: score.cropRegionId,
      //       studentId: answerSheet1.studentId,
      //       status: score.status,
      //       scoredByUserId: score.scoredByUserId,
      //     })),
      //   })
      // }

      // 更新後の答案情報を取得
      const [updatedAnswerSheet1, updatedAnswerSheet2] = await Promise.all([
        tx.pageImage.findUnique({
          where: { id: answerSheetId1 },
          include: {
            student: {
              include: {
                projectStudents: {
                  where: { projectId: answerSheet1.projectPage.projectId },
                  select: { customOrder: true },
                },
              },
            },
            projectPage: {
              include: {
                project: true
              }
            },
            // TODO: questionScores would need to be fetched separately in new schema
          },
        }),
        tx.pageImage.findUnique({
          where: { id: answerSheetId2 },
          include: {
            student: {
              include: {
                projectStudents: {
                  where: { projectId: answerSheet2.projectPage.projectId },
                  select: { customOrder: true },
                },
              },
            },
            projectPage: {
              include: {
                project: true
              }
            },
            // TODO: questionScores would need to be fetched separately in new schema
          },
        }),
      ])

      console.log("✅ [Electron] Transaction completed successfully")
      console.log("📝 [Electron] Final answer sheet positions:", {
        answerSheet1: { id: answerSheetId1, studentId: updatedAnswerSheet1?.studentId, pageNumber: updatedAnswerSheet1?.projectPage?.pageNumber },
        answerSheet2: { id: answerSheetId2, studentId: updatedAnswerSheet2?.studentId, pageNumber: updatedAnswerSheet2?.projectPage?.pageNumber }
      })
      return { updatedAnswerSheet1, updatedAnswerSheet2 }
    })

    console.log("✅ [Electron] Swap with scoring completed successfully")
    return {
      success: true,
      answerSheets: [result.updatedAnswerSheet1, result.updatedAnswerSheet2],
    }
  } catch (error) {
    console.error("❌ [Electron] Error swapping answer sheet placements with scoring:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "採点情報込み答案配置交換に失敗しました",
    }
  }
}
