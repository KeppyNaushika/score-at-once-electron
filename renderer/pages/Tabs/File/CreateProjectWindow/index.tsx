import React, { useContext, useState } from "react"

import { WithContext as ReactTags } from "react-tag-input"
import { Tag } from "react-tag-input/types/components/SingleTag"
import { ProjectContext } from "../../../../components/Context/ProjectContext"
import DatePickerInputBox from "../../../../components/DatePickerInputBox"

import "../../../../components/reactTags.module.css"

const CreateProjectWindow = (props: {
  setIsShowCreateProjectWindow: React.Dispatch<React.SetStateAction<boolean>>
  loadProjects: () => Promise<void>
}) => {
  const { setProjects } = useContext(ProjectContext)
  const { setIsShowCreateProjectWindow, loadProjects } = props
  const [name, setName] = useState("")
  const [date, setDate] = useState<Date | null>(new Date())

  const [tags, setTags] = useState<Tag[]>([])
  const suggestions: Tag[] = [
    { id: "数学", text: "数学", className: "" },
    { id: "India", text: "India", className: "" },
    { id: "Vietnam", text: "Vietnam", className: "" },
    { id: "Turkey", text: "Turkey", className: "" },
  ]

  const handleDelete = (i: number): void => {
    setTags(tags.filter((tag, index) => index !== i))
  }
  const handleAddition = (tag: Tag): void => {
    setTags([...tags, tag])
  }

  return (
    <div className="absolute inset-0 z-20 flex min-h-full min-w-full animate-float-in flex-col items-center justify-center border-2 bg-white/80">
      <div className="text-2xl">新規作成</div>
      <div className="py-10">
        <div className="flex">
          <div className="flex items-center">
            <div className="flex w-16 pr-4">名前</div>
            <input
              type="text"
              placeholder="試験名"
              className="w-96 border-b-2 p-4 outline-none placeholder:opacity-0"
              onChange={(e) => {
                setName(e.target.value)
              }}
              autoFocus
            />
          </div>
        </div>
        <DatePickerInputBox date={date} setDate={setDate} enable={true} />
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
                editTagInput: "px-4",
                editTagInputField: "w-full min-w-60 outline-none text-xs",
                clearAll: "text-xs",
              }}
            />
          </div>
        </div>
      </div>
      <div className="flex py-10">
        <div
          className="flex h-16 w-40 cursor-pointer items-center justify-center rounded-md bg-emerald-500 text-white"
          onClick={async () => {
            try {
              await window.electronAPI.createProject({
                examName: name,
                examDate: date,
                // tags: tags.map(tag => tag.text) // タグも保存する場合
              })
              // setProjects(projects ?? []) // この行を削除
              await loadProjects() // loadProjects を呼び出す
              setIsShowCreateProjectWindow(false)
            } catch (error) {
              console.error("プロジェクトの作成に失敗しました:", error)
            }
          }}
        >
          作成する
        </div>
        <div className="w-20"></div>
        <div
          className="flex h-16 w-40 cursor-pointer items-center justify-center rounded-md bg-gray-300"
          onClick={() => {
            setIsShowCreateProjectWindow(false)
          }}
        >
          戻る
        </div>
      </div>
    </div>
  )
}

export default CreateProjectWindow
