import React from "react"
import { FaFilePdf } from "react-icons/fa6"

const Export = (): JSX.Element => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="flex h-32 w-32 flex-col items-center justify-around rounded-md bg-slate-100 p-5">
      <FaFilePdf size={40} />
      <div className="flex flex-col">
        <div className="text-xs">採点済み答案を</div>
        <div className="text-xs">PDFで書き出し</div>
      </div>
    </div>
  </div>
)
export default Export
