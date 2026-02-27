/**
 * 解答用紙定義のJSONファイル保存・読込・削除
 *
 * 保存先: data/answer-sheet-definitions/{id}.json
 */

import fs from "fs"
import path from "path"

import type {
  AnswerSheetDefinition,
  ASBDefinitionListItem,
} from "../../../types/answerSheetBuilder.types"
import { getDataDirectory } from "../dataManager"

function getDefinitionsDir(): string {
  return path.join(getDataDirectory(), "answer-sheet-definitions")
}

function ensureDir(): void {
  const dir = getDefinitionsDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function getFilePath(id: string): string {
  return path.join(getDefinitionsDir(), `${id}.json`)
}

export function saveDefinition(definition: AnswerSheetDefinition): void {
  ensureDir()
  const now = new Date().toISOString()
  const data: AnswerSheetDefinition = {
    ...definition,
    updatedAt: now,
    createdAt: definition.createdAt ?? now,
  }
  fs.writeFileSync(getFilePath(data.id), JSON.stringify(data, null, 2), "utf-8")
}

export function loadDefinition(id: string): AnswerSheetDefinition | null {
  const filePath = getFilePath(id)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, "utf-8")
  return JSON.parse(raw) as AnswerSheetDefinition
}

export function deleteDefinition(id: string): boolean {
  const filePath = getFilePath(id)
  if (!fs.existsSync(filePath)) return false
  fs.unlinkSync(filePath)
  return true
}

export function listDefinitions(): ASBDefinitionListItem[] {
  ensureDir()
  const dir = getDefinitionsDir()
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"))

  const items: ASBDefinitionListItem[] = []
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8")
      const data = JSON.parse(raw) as AnswerSheetDefinition
      items.push({
        id: data.id,
        name: data.name,
        updatedAt: data.updatedAt,
      })
    } catch {
      // skip invalid files
    }
  }
  return items.sort((a, b) => {
    if (!a.updatedAt || !b.updatedAt) return 0
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}
