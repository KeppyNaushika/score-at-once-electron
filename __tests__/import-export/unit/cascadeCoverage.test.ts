/**
 * ID変更時のカスケード網羅性テスト（schema.prisma 駆動 / convention-as-code）
 *
 * 「書き出したPCに合わせる」(idChangeExecutor) は対象レコードを削除して作り直すため、
 * 対象に onDelete:Cascade で紐づく子テーブルを削除前に移し替えないとカスケード削除される。
 *
 * このテストは schema.prisma を直接解析して各対象の onDelete:Cascade 子テーブルを
 * 列挙し、idChangeExecutor のレジストリ（*_CASCADE_MOVERS）と完全一致することを検証する。
 * 新しいカスケードFKを schema に追加してレジストリへの登録を忘れると、このテストが
 * 失敗して気付ける（規約をコードで強制する仕組み）。
 */

import { readFileSync } from "fs"
import { resolve } from "path"
import { describe, expect, it } from "vitest"

import {
  CLASSROOM_CASCADE_MOVERS,
  STUDENT_CASCADE_MOVERS,
  SUBTOTAL_GROUP_CASCADE_MOVERS,
} from "../../../electron-src/lib/import/merge/idChangeExecutor"

/**
 * schema.prisma を解析し、target モデルへ onDelete:Cascade で参照している
 * （FKを持つ＝owning側の）モデル名の集合を返す。
 */
function cascadeChildrenFromSchema(target: string): string[] {
  const src = readFileSync(
    resolve(process.cwd(), "prisma/schema.prisma"),
    "utf8"
  )
  const modelRe = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm
  const found = new Set<string>()
  let modelMatch: RegExpExecArray | null
  while ((modelMatch = modelRe.exec(src)) !== null) {
    const modelName = modelMatch[1]
    const body = modelMatch[2]
    for (const line of body.split("\n")) {
      // 例: "  student   Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)"
      const relationMatch = line.match(
        /^\s*\w+\s+(\w+)\??\s+@relation\(([^)]*)\)/
      )
      if (!relationMatch) continue
      const relType = relationMatch[1]
      const args = relationMatch[2]
      if (relType !== target) continue
      // owning側（FKを持つ側）かつ onDelete:Cascade のみ対象
      if (!/fields:\s*\[/.test(args)) continue
      if (!/onDelete:\s*Cascade/.test(args)) continue
      found.add(modelName)
    }
  }
  return [...found].sort()
}

describe("ID変更時のカスケード網羅性（schema.prisma駆動）", () => {
  const cases = [
    { target: "Student", movers: STUDENT_CASCADE_MOVERS },
    { target: "Classroom", movers: CLASSROOM_CASCADE_MOVERS },
    { target: "SubtotalGroup", movers: SUBTOTAL_GROUP_CASCADE_MOVERS },
  ]

  for (const { target, movers } of cases) {
    it(`${target} の onDelete:Cascade 子テーブルが全てレジストリに登録されている`, () => {
      const expected = cascadeChildrenFromSchema(target)
      const actual = movers.map((mover) => mover.model).sort()

      // 漏れ（schemaにあるがレジストリに無い）→ カスケード削除バグになる
      // 余分（レジストリにあるがschemaに無い）→ 不要な処理 or リネーム漏れ
      expect(actual).toEqual(expected)
    })
  }

  it("解析が機能していることの保証（Studentは複数のカスケード子を持つ）", () => {
    // 解析が壊れて空集合になっても上のテストが通ってしまう事故を防ぐ
    expect(cascadeChildrenFromSchema("Student").length).toBeGreaterThanOrEqual(
      5
    )
  })
})

/**
 * 試験の採点層が「その試験の受験者」の子であることの固定（#962）。
 *
 * かつて採点層は Student 直結で、ExamStudent を参照する子テーブルが1つも無かった。
 * そのため「試験から生徒を外す」操作では DB の cascade が働かず、削除経路が手書きで
 * 消し忘れた行が孤児として残り、試験側の画面・出力には現れないのに成績算出でだけ
 * 算入されていた。新しい採点系テーブルを Student 直結で足すとこの穴が再発するため、
 * 親が ExamStudent であることを schema 駆動で固定する。
 */
describe("採点層の親は ExamStudent（#962 の再発防止）", () => {
  const SCORING_TABLES = [
    "CompoundAnswerScore",
    "QuestionScore",
    "ReturnSnapshot",
    "ScoreDecision",
    "StudentAnswerImage",
  ]

  it("採点系5テーブルは ExamStudent の onDelete:Cascade 子である", () => {
    expect(cascadeChildrenFromSchema("ExamStudent")).toEqual(SCORING_TABLES)
  })

  it("採点系5テーブルは Student 直結ではない", () => {
    const studentChildren = cascadeChildrenFromSchema("Student")
    for (const table of SCORING_TABLES) {
      expect(studentChildren).not.toContain(table)
    }
  })
})

/**
 * 試験外成績資料の点数が「その資料の対象者」の子であることの固定（#962 Phase B）。
 *
 * 採点層（ExamStudent）と同じ穴が Coursework にもあった。名簿から生徒を外しても
 * 点数は消えず、資料の画面には現れないのに成績算出でだけ算入されていた。
 */
describe("資料の点数の親は CourseworkStudent（#962 の再発防止）", () => {
  it("CourseworkScore は CourseworkStudent の onDelete:Cascade 子である", () => {
    expect(cascadeChildrenFromSchema("CourseworkStudent")).toEqual([
      "CourseworkScore",
    ])
  })

  it("CourseworkScore は Student 直結ではない", () => {
    expect(cascadeChildrenFromSchema("Student")).not.toContain(
      "CourseworkScore"
    )
  })
})
