/**
 * 用語集（`src/app/(app)/glossary`）が指す表・列・値・識別子が実在することを守る。
 *
 * 用語集は画面の語と実体の対応を書いたものなので、**表や列を改名したのに用語集が古い名前の
 * まま**だと、対応を引くための場所が嘘を教える。改名した時点でここが落ちる。
 * 採点方式・採点状態・データソースの種類・試験の権限・在籍の時期の呼び名は、画面の定義と
 * 食い違わないことも見る（画面の定義が1つの定数にまとまっているものに限る）。
 */

import * as fs from "fs"
import * as path from "path"
import { describe, expect, it } from "vitest"

import { GLOSSARY_TERMS } from "@/app/(app)/glossary/glossaryTerms"
import { GLOSSARY_TEXT_JA } from "@/app/(app)/glossary/text/ja/glossaryTextJa"
import { SCORING_METHOD_LABELS } from "@/components/exams/07-score-at-once/Rubric/utils/rubricEffectLabel"
import { CROP_REGION_AREA_TYPE_LABELS } from "@/lib/cropRegionAreaTypeLabels"
import {
  MEMBERSHIP_PHASE_LABELS,
  MEMBERSHIP_PHASES,
} from "@/lib/membership"
import { EXAM_ROLE_LABELS } from "@/lib/shared/examRoles"
import { GRADE_DATA_SOURCE_TYPE_LABEL } from "@/lib/shared/gradeReferenceMessages"
import { SCORING_STATUS_LABELS } from "@/lib/shared/scoringStatusLabels"

const REPO_ROOT = path.resolve(__dirname, "../..")
const SCHEMA_PATH = path.join(REPO_ROOT, "prisma/schema.prisma")

/** モデル名 → 列名の集合（`prisma/schema.prisma` から読む） */
function schemaModelFields(): Map<string, Set<string>> {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8")
  const modelFields = new Map<string, Set<string>>()
  for (const [, modelName, body] of schema.matchAll(
    /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g
  )) {
    const fields = new Set<string>()
    for (const line of body.split("\n")) {
      const field = /^\s*(\w+)\s+\w/.exec(line)
      if (field) fields.add(field[1])
    }
    modelFields.set(modelName, fields)
  }
  return modelFields
}

const readSource = (source: string): string | null => {
  const sourcePath = path.join(REPO_ROOT, source)
  return fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, "utf8") : null
}

/** 用語集の語の呼び名（見出しに付けた「（採点状態）」などの添え書きを除く） */
const termLabel = (termId: keyof typeof GLOSSARY_TEXT_JA.terms): string =>
  GLOSSARY_TEXT_JA.terms[termId].label.replace(/（[^）]*）$/, "")

describe("用語集が指す実体", () => {
  const modelFields = schemaModelFields()
  const codeRefs = GLOSSARY_TERMS.flatMap((glossaryTerm) =>
    glossaryTerm.codeRefs.map((codeRef) => ({
      termId: glossaryTerm.id,
      codeRef,
    }))
  )

  it("表・列はスキーマにある", () => {
    const missing = codeRefs.flatMap(({ termId, codeRef }) => {
      if (codeRef.kind === "identifier") return []
      const fields = modelFields.get(codeRef.model)
      if (fields === undefined) return [`${termId}: 表 ${codeRef.model}`]
      if (codeRef.kind !== "table" && !fields.has(codeRef.field)) {
        return [`${termId}: 列 ${codeRef.model}.${codeRef.field}`]
      }
      return []
    })
    expect(missing).toEqual([])
  })

  it("値は、値の集合を定義しているファイルに書かれている", () => {
    const missing = codeRefs.flatMap(({ termId, codeRef }) => {
      if (codeRef.kind !== "value") return []
      const source = readSource(codeRef.source)
      if (source === null) return [`${termId}: ${codeRef.source} が無い`]
      return source.includes(`"${codeRef.value}"`)
        ? []
        : [`${termId}: "${codeRef.value}" が ${codeRef.source} に無い`]
    })
    expect(missing).toEqual([])
  })

  it("識別子は書いてあるファイルから export されている", () => {
    const missing = codeRefs.flatMap(({ termId, codeRef }) => {
      if (codeRef.kind !== "identifier") return []
      const source = readSource(codeRef.source)
      if (source === null) return [`${termId}: ${codeRef.source} が無い`]
      const exported = new RegExp(
        `export\\s+(?:declare\\s+)?(?:type|interface|const|function|class|enum)\\s+${codeRef.name}\\b|export\\s+const\\s+\\{[^}]*\\b${codeRef.name}\\b`
      ).test(source)
      return exported ? [] : [`${termId}: ${codeRef.name} in ${codeRef.source}`]
    })
    expect(missing).toEqual([])
  })

  it("採点方式の呼び名は画面の選択肢と同じ", () => {
    expect({
      points: termLabel("scoringMethodPoints"),
      deduction: termLabel("scoringMethodDeduction"),
      addition: termLabel("scoringMethodAddition"),
      scale: termLabel("scoringMethodScale"),
    }).toEqual(SCORING_METHOD_LABELS)
  })

  it("採点状態の呼び名は画面の表記と同じ", () => {
    expect({
      unscored: termLabel("statusUnscored"),
      correct: termLabel("statusCorrect"),
      partial: termLabel("statusPartial"),
      pending: termLabel("statusPending"),
      incorrect: termLabel("statusIncorrect"),
      no_answer: termLabel("statusNoAnswer"),
      double_mark: termLabel("statusDoubleMark"),
      evaluated: termLabel("statusEvaluated"),
    }).toEqual(SCORING_STATUS_LABELS)
  })

  it("データソースの種類の呼び名は画面の表記と同じ", () => {
    expect({
      exam_total: termLabel("dataSourceExamTotal"),
      subtotal: termLabel("dataSourceSubtotal"),
      crop_region: termLabel("dataSourceCropRegion"),
      coursework: termLabel("dataSourceCoursework"),
      coursework_total: termLabel("dataSourceCourseworkTotal"),
      // 旧形式の manual は取り込んだ古い成績算出にだけ残る種類で、用語集には載せていない
      manual: GRADE_DATA_SOURCE_TYPE_LABEL.manual,
    }).toEqual(GRADE_DATA_SOURCE_TYPE_LABEL)
  })

  it("試験の権限の呼び名は画面の表記と同じ", () => {
    expect({
      OWNER: termLabel("roleOwner"),
      EDITOR: termLabel("roleEditor"),
      VIEWER: termLabel("roleViewer"),
    }).toEqual(EXAM_ROLE_LABELS)
  })

  it("採点領域の種類の呼び名は画面の表記と同じ", () => {
    expect({
      QUESTION_ANSWER: termLabel("question"),
      STUDENT_NAME: termLabel("studentNameArea"),
      STUDENT_ID: termLabel("studentIdArea"),
      TOTAL_SCORE: termLabel("totalScoreArea"),
      SUBTOTAL_SCORE: termLabel("subtotalArea"),
    }).toEqual({
      QUESTION_ANSWER: CROP_REGION_AREA_TYPE_LABELS.QUESTION_ANSWER,
      STUDENT_NAME: CROP_REGION_AREA_TYPE_LABELS.STUDENT_NAME,
      STUDENT_ID: CROP_REGION_AREA_TYPE_LABELS.STUDENT_ID,
      TOTAL_SCORE: CROP_REGION_AREA_TYPE_LABELS.TOTAL_SCORE,
      SUBTOTAL_SCORE: CROP_REGION_AREA_TYPE_LABELS.SUBTOTAL_SCORE,
    })
  })

  it("在籍の時期の呼び名は画面の表記を並べたもの", () => {
    expect(termLabel("membershipPhase")).toBe(
      MEMBERSHIP_PHASES.map((phase) => MEMBERSHIP_PHASE_LABELS[phase]).join(
        "・"
      )
    )
  })

  it("呼び名は重ならない（同じ語が別のものを指さない）", () => {
    const labels = GLOSSARY_TERMS.map(
      (glossaryTerm) => GLOSSARY_TEXT_JA.terms[glossaryTerm.id].label
    )
    const duplicated = labels.filter(
      (label, labelIndex) => labels.indexOf(label) !== labelIndex
    )
    expect(duplicated).toEqual([])
  })
})
