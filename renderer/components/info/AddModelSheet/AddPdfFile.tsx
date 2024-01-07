import { LibraryAddOutlined } from "@mui/icons-material"
import React, { useRef, type ChangeEvent, useState } from "react"

const AddPdfFile = (props: {
  setModelSheets: React.Dispatch<React.SetStateAction<string[]>>
}): JSX.Element => {
  const { setModelSheets } = props

  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleClick = (): void => {
    fileInputRef.current?.click()
  }
  const handleFileInput = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files
    if (files != null) {
      Array.from(files).forEach((file) => {
        if (file.type.match("application/pdf") != null) {
          const reader = new FileReader()
          reader.onload = (e: ProgressEvent<FileReader>) => {
            const result = e.target?.result ?? null
            if (result !== null) {
              setModelSheets((prevThumbnails) => [
                ...prevThumbnails,
                result as string,
              ])
            }
          }
          reader.readAsDataURL(file)
        }
      })
    }
  }

  const [isShowPdfEditor, setIsShowPdfEditor] = useState(true)

  return (
    <>
      {isShowPdfEditor && (
        <div className="absolute inset-0 z-20 flex min-h-full min-w-full flex-col items-center justify-between bg-white/80 p-20">
          <div className="flex justify-center border-y-2 border-gray-200">
            <div className="flex">
              <div className="py-2">開始：</div>
              <input
                className="w-12 py-2 text-center placeholder:opacity-0 focus:outline-none"
                type="number"
                placeholder="開始ページ"
                value={1}
                min={1}
                max={1}
              />
              <div className="py-2">ページ</div>
            </div>
            <div className="mx-10 my-2 border-l-2 border-gray-200"></div>
            <div className="flex">
              <div className="py-2">終了：</div>
              <input
                className="w-12 py-2 text-center placeholder:opacity-0 focus:outline-none"
                type="number"
                placeholder="終了ページ"
                value={1}
                min={1}
                max={1}
              />
              <div className="py-2">ページ</div>
            </div>
            <div className="mx-10 my-2 border-l-2 border-gray-200"></div>
            <div className="flex">
              <div className="py-2">スキップ：</div>
              <input
                className="w-12 py-2 text-center placeholder:opacity-0 focus:outline-none"
                type="number"
                placeholder="スキップ"
                value={1}
                min={1}
                max={1}
              />
              <div className="py-2">ページ</div>
            </div>
            <div className="mx-10 my-2 border-l-2 border-gray-200"></div>
            <div className="flex">
              <div className="py-2">逆順</div>
              <select
                title="逆順"
                className="w-20 py-2 text-center placeholder:opacity-0 focus:outline-none"
              >
                <option value="false">オフ</option>
                <option value="true">オン</option>
              </select>
            </div>
          </div>
          <div className="flex py-4">
            <div className="flex h-16 w-40 flex-col items-center justify-center rounded-md bg-emerald-500 text-white">
              <div className="">上の画像を</div>
              <div className="">読み込む</div>
            </div>
            <div className="w-20"></div>
            <div className="flex h-16 w-40 items-center justify-center rounded-md bg-gray-300">
              戻る
            </div>
          </div>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        style={{ display: "none" }}
        accept="application/pdf"
        placeholder="."
      />
      <div
        className="flex h-1/2 cursor-pointer flex-col items-center justify-center"
        onClick={handleClick}
      >
        <LibraryAddOutlined />
        <div className="pt-2 text-xs">PDF</div>
      </div>
    </>
  )
}

export default AddPdfFile
