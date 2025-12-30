"use client"

import { useState } from "react"
import {
  Calculator,
  Download,
  Edit,
  Eye,
  FileImage,
  FolderInput,
  PlayCircle,
  PlusCircle,
  Settings,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ProjectWithDetails, isValidProject } from "@/types/common.types"
import { getProjectStatus } from "@/utils/projectStatus"

const File = () => {
  const { projects, loadProjects } = useProjects()
  const [showImportModal, setShowImportModal] = useState(false)

  const { createProjectModal } = useFileActions()
  const router = useRouter()

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
      <div className="flex min-w-full flex-col">
        <div className="flex items-center space-x-2 border-b px-4 py-2">
          <Button onClick={createProjectModal.open} variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" />
            新規試験作成
          </Button>
          <Button onClick={() => setShowImportModal(true)} variant="outline">
            <FolderInput className="mr-2 h-4 w-4" />
            インポート
          </Button>
        </div>

        <div className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>プロジェクト名</TableHead>
                <TableHead className="w-32 text-center">詳細</TableHead>
                <TableHead className="w-40 text-center">次のステップ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                // 型ガードを使用して安全にproject処理
                if (!isValidProject(project)) {
                  console.warn("Skipping invalid project:", project)
                  return null
                }

                const status = getProjectStatus(project)

                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{project.examName}</div>
                        <div className="text-muted-foreground text-sm">
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
                        className="w-48 justify-start text-left"
                      >
                        {status.step === 1 && (
                          <FileImage className="mr-1 h-4 w-4" />
                        )}
                        {status.step === 2 && (
                          <Settings className="mr-1 h-4 w-4" />
                        )}
                        {status.step === 3 && <Edit className="mr-1 h-4 w-4" />}
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
    </>
  )
}

export default File
