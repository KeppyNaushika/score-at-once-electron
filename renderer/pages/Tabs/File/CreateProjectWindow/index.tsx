import React, { useState } from "react"
import ProjectDate from "./ProjectDate"
import "../CreateProjectWindow/reactTags.module.css"
import { WithContext as ReactTags } from "react-tag-input"

interface ReactTag {
  id: string
  text: string
}

const CreateProjectWindow = (props: {
  setIsShowCreateProjectWindow: React.Dispatch<React.SetStateAction<boolean>>
}): JSX.Element => {
  const { setIsShowCreateProjectWindow } = props
  const [name, setName] = useState("")
  const [date, setDate] = useState<Date | null>(new Date())

  const [tags, setTags] = useState<ReactTag[]>([])
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
            window.electronAPI
              .createProject({
                examName: name,
                examDate: date,
              })
              .then((res) => {
                setIsShowCreateProjectWindow(false)
              })
              .catch((err): void => {
                console.log(err)
              })
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
