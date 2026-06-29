/**
 * 成績算出アーカイブのインポート
 */

import type { Prisma } from "@prisma/client"
import { randomUUID } from "crypto"

import type {
  CourseworkImportDecision,
  GradeArchiveData,
  GradeArchiveImportOptions,
  GradeArchiveImportPreview,
} from "../../../../src/types/gradeArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
import prisma from "../../prisma/client"
import { importCourseworkData } from "../coursework-archive/dataCreator"

/**
 * インポート前のプレビュー（照合結果）
 */
export async function previewGradeArchiveImport(
  data: GradeArchiveData
): Promise<GradeArchiveImportPreview> {
  const { gradeData, manualScoresData } = data

  // Class照合（複数学級対応）
  const classMatches = await Promise.all(
    gradeData.classRefs.map(async (ref) => {
      const existing = await prisma.class.findUnique({
        where: { name: ref.name },
      })
      return { found: !!existing, name: ref.name }
    })
  )

  // ExamExam照合
  const examMatches = await Promise.all(
    gradeData.examRefs.map(async (ref) => {
      const exams = await prisma.exam.findMany({
        where: { examName: ref.examName },
        select: { id: true },
      })
      return {
        examName: ref.examName,
        found: exams.length > 0,
        examId: exams[0]?.id ?? null,
      }
    })
  )

  // 埋め込み資料の照合候補（v1.5.0: courseworkArchive / v1.4.0: courseworks）
  const cwPreviewItems = data.courseworkArchive
    ? data.courseworkArchive.courseworks.map((cw) => ({
        id: cw.id,
        name: cw.name,
        itemCount: cw.items.length,
        studentCount: cw.students.length,
      }))
    : (data.courseworks ?? []).map((cw) => ({
        id: cw.id,
        name: cw.name,
        itemCount: cw.items.length,
        studentCount: cw.students.length,
      }))

  // Student照合
  const courseworkStudentNumbers = data.courseworkArchive
    ? data.courseworkArchive.studentsData.map((s) => s.studentNumber)
    : (data.courseworks ?? []).flatMap((cw) => [
        ...cw.students.map((s) => s.studentNumber),
        ...cw.items.flatMap((item) =>
          item.scores.map((sc) => sc.studentNumber)
        ),
      ])
  const studentNumbers = [
    ...new Set(
      (manualScoresData?.manualScores ?? []).map((ms) => ms.studentNumber)
    ),
    ...courseworkStudentNumbers,
    ...gradeData.studentRefs.map((s) => s.studentNumber),
  ]
  const uniqueNumbers = [...new Set(studentNumbers)]
  const existingStudents = await prisma.student.findMany({
    where: { studentNumber: { in: uniqueNumbers } },
    select: { studentNumber: true },
  })
  const existingNumberSet = new Set(
    existingStudents.map((s) => s.studentNumber)
  )

  // 埋め込み資料のマッチング候補（uuid一次・名前二次）を算出
  const courseworkMatches = await Promise.all(
    cwPreviewItems.map(async (cw) => {
      // uuid 完全一致（同一PC由来）
      const uuidMatch = cw.id
        ? await prisma.coursework.findUnique({
            where: { id: cw.id },
            select: { id: true, name: true },
          })
        : null
      // 名前一致候補（名前は非ユニークなので複数あり得る。uuid一致は除外）
      const nameCandidates = (
        await prisma.coursework.findMany({
          where: { name: cw.name },
          select: { id: true, name: true },
        })
      ).filter((c) => c.id !== uuidMatch?.id)
      return {
        archiveId: cw.id,
        name: cw.name,
        itemCount: cw.itemCount,
        studentCount: cw.studentCount,
        uuidMatch: uuidMatch ?? null,
        nameCandidates,
      }
    })
  )

  return {
    manifest: data.manifest,
    classMatches,
    examMatches,
    studentMatchCount: uniqueNumbers.filter((sn) => existingNumberSet.has(sn))
      .length,
    studentMissingCount: uniqueNumbers.filter(
      (sn) => !existingNumberSet.has(sn)
    ).length,
    courseworkMatches,
  }
}

/**
 * 実際のインポート実行
 */
export async function importGradeArchive(
  data: GradeArchiveData,
  options: GradeArchiveImportOptions = {}
): Promise<{
  success: boolean
  gradeId?: string
  error?: string
  /** 取り込み時の警告（点数スキップ・参照先未検出など）。空なら省略 */
  warnings?: string[]
}> {
  try {
    const { examMapping, courseworkDecisions = {} } = options
    const warnings: string[] = []
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const { gradeData, boundariesData } = data

        // 1. Grade作成
        const gp = await tx.grade.create({
          data: {
            name: gradeData.grade.name,
            description: gradeData.grade.description,
            // v1.2.0+: 基準日（古いアーカイブではundefined → null）
            referenceDate: gradeData.grade.referenceDate
              ? new Date(gradeData.grade.referenceDate)
              : null,
          },
        })

        // 1.5. GradeExportSettings作成 (v1.2.0+、Gradeと1:1)
        if (gradeData.exportSettings) {
          await tx.gradeExportSettings.create({
            data: {
              gradeId: gp.id,
              settingsJson: gradeData.exportSettings.settingsJson,
            },
          })
        }

        // 2. Class照合→GradeClass作成
        for (let i = 0; i < gradeData.classRefs.length; i++) {
          const ref = gradeData.classRefs[i]
          const cls = await tx.class.findUnique({
            where: { name: ref.name },
          })
          if (cls) {
            await tx.gradeClass.create({
              data: {
                gradeId: gp.id,
                classId: cls.id,
                order: i,
              },
            })
          }
        }

        // 3. Student照合→GradeStudent作成
        for (const studentRef of gradeData.studentRefs) {
          const student = await tx.student.findUnique({
            where: { studentNumber: studentRef.studentNumber },
          })
          if (student) {
            await tx.gradeStudent.create({
              data: {
                gradeId: gp.id,
                studentId: student.id,
                customOrder: studentRef.customOrder,
              },
            })
          }
        }

        // 3.5. Coursework（試験外成績資料）の復元 / 旧v1.3.0からの変換
        //   courseworkName + courseworkItemName → courseworkItem.id のマップを作る
        // 解決済み評価項目: アーカイブ項目uuid・名前の双方から実IDを引けるようにする
        type ArchiveCwItem = {
          id: string
          name: string
          order: number
          maxScore: number
          inputMode: string
          letterScales: { label: string; score: number; order: number }[]
          scores: {
            studentNumber: string
            score: number | null
            letterValue: string | null
            adjustment: number | null
            adjustmentReason: string | null
            comment: string | null
          }[]
        }
        type ArchiveCw = {
          id: string
          name: string
          description: string | null
          date: string | null
          classes: { className: string; order: number }[]
          tags: { tagName: string }[]
          students: { studentNumber: string; customOrder: number | null }[]
          items: ArchiveCwItem[]
        }
        // 生徒は学籍番号で一括解決（点数行ごとの findUnique による N+1 を回避）
        const allStudentNumbers = [
          ...new Set([
            ...gradeData.studentRefs.map((s) => s.studentNumber),
            ...(data.manualScoresData?.manualScores ?? []).map(
              (m) => m.studentNumber
            ),
            ...(data.courseworks ?? []).flatMap((cw) => [
              ...cw.students.map((s) => s.studentNumber),
              ...cw.items.flatMap((it) =>
                it.scores.map((sc) => sc.studentNumber)
              ),
            ]),
          ]),
        ]
        const studentRows = await tx.student.findMany({
          where: { studentNumber: { in: allStudentNumbers } },
          select: { id: true, studentNumber: true },
        })
        const studentIdByNumber = new Map(
          studentRows.map((s) => [s.studentNumber, s.id])
        )

        /** アーカイブ項目uuid → 実 CourseworkItem.id（一次キー） */
        const itemIdToActual = new Map<string, string>()
        /** `${courseworkName}:${itemName}` → 実 CourseworkItem.id（uuid解決不能時の名前フォールバック） */
        const itemNameToActual = new Map<string, string>()
        /** 旧v1.3.0変換用: `${gradeItemName}:${dataSourceName}` → 生成した評価項目uuid（同名衝突回避） */
        const legacyManualItemArchiveId = new Map<string, string>()
        const registerItem = (
          cwName: string,
          archiveItemId: string,
          itemName: string,
          actualId: string
        ) => {
          if (archiveItemId) itemIdToActual.set(archiveItemId, actualId)
          itemNameToActual.set(`${cwName}:${itemName}`, actualId)
        }

        /** 評価項目1件を新規作成（変換表・点数も投入）し実IDを返す */
        const createItemRow = async (
          courseworkId: string,
          itemId: string | undefined,
          cwName: string,
          item: ArchiveCwItem
        ): Promise<string> => {
          const created = await tx.courseworkItem.create({
            data: {
              ...(itemId ? { id: itemId } : {}),
              courseworkId,
              name: item.name,
              order: item.order,
              maxScore: item.maxScore,
              inputMode: item.inputMode || "numeric",
              ...(item.letterScales.length > 0 && {
                letterScales: {
                  create: item.letterScales.map((ls) => ({
                    label: ls.label,
                    score: ls.score,
                    order: ls.order,
                  })),
                },
              }),
            },
          })
          for (const sc of item.scores) {
            const studentId = studentIdByNumber.get(sc.studentNumber)
            if (!studentId) {
              warnings.push(
                `試験外成績資料「${cwName}」評価項目「${item.name}」: 生徒「${sc.studentNumber}」が見つからないため点数をスキップしました`
              )
              continue
            }
            await tx.courseworkScore.create({
              data: {
                courseworkItemId: created.id,
                studentId,
                score: sc.score,
                letterValue: sc.letterValue,
                adjustment: sc.adjustment ?? 0,
                adjustmentReason: sc.adjustmentReason,
                comment: sc.comment,
              },
            })
          }
          return created.id
        }

        /**
         * 資料を取り込む。照合は uuid 一次・名前二次（名前はユーザー判断のみ）。
         * - decision.reuse: 指定の既存資料を流用し、不足項目だけ補完（点数の上書きはしない）
         * - decision.new: 常に新規作成（uuid衝突回避のため新uuid）
         * - decision未指定: uuid一致があれば流用、無ければ元uuidを保持して新規（再インポートで冪等）
         */
        const ensureCoursework = async (
          cw: ArchiveCw,
          decision?: CourseworkImportDecision
        ): Promise<void> => {
          // 1. 流用先の決定（reuseId が決まれば既存に reconcile）
          let reuseId: string | null = null
          if (decision?.action === "reuse") {
            const exists = await tx.coursework.findUnique({
              where: { id: decision.existingId },
              select: { id: true },
            })
            reuseId = exists?.id ?? null
            if (!reuseId) {
              warnings.push(
                `試験外成績資料「${cw.name}」: 指定された統合先が見つからないため新規作成しました`
              )
            }
          } else if (!decision) {
            const uuidMatch = cw.id
              ? await tx.coursework.findUnique({
                  where: { id: cw.id },
                  select: { id: true },
                })
              : null
            reuseId = uuidMatch?.id ?? null
          }

          if (reuseId) {
            // 既存資料を流用: 不足している項目のみ補完（名簿・学級・タグ・既存点数は触らない）
            const existing = await tx.coursework.findUnique({
              where: { id: reuseId },
              include: { items: { select: { id: true, name: true } } },
            })
            if (existing) {
              const existingByName = new Map(
                existing.items.map((i) => [i.name, i.id])
              )
              const reusedItemNames: string[] = []
              for (const item of cw.items) {
                const existingItemId = existingByName.get(item.name)
                if (existingItemId) {
                  // 既存項目はそのまま流用し、点数・満点・変換表は上書きしない
                  registerItem(cw.name, item.id, item.name, existingItemId)
                  reusedItemNames.push(item.name)
                } else {
                  const newId = await createItemRow(
                    reuseId,
                    randomUUID(),
                    cw.name,
                    item
                  )
                  registerItem(cw.name, item.id, item.name, newId)
                }
              }
              // 既存項目の点数を上書きしない挙動を明示（無音の不整合を避ける）
              if (reusedItemNames.length > 0) {
                warnings.push(
                  `試験外成績資料「${cw.name}」: 既存の評価項目（${reusedItemNames.join("、")}）は統合先の点数を保持し、アーカイブの点数では上書きしませんでした`
                )
              }
              return
            }
          }

          // 2. 新規作成。元uuidを保持するのは「decision未指定でuuid不一致」の初回取込のみ（冪等化）。
          //    明示的 new は uuid一致した元資料とのPK衝突を避けるため新uuid。
          const preserveUuids = !decision
          const newCourseworkId = preserveUuids && cw.id ? cw.id : randomUUID()
          const created = await tx.coursework.create({
            data: {
              id: newCourseworkId,
              name: cw.name,
              description: cw.description,
              date: cw.date ? new Date(cw.date) : null,
            },
          })

          // 学級（学級名→既存Class.id 解決、無ければスキップ+warning）
          for (const c of cw.classes) {
            const cls = await tx.class.findUnique({
              where: { name: c.className },
            })
            if (!cls) {
              warnings.push(
                `試験外成績資料「${cw.name}」: 学級「${c.className}」が見つからないためスキップしました`
              )
              continue
            }
            await tx.courseworkClass.create({
              data: {
                courseworkId: created.id,
                classId: cls.id,
                order: c.order,
              },
            })
          }

          // タグ（タグ名→ findOrCreate 相当）
          for (const t of cw.tags) {
            const tag = await tx.tag.upsert({
              where: { name: t.tagName },
              create: { name: t.tagName },
              update: {},
            })
            await tx.courseworkTag.create({
              data: { courseworkId: created.id, tagId: tag.id },
            })
          }

          // 名簿（学籍番号→既存Student.id 解決）
          for (const s of cw.students) {
            const studentId = studentIdByNumber.get(s.studentNumber)
            if (!studentId) {
              warnings.push(
                `試験外成績資料「${cw.name}」: 生徒「${s.studentNumber}」が見つからないため名簿から除外しました`
              )
              continue
            }
            await tx.courseworkStudent.create({
              data: {
                courseworkId: created.id,
                studentId,
                customOrder: s.customOrder,
              },
            })
          }

          // 評価項目 + 変換表 + 点数
          for (const item of cw.items) {
            const newItemId = await createItemRow(
              created.id,
              preserveUuids ? item.id : randomUUID(),
              cw.name,
              item
            )
            registerItem(cw.name, item.id, item.name, newItemId)
          }
        }

        if (data.courseworkArchive) {
          // v1.5.0+: 独立 coursework モジュールへ委譲（収集・生成ロジックの二重実装を解消）。
          //   既存生徒・学級への lookup のみ（allowCreate=false）で grade の従来挙動を維持する。
          const cwResult = await importCourseworkData(
            tx,
            data.courseworkArchive,
            {
              allowCreate: false,
              studentMatching: "studentNumber",
              courseworkDecisions,
            }
          )
          warnings.push(...cwResult.warnings)
          // DataSource 再リンク用: アーカイブ項目uuid → 実 CourseworkItem.id
          for (const [archiveItemId, actualId] of cwResult.itemIdMap) {
            itemIdToActual.set(archiveItemId, actualId)
          }
          // 名前フォールバック（uuid 不一致時）
          for (const cw of data.courseworkArchive.courseworks) {
            for (const item of cw.items) {
              const actual = cwResult.itemIdMap.get(item.id)
              if (actual)
                itemNameToActual.set(`${cw.name}:${item.name}`, actual)
            }
          }
        } else if (data.courseworks && data.courseworks.length > 0) {
          // v1.4.0: 名前ベース埋め込み資料を復元（資料ごとのユーザー判断を適用）
          for (const cw of data.courseworks) {
            await ensureCoursework(cw, courseworkDecisions[cw.id])
          }
        } else {
          // 旧 v1.3.0 後方互換: manual型 DataSource を Coursework(1項目) へ変換
          const legacyManualScores = data.manualScoresData?.manualScores ?? []
          let converted = false
          for (const giData of gradeData.gradeItems) {
            for (const dsData of giData.dataSources) {
              if (dsData.type !== "manual") continue
              converted = true
              // 当該gradeの対象生徒を名簿に（GradeStudentと同じ studentRefs）
              const cwStudents = gradeData.studentRefs.map((s) => ({
                studentNumber: s.studentNumber,
                customOrder: s.customOrder,
              }))
              const itemScores = legacyManualScores
                .filter(
                  (ms) =>
                    ms.gradeItemName === giData.name &&
                    ms.dataSourceName === dsData.name
                )
                .map((ms) => ({
                  studentNumber: ms.studentNumber,
                  score: ms.score,
                  letterValue: ms.letterValue ?? null,
                  adjustment: ms.adjustment ?? null,
                  adjustmentReason: ms.adjustmentReason ?? null,
                  comment: ms.comment ?? null,
                }))
              // 同名の manual データソースが別の評価項目に複数あっても衝突しないよう、
              // 評価項目uuidを生成して (gradeItemName, dataSourceName) で控え、後段で uuid 解決する。
              const legacyItemId = randomUUID()
              legacyManualItemArchiveId.set(
                `${giData.name}:${dsData.name}`,
                legacyItemId
              )
              await ensureCoursework({
                id: randomUUID(),
                name: dsData.name,
                description: null,
                date: null,
                classes: [],
                tags: [],
                students: cwStudents,
                items: [
                  {
                    id: legacyItemId,
                    name: dsData.name,
                    order: 0,
                    maxScore: dsData.maxScore,
                    inputMode: dsData.inputMode ?? "numeric",
                    letterScales: dsData.letterScales ?? [],
                    scores: itemScores,
                  },
                ],
              })
            }
          }
          if (converted) {
            warnings.push("v1.3.0 の外部成績を試験外成績資料に変換しました")
          }
        }

        // 4. GradeItem + DataSource作成
        for (const giData of gradeData.gradeItems) {
          const gi = await tx.gradeItem.create({
            data: {
              gradeId: gp.id,
              name: giData.name,
              order: giData.order,
            },
          })

          for (const dsData of giData.dataSources) {
            // 旧アーカイブ互換: project_total → exam_total
            if (dsData.type === "project_total") {
              dsData.type = "exam_total"
            }

            // CourseworkItem 解決（uuid一次・名前二次。旧"manual"は名前で変換済み）
            let courseworkItemId: string | null = null
            if (dsData.type === "manual") {
              // 旧 v1.3.0 の manual を coursework へ昇格。
              // 同名 manual が複数評価項目にあっても衝突しないよう、評価項目修飾キー
              // (gradeItemName, dataSourceName) で控えた uuid から解決する。
              dsData.type = "coursework"
              const legacyItemId = legacyManualItemArchiveId.get(
                `${giData.name}:${dsData.name}`
              )
              courseworkItemId = legacyItemId
                ? (itemIdToActual.get(legacyItemId) ?? null)
                : null
            } else if (dsData.type === "coursework") {
              // v1.4.0+: アーカイブ項目uuidで一次解決
              if (dsData.courseworkItemId) {
                courseworkItemId =
                  itemIdToActual.get(dsData.courseworkItemId) ?? null
              }
              // 名前フォールバック（uuid不一致・旧v1.4.0アーカイブ）
              if (
                !courseworkItemId &&
                dsData.courseworkName &&
                dsData.courseworkItemName
              ) {
                courseworkItemId =
                  itemNameToActual.get(
                    `${dsData.courseworkName}:${dsData.courseworkItemName}`
                  ) ?? null
              }
              if (!courseworkItemId) {
                warnings.push(
                  `成績項目「${giData.name}」のデータソース「${dsData.name}」: 参照先の試験外成績資料が見つかりませんでした`
                )
              }
            }

            let examId: string | null = null
            if (
              dsData.examName &&
              (dsData.type === "exam_total" ||
                dsData.type === "subtotal" ||
                dsData.type === "crop_region")
            ) {
              examId = examMapping?.[dsData.examName] ?? null
              if (!examId) {
                const exams = await tx.exam.findMany({
                  where: { examName: dsData.examName },
                  select: { id: true },
                })
                examId = exams[0]?.id ?? null
              }
            }

            // Subtotal照合（名前ベース）
            let subtotalId: string | null = null
            if (dsData.type === "subtotal" && dsData.subtotalName && examId) {
              const subtotals = await tx.subtotal.findMany({
                where: { name: dsData.subtotalName },
              })
              subtotalId = subtotals[0]?.id ?? null
            }

            // CropRegion照合（ラベルベース）
            let cropRegionId: string | null = null
            if (
              dsData.type === "crop_region" &&
              dsData.cropRegionLabel &&
              examId
            ) {
              const regions = await tx.cropRegion.findMany({
                where: {
                  label: dsData.cropRegionLabel,
                  examPage: { examId: examId },
                },
              })
              cropRegionId = regions[0]?.id ?? null
            }

            await tx.gradeDataSource.create({
              data: {
                gradeItemId: gi.id,
                type: dsData.type,
                examId,
                subtotalId,
                cropRegionId,
                courseworkItemId,
                name: dsData.name,
                maxScore: dsData.maxScore,
                weight: dsData.weight,
                order: dsData.order,
                absentMethod: dsData.absentMethod ?? "null",
                absentRatio: dsData.absentRatio ?? 1.0,
                absentOffset: dsData.absentOffset ?? 0,
                treatExpectedAsMissing: dsData.treatExpectedAsMissing ?? false,
                estimationMode: dsData.estimationMode ?? "all",
                estimationSourceIds: JSON.stringify(
                  dsData.estimationSourceIds ?? []
                ),
              },
            })
          }
        }

        // 5. （v1.4.0で廃止）旧 ManualScore 挿入は Coursework 復元(3.5)に統合済み

        // 6. BoundarySet/Boundary挿入
        for (const bsData of boundariesData.boundarySets) {
          let gradeItemId: string | null = null
          if (bsData.gradeItemName) {
            // GradeItem名で照合（同じ試験内）
            const gi = await tx.gradeItem.findFirst({
              where: {
                gradeId: gp.id,
                name: bsData.gradeItemName,
              },
            })
            gradeItemId = gi?.id ?? null
            if (!gradeItemId) continue
          }

          const bs = await tx.gradeBoundarySet.create({
            data: {
              gradeId: gp.id,
              targetType: bsData.targetType,
              gradeItemId,
            },
          })

          if (bsData.boundaries.length > 0) {
            await tx.gradeBoundary.createMany({
              data: bsData.boundaries.map((b) => ({
                gradeBoundarySetId: bs.id,
                label: b.label,
                minPercentage: b.minPercentage,
                order: b.order,
              })),
            })
          }
        }

        // 7. GradeItemExclusion挿入（後方互換: optionalフィールド）
        if (
          gradeData.gradeItemExclusions &&
          gradeData.gradeItemExclusions.length > 0
        ) {
          for (const excl of gradeData.gradeItemExclusions) {
            const student = await tx.student.findUnique({
              where: { studentNumber: excl.studentNumber },
            })
            if (!student) continue

            const gradeItem = await tx.gradeItem.findFirst({
              where: {
                gradeId: gp.id,
                name: excl.gradeItemName,
              },
            })
            if (!gradeItem) continue

            await tx.gradeItemExclusion.create({
              data: {
                gradeId: gp.id,
                studentId: student.id,
                gradeItemId: gradeItem.id,
              },
            })
          }
        }

        // 8. GradeOverride挿入（後方互換: optionalフィールド）
        if (gradeData.gradeOverrides && gradeData.gradeOverrides.length > 0) {
          for (const ov of gradeData.gradeOverrides) {
            const student = await tx.student.findUnique({
              where: { studentNumber: ov.studentNumber },
            })
            if (!student) continue

            let gradeItemId: string | null = null
            if (ov.gradeItemName) {
              const gradeItem = await tx.gradeItem.findFirst({
                where: {
                  gradeId: gp.id,
                  name: ov.gradeItemName,
                },
              })
              if (!gradeItem) continue
              gradeItemId = gradeItem.id
            }

            await tx.gradeOverride.create({
              data: {
                gradeId: gp.id,
                studentId: student.id,
                targetType: ov.targetType,
                gradeItemId,
                overrideLabel: ov.overrideLabel,
              },
            })
          }
        }

        return { success: true, gradeId: gp.id }
      }
    )

    if (warnings.length > 0) {
      console.warn("Grade archive import warnings:", warnings)
    }

    // 監査ログ: 成績インポート
    await recordAuditLog({
      action: "grade.import",
      entityType: "Grade",
      entityId: result.gradeId ?? "",
      scopeId: result.gradeId ?? null,
      scopeLabel: data.gradeData.grade.name,
      target: data.gradeData.grade.name,
    })

    // 警告は呼び出し側（UI）へ返して通知する
    return { ...result, warnings: warnings.length > 0 ? warnings : undefined }
  } catch (error) {
    console.error("Error importing grade archive:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
