"use client"

import React from "react"
import {
  PlusCircle,
  PlayCircle,
  FileImage,
  Settings,
  Upload,
  Eye,
} from "lucide-react"
import { Prisma } from "@prisma/client"
import { useRouter } from "next/navigation" // useRouter をインポート

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useProjects } from "../hooks/useProjects"
import { useFileActions } from "../hooks/useFileActions"
import CreateProjectWindow from "./CreateProjectWindow"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const File = () => {
  const {
    projects,
    loadProjects,
  } = useProjects()

  const { createProjectModal } = useFileActions()
  const router = useRouter()

  const handleStartScoring = (project: any) => {
    // プロジェクト詳細ページに遷移
    router.push(`/projects/${project.id}`)
  }

  const getProjectStatus = (project: any) => {
    const hasImages = project.masterImages && project.masterImages.length > 0
    const hasLayout = project.layout && project.layout.areas && project.layout.areas.length > 0
    const hasAnswers = project.answerSheets && project.answerSheets.length > 0
    
    if (!hasImages) return { step: 1, action: 'upload-master', text: '模範解答をアップロード', url: `/projects/${project.id}/master-images` }
    if (!hasLayout) return { step: 2, action: 'setup-regions', text: '採点領域を設定', url: `/projects/${project.id}/score/template` }
    if (!hasAnswers) return { step: 3, action: 'upload-answers', text: '答案をアップロード', url: `/projects/${project.id}/answer-sheets` }
    return { step: 4, action: 'start-grading', text: '採点を開始', url: `/projects/${project.id}/score` }
  }

  const handleNextStep = (project: any) => {
    const status = getProjectStatus(project)
    router.push(status.url)
  }

  return (
    <>
      {createProjectModal.isOpen && (
        <CreateProjectWindow 
          onClose={createProjectModal.close} 
          onProjectCreated={loadProjects}
        />
      )}
      <div className="flex min-w-full flex-col">
        <div className="flex items-center space-x-2 border-b px-4 py-2">
          <Button onClick={createProjectModal.open} variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" />
            新規試験作成
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
                const status = getProjectStatus(project)
                
                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{project.examName}</div>
                        <div className="text-sm text-muted-foreground">
                          {project.examDate
                            ? new Date(project.examDate).toLocaleDateString('ja-JP')
                            : "実施日未設定"}
                          {project.tags && project.tags.length > 0 && (
                            <span className="ml-2">
                              {project.tags.map(tag => tag.text).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartScoring(project)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        詳細
                      </Button>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        onClick={() => handleNextStep(project)}
                        className={status.step === 4 ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        {status.step === 1 && <FileImage className="h-4 w-4 mr-1" />}
                        {status.step === 2 && <Settings className="h-4 w-4 mr-1" />}
                        {status.step === 3 && <Upload className="h-4 w-4 mr-1" />}
                        {status.step === 4 && <PlayCircle className="h-4 w-4 mr-1" />}
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
