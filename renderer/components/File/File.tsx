import React from "react"
import {
  MdDelete,
  MdEdit,
  MdRadioButtonChecked,
  MdRadioButtonUnchecked,
} from "react-icons/md"
import { VscFile } from "react-icons/vsc" // VscFile はアイコンとして残す場合
import { type Project } from "@prisma/client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table" // shadcn/ui の Table コンポーネントをインポート (パスは適宜調整してください)
import { useProjects } from "../../../components/hooks/useProjects"
import { useFileActions } from "../../../components/hooks/useFileActions"
import CreateProjectWindow from "./CreateProjectWindow"
import DeleteProjectWindow from "./DeleteProjectWindow"
import EditProjectWindow from "./EditProjectWindow"

const File = () => {
  const {
    projects,
    selectedProjectId,
    editProject,
    clickExam,
    handleDeleteProject,
  } = useProjects()

  const {
    isShowCreateProjectWindow,
    openCreateProjectWindow,
    closeCreateProjectWindow,
    isShowEditProjectWindow,
    projectIdToEdit,
    openEditProjectWindow,
    closeEditProjectWindow,
    isShowDeleteProjectWindow,
    projectToDelete,
    openDeleteProjectWindow,
    closeDeleteProjectWindow,
  } = useFileActions()

  return (
    <>
      {isShowCreateProjectWindow && (
        <CreateProjectWindow onClose={closeCreateProjectWindow} />
      )}
      {isShowEditProjectWindow && projectIdToEdit && (
        <EditProjectWindow
          projectIdToEdit={projectIdToEdit}
          setIsShowEditProjectWindow={closeEditProjectWindow}
          onSave={async (updatedProjectData) => {
            await editProject({
              ...updatedProjectData,
              projectId: projectIdToEdit,
            })
            closeEditProjectWindow()
          }}
        />
      )}
      {isShowDeleteProjectWindow && projectToDelete && (
        <DeleteProjectWindow
          projectToDelete={projectToDelete}
          onClose={closeDeleteProjectWindow}
          onDelete={async () => {
            await handleDeleteProject(projectToDelete as Project)
            closeDeleteProjectWindow()
          }}
        />
      )}
      <div className="flex min-w-full flex-col">
        <div className="flex px-4 py-2">
          <div
            className="mx-4 inline-block w-36 cursor-pointer rounded-lg bg-slate-200 px-8 py-2 text-center shadow-md"
            onClick={openCreateProjectWindow}
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
                <VscFile size={"1em"} />
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
                  onClick={() => clickExam(project.projectId)}
                >
                  {project.projectId === selectedProjectId ? (
                    <MdRadioButtonChecked size={"1.5em"} />
                  ) : (
                    <MdRadioButtonUnchecked size={"1.5em"} />
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
                    <MdEdit
                      size={"1.5em"}
                      className="cursor-pointer text-blue-500 hover:text-blue-700"
                      onClick={() => openEditProjectWindow(project.projectId)}
                    />
                    <MdDelete
                      size={"1.5em"}
                      className="cursor-pointer text-red-500 hover:text-red-700"
                      onClick={() => openDeleteProjectWindow(project)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

export default File
