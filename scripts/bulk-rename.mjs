#!/usr/bin/env node
// Project → Exam, GradeProject → Grade 一括リネームスクリプト
// 使用: node scripts/bulk-rename.mjs [--dry-run]

import fs from "fs"
import path from "path"
import { execSync } from "child_process"

const ROOT = process.cwd()
const DRY_RUN = process.argv.includes("--dry-run")

// ============================================================
// Configuration
// ============================================================
const EXCLUDE_GLOBS = [
  "node_modules/**",
  ".next/**",
  "main/**",
  "dist/**",
  ".git/**",
  "out/**",
  "prisma/migrations/**",
  "scripts/bulk-rename.mjs",
  "docs/plans/**",
  "public/js/**",
  "package-lock.json",
]

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".prisma",
  ".css",
  ".md",
  ".env",
  ".yaml",
  ".yml",
])

// ============================================================
// File collection
// ============================================================
function getFiles() {
  // Use git ls-files to get tracked files, plus untracked (excluding ignored)
  const result = execSync("git ls-files --cached --others --exclude-standard", {
    cwd: ROOT,
    encoding: "utf-8",
  })
  return result
    .trim()
    .split("\n")
    .filter((f) => {
      if (!f) return false
      // Exclude directories
      for (const glob of EXCLUDE_GLOBS) {
        const prefix = glob.replace("/**", "/").replace("**", "")
        if (f.startsWith(prefix)) return false
      }
      const ext = path.extname(f)
      return TEXT_EXTENSIONS.has(ext)
    })
}

// ============================================================
// Replacement rules - ORDER IS CRITICAL
// Longer/more-specific patterns MUST come before shorter ones
// ============================================================

// Simple string replacements (replaceAll)
const EXACT_RULES = [
  // =========================================================
  // Phase A: GradeProject compound names (longest first)
  // =========================================================
  // PascalCase compounds
  ["GradeProjectExportSettings", "GradeExportSettings"],
  ["GradeProjectWithDetails", "GradeWithDetails"],
  ["GradeProjectStudent", "GradeStudent"],
  ["GradeProjectClass", "GradeClass"],
  // camelCase compounds (plural before singular)
  ["gradeProjectExportSettings", "gradeExportSettings"],
  ["gradeProjectStudents", "gradeStudents"],
  ["gradeProjectStudent", "gradeStudent"],
  ["gradeProjectClasses", "gradeClasses"],
  ["gradeProjectClass", "gradeClass"],
  // IPC channel prefix (most specific first)
  ["grade-project:getProjectCropRegions", "grade:getExamCropRegions"],
  ["grade-project:getProjectSubtotalGroups", "grade:getExamSubtotalGroups"],
  ["grade-project:getExamProjectCandidates", "grade:getExamCandidates"],
  ["grade-project:addStudentsFromClass", "grade:addStudentsFromClass"],
  ["grade-project:batchUpdateAbsentPolicy", "grade:batchUpdateAbsentPolicy"],
  [
    "grade-project:batchUpdateGradeItemExclusions",
    "grade:batchUpdateGradeItemExclusions",
  ],
  ["grade-project:batchUpsertManualScores", "grade:batchUpsertManualScores"],
  ["grade-project:calculateGrades", "grade:calculateGrades"],
  ["grade-project:calculateSourceMaxScore", "grade:calculateSourceMaxScore"],
  ["grade-project:createDataSource", "grade:createDataSource"],
  ["grade-project:createGradeItem", "grade:createGradeItem"],
  ["grade-project:create", "grade:create"],
  ["grade-project:deleteBoundarySet", "grade:deleteBoundarySet"],
  ["grade-project:deleteDataSource", "grade:deleteDataSource"],
  ["grade-project:deleteGradeItem", "grade:deleteGradeItem"],
  ["grade-project:deleteGradeOverride", "grade:deleteGradeOverride"],
  ["grade-project:delete", "grade:delete"],
  ["grade-project:executeImport", "grade:executeImport"],
  ["grade-project:exportArchive", "grade:exportArchive"],
  ["grade-project:exportExcel", "grade:exportExcel"],
  ["grade-project:getAll", "grade:getAll"],
  ["grade-project:getAvailableClasses", "grade:getAvailableClasses"],
  ["grade-project:getBoundarySets", "grade:getBoundarySets"],
  ["grade-project:getById", "grade:getById"],
  ["grade-project:getClasses", "grade:getClasses"],
  ["grade-project:getExportSettings", "grade:getExportSettings"],
  ["grade-project:getGradeItemExclusions", "grade:getGradeItemExclusions"],
  ["grade-project:getGradeItems", "grade:getGradeItems"],
  ["grade-project:getManualScores", "grade:getManualScores"],
  ["grade-project:getStudents", "grade:getStudents"],
  ["grade-project:importArchive", "grade:importArchive"],
  ["grade-project:removeClass", "grade:removeClass"],
  ["grade-project:reorderDataSources", "grade:reorderDataSources"],
  ["grade-project:reorderGradeItems", "grade:reorderGradeItems"],
  ["grade-project:saveExportSettings", "grade:saveExportSettings"],
  ["grade-project:setGradeItemExclusion", "grade:setGradeItemExclusion"],
  ["grade-project:updateDataSource", "grade:updateDataSource"],
  ["grade-project:updateGradeItem", "grade:updateGradeItem"],
  ["grade-project:updateStudentOrders", "grade:updateStudentOrders"],
  ["grade-project:update", "grade:update"],
  ["grade-project:upsertBoundarySet", "grade:upsertBoundarySet"],
  ["grade-project:upsertGradeOverride", "grade:upsertGradeOverride"],
  // URL/route patterns
  ["/grade-projects/", "/grades/"],
  ["grade-projects", "grades"],
  ["[gradeProjectId]", "[gradeId]"],
  // Variable name patterns (specific before generic)
  ["gradeProjectId", "gradeId"],
  ["gradeProjectName", "gradeName"],
  // Standalone GradeProject (MUST come AFTER all compounds)
  ["GradeProject", "Grade"],
  ["gradeProject", "grade"],

  // =========================================================
  // Phase B: Project compound model/type names
  // =========================================================
  // PascalCase models/types (longest first)
  ["ProjectExportSettings", "ExamExportSettings"],
  ["ProjectMarkingFormat", "ExamMarkingFormat"],
  ["ProjectSubtotalGroup", "ExamSubtotalGroup"],
  ["ProjectWithDetails", "ExamWithDetails"],
  ["ProjectStudent", "ExamStudent"],
  ["ProjectClass", "ExamClass"],
  ["ProjectPage", "ExamPage"],
  ["UserProject", "UserExam"],
  // camelCase (plural before singular)
  ["projectExportSettings", "examExportSettings"],
  ["projectMarkingFormats", "examMarkingFormats"],
  ["projectMarkingFormat", "examMarkingFormat"],
  ["projectSubtotalGroups", "examSubtotalGroups"],
  ["projectSubtotalGroup", "examSubtotalGroup"],
  ["projectStudents", "examStudents"],
  ["projectStudent", "examStudent"],
  ["projectClasses", "examClasses"],
  ["projectClass", "examClass"],
  ["projectPages", "examPages"],
  ["projectPage", "examPage"],
  ["userProjects", "userExams"],
  ["userProject", "userExam"],

  // =========================================================
  // Phase C: examProject系 (GradeDataSource既存フィールド)
  // Prevent double-conversion (examProject → examExam)
  // =========================================================
  ["getExamProjectCandidates", "getExamCandidates"],
  ["examProjectCandidates", "examCandidates"],
  ["examProjectMatches", "examMatches"],
  ["examProjectMapping", "examMapping"],
  ["examProjectName", "examName"],
  ["examProjectId", "examId"],
  ["examProject", "exam"],

  // =========================================================
  // Phase D: Additional type/interface names
  // =========================================================
  ["SerializedProject", "SerializedExam"],
  ["ArchiveProjectData", "ArchiveExamData"],
  ["ExportProjectOptions", "ExportExamOptions"],
  ["BulkExportProjectsOptions", "BulkExportExamsOptions"],
  ["CreateProjectArgs", "CreateExamArgs"],
  ["ProjectUpdateInput", "ExamUpdateInput"],
  ["ProjectCreateInput", "ExamCreateInput"],

  // =========================================================
  // Phase E: IPC channel strings (project-related)
  // Most specific first, then generic
  // =========================================================
  // project-class: channels
  ["project-class:add", "exam-class:add"],
  ["project-class:remove", "exam-class:remove"],
  ["project-class:reorder", "exam-class:reorder"],
  ["project-class:update", "exam-class:update"],
  // user-project: channels
  ["user-project:invite", "user-exam:invite"],
  ["user-project:remove", "user-exam:remove"],
  // archive: channels with Project
  ["archive:bulkExportProjects", "archive:bulkExportExams"],
  ["archive:exportProject", "archive:exportExam"],
  // Hyphenated IPC channels (long before short)
  [
    "get-active-subtotal-groups-for-project",
    "get-active-subtotal-groups-for-exam",
  ],
  [
    "get-available-subtotal-groups-for-project",
    "get-available-subtotal-groups-for-exam",
  ],
  [
    "get-question-answer-regions-by-project-id",
    "get-question-answer-regions-by-exam-id",
  ],
  ["get-answer-sheets-by-project-id", "get-answer-sheets-by-exam-id"],
  ["get-crop-regions-by-project-id", "get-crop-regions-by-exam-id"],
  ["get-master-images-by-project-id", "get-master-images-by-exam-id"],
  ["get-project-pages-by-project-id", "get-exam-pages-by-exam-id"],
  ["get-question-scores-for-project", "get-question-scores-for-exam"],
  ["get-subtotal-groups-by-project-id", "get-subtotal-groups-by-exam-id"],
  ["update-student-project-status", "update-student-exam-status"],
  ["get-classes-not-in-project", "get-classes-not-in-exam"],
  ["get-students-not-in-project", "get-students-not-in-exam"],
  ["remove-subtotal-group-from-project", "remove-subtotal-group-from-exam"],
  ["add-subtotal-group-to-project", "add-subtotal-group-to-exam"],
  ["remove-students-from-project", "remove-students-from-exam"],
  ["get-students-for-project", "get-students-for-exam"],
  ["add-students-to-project", "add-students-to-exam"],
  ["get-project-progress", "get-exam-progress"],
  ["fetch-project-by-id", "fetch-exam-by-id"],
  ["delete-project", "delete-exam"],
  ["create-project", "create-exam"],
  ["update-project", "update-exam"],
  ["fetch-projects", "fetch-exams"],
  // drawing: channels with Project
  ["drawing:getByProject", "drawing:getByExam"],

  // =========================================================
  // Phase F: Function/hook names (specific compounds)
  // =========================================================
  ["getProjectDirectory", "getExamDirectory"],
  ["getProjectById", "getExamById"],
  ["createProject", "createExam"],
  ["updateProject", "updateExam"],
  ["deleteProject", "deleteExam"],
  ["fetchProjectById", "fetchExamById"],
  ["fetchProjects", "fetchExams"],
  ["useProjectDetail", "useExamDetail"],
  ["useProject", "useExam"],
  ["getProjectProgress", "getExamProgress"],
  ["getProjectPagesByProjectId", "getExamPagesByExamId"],
  ["getMasterImagesByProjectId", "getMasterImagesByExamId"],
  ["getCropRegionsByProjectId", "getCropRegionsByExamId"],
  ["getStudentsForProject", "getStudentsForExam"],
  ["getStudentsNotInProject", "getStudentsNotInExam"],
  ["addStudentsToProject", "addStudentsToExam"],
  ["removeStudentsFromProject", "removeStudentsFromExam"],
  ["getClassesNotInProject", "getClassesNotInExam"],
  ["getSubtotalGroupsByProjectId", "getSubtotalGroupsByExamId"],
  ["getActiveSubtotalGroupsForProject", "getActiveSubtotalGroupsForExam"],
  ["getAvailableSubtotalGroupsForProject", "getAvailableSubtotalGroupsForExam"],
  ["addSubtotalGroupToProject", "addSubtotalGroupToExam"],
  ["removeSubtotalGroupFromProject", "removeSubtotalGroupFromExam"],
  ["getAnswerSheetsByProjectId", "getAnswerSheetsByExamId"],
  ["getQuestionScoresForProject", "getQuestionScoresForExam"],
  ["getQuestionAnswerRegionsByProjectId", "getQuestionAnswerRegionsByExamId"],
  ["updateStudentProjectStatus", "updateStudentExamStatus"],
  ["getStudentAnswersByProjectId", "getStudentAnswersByExamId"],
  ["uploadStudentAnswers", "uploadStudentAnswers"], // no change (answer-sheet domain)
  // Export related
  ["exportProjectArchive", "exportExamArchive"],
  ["bulkExportProjects", "bulkExportExams"],
  // ProjectIntegration (answer-sheet-builder)
  ["ProjectIntegration", "ExamIntegration"],
  ["projectIntegration", "examIntegration"],
  ["projectConverter", "examConverter"],

  // =========================================================
  // Phase G: Variable/param names (specific)
  // =========================================================
  ["projectDirectory", "examDirectory"],
  ["projectProgress", "examProgress"],
  ["projectSettings", "examSettings"],
  ["projectData", "examData"],
  ["projectIds", "examIds"],
  ["projectId", "examId"],
  ["projectName", "examName"],
  ["projectList", "examList"],
  ["projectCount", "examCount"],

  // =========================================================
  // Phase H: Standalone model/entity names
  // Applied AFTER all compounds are handled
  // =========================================================
  // These catch Prisma generated types like ProjectWhereInput, etc.
  // and remaining standalone occurrences
]

// Phase H needs special handling because "Project" and "project"
// are common substrings. We do this after all compound rules.
// But we need to be careful not to replace "project" in "project_total"
// (which is a DB type string that must not change).
// Since replaceAll is case-sensitive and "project_total" contains
// lowercase "project" followed by "_", and our rules process
// from top to bottom, we handle this carefully.

const PHASE_H_RULES = [
  // PascalCase - catches Prisma generated types etc.
  ["Project", "Exam"],
  // camelCase
  ["project", "exam"],
]

// Phase I: Path/string replacements (applied after Phase H)
const PHASE_I_RULES = [
  ['"project.json"', '"exam.json"'],
  ["'project.json'", "'exam.json'"],
  ["`project.json`", "`exam.json`"],
]

// Phase J: Japanese text
const PHASE_J_RULES = [["プロジェクト", "試験"]]

// ============================================================
// Special: patterns that must NOT be changed
// ============================================================
const PROTECTED_PATTERNS = [
  "project_total", // GradeDataSource type string (DB value)
]

// ============================================================
// Processing logic
// ============================================================

function applyRules(content, filePath) {
  let result = content

  // Apply exact rules (Phases A-G)
  for (const [from, to] of EXACT_RULES) {
    if (from === to) continue
    result = result.replaceAll(from, to)
  }

  // Phase H: Standalone replacements
  // First, protect "project_total" by replacing with a placeholder
  const PLACEHOLDER_PROJECT_TOTAL = "___PROJECT_TOTAL_PLACEHOLDER___"
  result = result.replaceAll("project_total", PLACEHOLDER_PROJECT_TOTAL)

  // Also protect Playwright config's "projects:" key
  const isPlaywrightConfig = filePath.includes("playwright")
  let playwrightProjectsPlaceholder = null
  if (isPlaywrightConfig) {
    playwrightProjectsPlaceholder = "___PLAYWRIGHT_PROJECTS_PLACEHOLDER___"
    // Protect "projects:" and "projects :" patterns in Playwright config
    result = result.replace(/\bprojects\s*:/g, (match) => {
      return match.replace("projects", playwrightProjectsPlaceholder)
    })
  }

  for (const [from, to] of PHASE_H_RULES) {
    result = result.replaceAll(from, to)
  }

  // Restore protected patterns
  result = result.replaceAll(PLACEHOLDER_PROJECT_TOTAL, "project_total")
  if (playwrightProjectsPlaceholder) {
    result = result.replaceAll(playwrightProjectsPlaceholder, "projects")
  }

  // Phase I: Path/string replacements
  for (const [from, to] of PHASE_I_RULES) {
    result = result.replaceAll(from, to)
  }

  // Phase J: Japanese text
  for (const [from, to] of PHASE_J_RULES) {
    result = result.replaceAll(from, to)
  }

  return result
}

// ============================================================
// Main execution
// ============================================================

console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Starting bulk rename...`)
console.log(`Root: ${ROOT}\n`)

const files = getFiles()
console.log(`Found ${files.length} files to process\n`)

let changedCount = 0
let unchangedCount = 0
const changedFiles = []

for (const relPath of files) {
  const fullPath = path.join(ROOT, relPath)

  let content
  try {
    content = fs.readFileSync(fullPath, "utf-8")
  } catch (err) {
    console.warn(`  SKIP (read error): ${relPath}`)
    continue
  }

  const newContent = applyRules(content, relPath)

  if (newContent !== content) {
    changedCount++
    changedFiles.push(relPath)

    if (!DRY_RUN) {
      fs.writeFileSync(fullPath, newContent, "utf-8")
    }
    console.log(`  CHANGED: ${relPath}`)
  } else {
    unchangedCount++
  }
}

console.log(`\n${"=".repeat(60)}`)
console.log(`Results:`)
console.log(`  Changed: ${changedCount} files`)
console.log(`  Unchanged: ${unchangedCount} files`)
console.log(`  Total: ${files.length} files`)

if (DRY_RUN) {
  console.log(
    `\n[DRY RUN] No files were modified. Run without --dry-run to apply changes.`
  )
}

if (changedFiles.length > 0) {
  console.log(`\nChanged files:`)
  for (const f of changedFiles) {
    console.log(`  ${f}`)
  }
}
