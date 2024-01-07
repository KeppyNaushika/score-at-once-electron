import { LibraryAddOutlined } from "@mui/icons-material"
import React, { useRef, type ChangeEvent } from "react"

const AddPictureFiles = (props: {
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
        if (
          file.type.match("image/jpeg") != null ||
          file.type.match("image/png") != null
        ) {
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
  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        style={{ display: "none" }}
        multiple
        accept="image/jpeg, image/png"
        placeholder="."
      />
      <div
        className="flex h-1/2 cursor-pointer flex-col items-center justify-center"
        onClick={handleClick}
      >
        <LibraryAddOutlined />
        <div className="pt-2 text-xs">JPEG / PNG</div>
      </div>
    </>
  )
}

export default AddPictureFiles
