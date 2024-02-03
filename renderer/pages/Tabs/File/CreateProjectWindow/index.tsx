import React, { useState } from "react"
import ProjectDate from "./ProjectDate"

const CreateProjectWindow = (props: {
  setIsShowCreateProjectWindow: React.Dispatch<React.SetStateAction<boolean>>
}): JSX.Element => {
  const { setIsShowCreateProjectWindow } = props
  const [name, setName] = useState("")
  const [date, setDate] = useState<Date | null>(new Date())

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
