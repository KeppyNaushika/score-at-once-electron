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
  CLASS_CASCADE_MOVERS,
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
  let m: RegExpExecArray | null
  while ((m = modelRe.exec(src)) !== null) {
    const modelName = m[1]
    const body = m[2]
    for (const line of body.split("\n")) {
      // 例: "  student   Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)"
      const rel = line.match(/^\s*\w+\s+(\w+)\??\s+@relation\(([^)]*)\)/)
      if (!rel) continue
      const relType = rel[1]
      const args = rel[2]
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
    { target: "Classroom", movers: CLASS_CASCADE_MOVERS },
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
