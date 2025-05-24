import React, { useContext, useEffect, useState } from "react"

import { WithContext as ReactTags } from "react-tag-input"
import { ProjectContext } from "../../../../components/Context/ProjectContext"
import ProjectDate from "../../../../components/ProjectDate"
import "../CreateProjectWindow/reactTags.module.css"

interface ReactTag {
  id: string
  text: string
}

// コンポーネント名を EditProjectWindow に変更
const EditProjectWindow = (props: {
  // プロップ名を変更
  setIsShowEditProjectWindow: React.Dispatch<React.SetStateAction<boolean>>
  loadProjects: () => Promise<void>
  projectIdToEdit: string | null
}) => {
  // プロップ名を変更
  const { setIsShowEditProjectWindow, loadProjects, projectIdToEdit } = props
  const { projects } = useContext(ProjectContext)

  const [name, setName] = useState("")
  const [date, setDate] = useState<Date | null>(new Date())
  const [tags, setTags] = useState<ReactTag[]>([])

  useEffect(() => {
    if (projectIdToEdit) {
      const projectToEdit = projects.find(
        (p) => p.projectId === projectIdToEdit,
      )
      if (projectToEdit) {
        setName(projectToEdit.examName)
        setDate(projectToEdit.examDate)
        // TODO: タグの読み込みと設定 (現在のデータ構造に依存)
        // setTags(projectToEdit.tags?.map(tag => ({ id: tag.name, text: tag.name })) || [])
      }
    }
  }, [projectIdToEdit, projects])

  const suggestions: ReactTag[] = [
    { id: "数学", text: "数学" },
    { id: "India", text: "India" },
    { id: "Vietnam", text: "Vietnam" },
    { id: "Turkey", text: "Turkey" },
  ]

  const handleDelete = (i: number): void => {
    setTags(tags.filter((tag, index) => index !== i))
  }
  const handleAddition = (tag: { id: string; text: string }): void => {
    setTags([...tags, tag])
  }

  return (
    <div className="absolute inset-0 z-20 flex min-h-full min-w-full animate-float-in flex-col items-center justify-center border-2 bg-white/80">
      {/* タイトルを変更 */}
      <div className="text-2xl">プロジェクト編集</div>
      <div className="py-10">
        <div className="flex">
          <div className="flex items-center">
            <div className="flex w-16 pr-4">名前</div>
            <input
              type="text"
              placeholder="試験名"
              className="w-96 border-b-2 p-4 outline-none placeholder:opacity-0"
              value={name} // valueプロパティを追加
              onChange={(e) => {
                setName(e.target.value)
              }}
              autoFocus
            />
          </div>
        </div>
        <ProjectDate date={date} setDate={setDate} />
        <div className="flex">
          <div className="flex items-center">
            <div className="flex w-16 pr-4">タグ</div>
            <ReactTags
              tags={tags}
              suggestions={suggestions}
              handleAddition={handleAddition}
              handleDelete={handleDelete}
              autocomplete
              allowUnique
              allowDragDrop={false}
              allowDeleteFromEmptyInput={false}
              autofocus={false}
              inputFieldPosition="top"
              placeholder="入力して Enter で追加"
              minQueryLength={0}
              renderSuggestion={({ text }, query) => (
                <div className="px-2 py-1">{text}</div>
              )}
              classNames={{
                tags: "text-xs min-h-14 border-b-2 flex flex-col justify-center py-2", // 例
                tagInput: "px-4",
                tagInputField: "w-full min-w-60 outline-none text-xs", // Tailwind CSSクラスの適用例
                selected: "flex w-96 flex-wrap items-center px-4",
                tag: "mt-1 mr-2 bg-slate-200 flex items-center",
                remove: "pl-2 text-xs",
                suggestions:
                  "absolute ml-4 mt-12 flex max-h-40 animate-float-in flex-row overflow-y-auto rounded-md border-2 bg-white p-2 ",
                activeSuggestion: "bg-slate-200",
              }}
            />
          </div>
        </div>
      </div>
      <div className="flex py-10">
        <div
          className="flex h-16 w-40 cursor-pointer items-center justify-center rounded-md bg-emerald-500 text-white"
          onClick={() => {
            if (!projectIdToEdit) return
            // updateProject APIを呼び出すように変更 (API側の実装が必要)
            window.electronAPI
              .updateProject({
                // 仮のAPI関数名
                projectId: projectIdToEdit,
                examName: name,
                examDate: date,
                // tags: tags.map(tag => tag.text) // タグの更新も考慮
              })
              .then(async (res) => {
                await loadProjects()
                // プロップ名を変更
                setIsShowEditProjectWindow(false)
              })
              .catch((err): void => {
                console.error("プロジェクトの更新に失敗しました:", err)
              })
          }}
        >
          {/* ボタンテキストを変更 */}
          更新する
        </div>
        <div className="w-20"></div>
        <div
          className="flex h-16 w-40 cursor-pointer items-center justify-center rounded-md bg-gray-300"
          onClick={() => {
            // プロップ名を変更
            setIsShowEditProjectWindow(false)
          }}
        >
          戻る
        </div>
      </div>
    </div>
  )
}

export default EditProjectWindow // エクスポート名を変更
