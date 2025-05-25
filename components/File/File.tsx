import React from "react"
import { Circle, CircleDot, Edit3, FileText, Trash2 } from "lucide-react"
import { Prisma } from "@prisma/client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useProjects } from "../hooks/useProjects"
import { useFileActions } from "../hooks/useFileActions"
import CreateProjectWindow from "./CreateProjectWindow"
import DeleteProjectWindow from "./DeleteProjectWindow"
import EditProjectWindow from "./EditProjectWindow"
import { Badge } from "@/components/ui/badge" // Badge をインポート

const File = () => {
  const {
    projects,
    selectedProject,
    setSelectedProject,
    createProject,
    updateProject,
    deleteProject,
  } = useProjects()

  const { createProjectModal, editProjectModal, deleteProjectModal } =
    useFileActions()

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
            await updateProject(updatedProjectPayload)
            editProjectModal.close()
          }}
        />
      )}
      {deleteProjectModal.isOpen && deleteProjectModal.project && (
        <DeleteProjectWindow
          projectToDelete={
            deleteProjectModal.project as Prisma.ProjectGetPayload<{
              include: { tags: true }
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
        <div className="flex px-4 py-2">
          <div
            className="mx-4 inline-block w-36 cursor-pointer rounded-lg bg-slate-200 px-8 py-2 text-center shadow-md"
            onClick={createProjectModal.open}
          >
            試験一覧
          </div>
          <div className="mx-4 inline-block w-36 cursor-pointer rounded-lg px-8 py-2 text-center shadow-md">
            生徒名簿
          </div>
          <div className="mx-4 inline-block w-36 cursor-pointer rounded-lg px-8 py-2 text-center shadow-md">
            設定
          </div>
        </div>

        {/* shadcn/ui Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20 text-center">
                <FileText size={16} />{" "}
                {/* VscFile を FileText に置き換え、サイズ調整 */}
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
                            // 型アサーションを追加
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

        {selectedProject && (
          <div className="mt-4 rounded-md border p-4">
            <h3 className="mb-2 text-lg font-semibold">
              選択中のプロジェクト詳細: {selectedProject.examName}
            </h3>
            {selectedProject.description && (
              <p className="mb-2 text-sm text-gray-600">
                説明: {selectedProject.description}
              </p>
            )}
            <div className="mb-2">
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
            {/* ここに他の詳細情報や操作ボタンを追加可能 */}
          </div>
        )}
      </div>
    </>
  )
}

export default File
