"use client"

import React from "react"
import {
  Circle,
  CircleDot,
  Edit3,
  FileText,
  Trash2,
  PlusCircle,
  PlayCircle, // PlayCircle アイコンを追加
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
import { useProjects } from "../hooks/useProjects" // useProjects が ProjectWithDetails を使う場合、その型変更の影響を受ける
import { useFileActions } from "../hooks/useFileActions"
import CreateProjectWindow from "./CreateProjectWindow"
import DeleteProjectWindow from "./DeleteProjectWindow"
import EditProjectWindow from "./EditProjectWindow"
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
    selectedProject, // この型が ProjectWithDetails の場合、変更の影響を受ける
    setSelectedProject,
    // createProject,
    updateProject,
    deleteProject,
  } = useProjects()

  const { createProjectModal, editProjectModal, deleteProjectModal } =
    useFileActions()
  const router = useRouter()

  const handleStartScoring = () => {
    if (selectedProject) {
      // selectedProject.layout が存在するかどうかで、採点枠設定済みか判断できる
      if (selectedProject.layout) {
        router.push(`/projects/${selectedProject.projectId}/score/upload`) // 採点枠設定済みなら解答用紙アップロードへ
      } else {
        router.push(`/projects/${selectedProject.projectId}/score`) // 未設定なら模範解答設定から
      }
    }
  }

  return (
    <>
      {createProjectModal.isOpen && (
        <CreateProjectWindow onClose={createProjectModal.close} />
      )}
      {editProjectModal.isOpen && selectedProject && (
        <EditProjectWindow
          projectToEdit={selectedProject}
          setIsShowEditProjectWindow={editProjectModal.close}
          onSave={async (updatedProjectPayload) => {
            // Ensure updatedProjectPayload matches the type expected by updateProject
            // The useProjects hook's updateProject expects Prisma.ProjectGetPayload<{ include: { tags: true } }>
            // but your EditProjectWindow onSave provides a similar type.
            // This might need alignment if types diverge significantly.
            // For now, assuming they are compatible enough or onSave prepares the correct type.
            await updateProject(updatedProjectPayload as any) // Cast if necessary, better to align types
            editProjectModal.close()
          }}
        />
      )}
      {deleteProjectModal.isOpen && deleteProjectModal.project && (
        <DeleteProjectWindow
          projectToDelete={
            deleteProjectModal.project as Prisma.ProjectGetPayload<{
              include: { tags: true; layout?: { include: { areas: true } } }
            }>
          }
          onClose={deleteProjectModal.close}
          onDelete={async () => {
            selectedProject && (await deleteProject(selectedProject))
            deleteProjectModal.close()
          }}
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
                <TableHead className="w-20 text-center">
                  <FileText size={16} />
                </TableHead>
                <TableHead>名前</TableHead>
                <TableHead className="w-80">日時</TableHead>
                <TableHead className="w-32 text-center">アクション</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.projectId}>
                  <TableCell
                    className="cursor-pointer text-center"
                    onClick={() => setSelectedProject(project)} // 変更: clickExam を直接 setSelectedProjectId に
                  >
                    {project === selectedProject ? (
                      <CircleDot
                        size={24}
                      /> /* MdRadioButtonChecked を CircleDot に置き換え */
                    ) : (
                      <Circle
                        size={24}
                      /> /* MdRadioButtonUnchecked を Circle に置き換え */
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {project.examName}
                  </TableCell>
                  <TableCell>
                    {project.examDate
                      ? new Date(project.examDate).toLocaleDateString()
                      : "N/A"}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center space-x-2">
                      <Edit3 // MdEdit を Edit3 に置き換え
                        size={24}
                        className="cursor-pointer text-blue-500 hover:text-blue-700"
                        onClick={() => editProjectModal.open(project.projectId)}
                      />
                      <Trash2 // MdDelete を Trash2 に置き換え
                        size={24}
                        className="cursor-pointer text-red-500 hover:text-red-700"
                        onClick={() =>
                          deleteProjectModal.open(
                            project as Prisma.ProjectGetPayload<{
                              include: { tags: true }
                            }>,
                          )
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {selectedProject && (
          <div className="p-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  選択中のプロジェクト詳細: {selectedProject.examName}
                </CardTitle>
                {selectedProject.description && (
                  <CardDescription>
                    {selectedProject.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  {" "}
                  {/* mb-2 から mb-4 に変更 */}
                  <span className="font-medium">科目 (タグ): </span>
                  {selectedProject.tags && selectedProject.tags.length > 0 ? (
                    selectedProject.tags.map((tag) => (
                      <Badge key={tag.id} variant="secondary" className="mr-1">
                        {tag.text}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">なし</span>
                  )}
                </div>
                <div className="mb-4">
                  <span className="font-medium">採点枠設定: </span>
                  {selectedProject.layout ? (
                    <Badge variant="success">設定済み</Badge>
                  ) : (
                    <Badge variant="outline">未設定</Badge>
                  )}
                </div>
                {/* ここに他の詳細情報や操作ボタンを追加可能 */}
                <Button onClick={handleStartScoring}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  このプロジェクトの採点を開始する{" "}
                  {/* Changed "試験" to "プロジェクト" */}
                </Button>
              </CardContent>
              {/* 必要であれば CardFooter も追加 */}
            </Card>
          </div>
        )}
      </div>
    </>
  )
}

export default File
