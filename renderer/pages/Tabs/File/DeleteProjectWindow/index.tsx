import React, { useContext } from "react"

import { ProjectContext } from "../../../../components/Context/ProjectContext"

const DeleteProjectWindow = (props: {
  setIsShowDeleteProjectWindow: React.Dispatch<React.SetStateAction<boolean>>
  loadProjects: () => Promise<void>
}) => {
  const { projects, selectedProjectId } = useContext(ProjectContext)
  const { setIsShowDeleteProjectWindow, loadProjects } = props

  const projectToDelete = projects.find(
    (project) => project.projectId === selectedProjectId,
  )

  return (
    <div className="absolute inset-0 z-20 flex min-h-full min-w-full animate-float-in flex-col items-center justify-center border-2 bg-white/80">
      <div className="text-2xl">本当に削除しますか？</div>
      {projectToDelete && (
        <div className="py-4 text-center">
          <p>以下のプロジェクトが削除されます:</p>
          <p className="font-bold">{projectToDelete.examName}</p>
          <p className="text-sm text-gray-600">
            ({projectToDelete.examDate.toLocaleDateString()})
          </p>
        </div>
      )}
      <div className="flex py-10">
        <div
          className="flex h-16 w-40 cursor-pointer items-center justify-center rounded-md bg-red-500 text-white"
          onClick={async () => {
            try {
              if (!projectToDelete) return
              await window.electronAPI.deleteProject(projectToDelete)
              await loadProjects()
              setIsShowDeleteProjectWindow(false)
            } catch (error) {
              console.error("プロジェクトの削除に失敗しました:", error)
            }
          }}
        >
          削除する
        </div>
        <div className="w-20"></div>
        <div
          className="flex h-16 w-40 cursor-pointer items-center justify-center rounded-md bg-gray-300"
          onClick={() => {
            setIsShowDeleteProjectWindow(false)
          }}
        >
          戻る
        </div>
      </div>
    </div>
  )
}

export default DeleteProjectWindow
