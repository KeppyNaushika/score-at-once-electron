import React, { useState, useEffect } from "react" // useContext を削除
// import { useProjectContext } from "../../../app/context/ProjectContext" // 削除
import { useProjects } from "../../../../components/hooks/useProjects" // useProjects をインポート
import { type Project } from "../../../../types/common.types"

const Info = () => {
  // const { selectedProjectId, projects, updateProject } = useProjectContext() // 削除
  const { selectedProjectId, projects, editProject } = useProjects() // useProjects を使用し、updateProject を editProject に変更 (想定)
  const [examName, setExamName] = useState("")
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved">("")

  useEffect(() => {
    if (selectedProjectId && projects) {
      const project = projects.find((p) => p.projectId === selectedProjectId)
      if (project) {
        setCurrentProject(project)
        setExamName(project.examName)
      } else {
        setCurrentProject(null)
        setExamName("")
      }
    } else {
      setCurrentProject(null)
      setExamName("")
    }
  }, [selectedProjectId, projects])

  const showSaving = () => setSaveStatus("saving")
  const showSaved = () => {
    setSaveStatus("saved")
    setTimeout(() => setSaveStatus(""), 2000) // Clear status after 2 seconds
  }

  const handleExamNameChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newName = e.target.value
    setExamName(newName)
    if (currentProject) {
      showSaving()
      try {
        // Assuming updateProject in context handles API call and state update
        // await updateProject({ ...currentProject, examName: newName }) // 削除
        await editProject({
          projectId: currentProject.projectId,
          examName: newName,
        }) // editProject を使用 (引数の形式は useProjects の実装に依存)
        showSaved()
      } catch (error) {
        console.error("Failed to save exam name:", error)
        setSaveStatus("") // Clear status on error
      }
    }
  }

  if (!selectedProjectId || !currentProject) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        プロジェクトが選択されていません。ファイルタブからプロジェクトを選択または作成してください。
      </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">試験情報編集</h1>
      <div className="mb-4">
        <label
          htmlFor="examName"
          className="block text-sm font-medium text-gray-700"
        >
          試験名
        </label>
        <input
          type="text"
          id="examName"
          value={examName}
          onChange={handleExamNameChange}
          className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {saveStatus === "saving" && (
          <p className="text-sm text-blue-500">保存中...</p>
        )}
        {saveStatus === "saved" && (
          <p className="text-sm text-green-500">保存しました！</p>
        )}
      </div>
      {/* Other fields like description, date, tags can be added here similarly */}
    </div>
  )
}

export default Info
