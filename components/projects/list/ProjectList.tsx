"use client"

import { useMemo } from "react"
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Calculator,
  CalendarArrowDown,
  CalendarArrowUp,
  Check,
  Download,
  Edit,
  Eye,
  FileImage,
  FolderInput,
  PlayCircle,
  PlusCircle,
  Settings,
  SortDesc,
  Upload,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { useFileActions } from "@/components/hooks/useFileActions"
import { useProjects } from "@/components/hooks/useProjects"
import CreateProjectWindow from "@/components/projects/forms/CreateProjectWindow"
import { ImportWizardModal } from "@/components/import/ImportWizardModal"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTableSort, SortDirection } from "@/hooks/useTableSort"
import { ProjectWithDetails, isValidProject } from "@/types/common.types"
import { getProjectStatus } from "@/utils/projectStatus"
import { useState } from "react"

interface ProjectSortable {
  id: string
  examName: string
  examDate: string | null
  original: ProjectWithDetails
}

const SORT_OPTIONS = [
  {
    key: "examDate",
    direction: "desc",
    label: "実施日（新しい順）",
    icon: CalendarArrowDown,
  },
  {
    key: "examDate",
    direction: "asc",
    label: "実施日（古い順）",
    icon: CalendarArrowUp,
  },
  {
    key: "examName",
    direction: "asc",
    label: "プロジェクト名（A→Z）",
    icon: ArrowDownAZ,
  },
  {
    key: "examName",
    direction: "desc",
    label: "プロジェクト名（Z→A）",
    icon: ArrowUpAZ,
  },
] as const

const File = () => {
  const { projects, loadProjects } = useProjects()
  const [showImportModal, setShowImportModal] = useState(false)

  const { createProjectModal } = useFileActions()
  const router = useRouter()

  // ソート用データに変換
  const sortableData = useMemo<ProjectSortable[]>(() => {
    return projects.filter(isValidProject).map((project) => ({
      id: project.id,
      examName: project.examName,
      examDate: project.examDate
        ? new Date(project.examDate).toISOString()
        : null,
      original: project,
    }))
  }, [projects])

  // ソート機能（localStorage永続化、既定: 実施日降順）
  const { sortedData, sortConfig, setSort } = useTableSort(sortableData, {
    defaultSort: { key: "examDate", direction: "desc" },
    storageKey: "projectList-sort",
  })

  // 現在のソート設定に一致するオプションを取得
  const currentSortLabel = useMemo(() => {
    const option = SORT_OPTIONS.find(
      (opt) =>
        opt.key === sortConfig.key && opt.direction === sortConfig.direction
    )
    return option?.label || "並び替え"
  }, [sortConfig])

  const handleSortSelect = (
    key: keyof ProjectSortable,
    direction: SortDirection
  ) => {
    if (direction) {
      setSort(key, direction)
    }
  }

  const handleStartScoring = (project: ProjectWithDetails) => {
    router.push(`/projects/${project.id}`)
  }

  const handleNextStep = (project: ProjectWithDetails) => {
    const status = getProjectStatus(project)
    router.push(status.url)
  }

  const handleImportComplete = (projectId: string) => {
    loadProjects()
    router.push(`/projects/${projectId}`)
  }

  return (
    <>
      {createProjectModal.isOpen && (
        <CreateProjectWindow
          onClose={createProjectModal.close}
          onProjectCreated={loadProjects}
        />
      )}
      <ImportWizardModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onComplete={handleImportComplete}
      />
      <div className="flex h-full min-w-full flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center space-x-2">
            <Button
              onClick={createProjectModal.open}
              variant="outline"
              className="rounded-lg"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              新規試験作成
            </Button>
            <Button
              onClick={() => setShowImportModal(true)}
              variant="outline"
              className="rounded-lg"
            >
              <FolderInput className="mr-2 h-4 w-4" />
              インポート
            </Button>
          </div>

          {/* ソート選択 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-lg">
                <SortDesc className="h-4 w-4" />
                {currentSortLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>並び替え</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SORT_OPTIONS.map((option) => {
                const Icon = option.icon
                const isSelected =
                  sortConfig.key === option.key &&
                  sortConfig.direction === option.direction
                return (
                  <DropdownMenuItem
                    key={`${option.key}-${option.direction}`}
                    onClick={() =>
                      handleSortSelect(option.key, option.direction)
                    }
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                    {isSelected && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* テーブルエリア */}
        <div className="min-h-0 flex-1 p-4">
          <div className="border-border/50 h-full overflow-hidden rounded-xl border shadow-sm">
            <Table wrapperClassName="h-full">
              <TableHeader className="bg-card sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead>プロジェクト名</TableHead>
                  <TableHead className="w-32 text-center">詳細</TableHead>
                  <TableHead className="w-40 text-center">
                    次のステップ
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map(({ original: project }) => {
                  const status = getProjectStatus(project)

                  return (
                    <TableRow key={project.id} className="group">
                      <TableCell>
                        <div>
                          <div className="font-medium">{project.examName}</div>
                          <div className="text-muted-foreground text-sm tabular-nums">
                            {project.examDate
                              ? typeof project.examDate === "string"
                                ? new Date(project.examDate).toLocaleDateString(
                                    "ja-JP"
                                  )
                                : new Date(project.examDate).toLocaleDateString(
                                    "ja-JP"
                                  )
                              : "実施日未設定"}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => handleStartScoring(project)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          詳細
                        </Button>
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          onClick={() => handleNextStep(project)}
                          className="w-48 justify-start rounded-lg text-left"
                        >
                          {status.step === 1 && (
                            <FileImage className="mr-1 h-4 w-4" />
                          )}
                          {status.step === 2 && (
                            <Settings className="mr-1 h-4 w-4" />
                          )}
                          {status.step === 3 && (
                            <Edit className="mr-1 h-4 w-4" />
                          )}
                          {status.step === 4 && (
                            <Calculator className="mr-1 h-4 w-4" />
                          )}
                          {status.step === 5 && (
                            <Users className="mr-1 h-4 w-4" />
                          )}
                          {status.step === 6 && (
                            <Upload className="mr-1 h-4 w-4" />
                          )}
                          {status.step === 7 && (
                            <PlayCircle className="mr-1 h-4 w-4" />
                          )}
                          {status.step === 8 && (
                            <Download className="mr-1 h-4 w-4" />
                          )}
                          <span className="text-xs">{status.text}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  )
}

export default File
