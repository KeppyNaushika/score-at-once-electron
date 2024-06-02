import React from "react"
import { FaFileExcel, FaFileExport, FaFilePdf } from "react-icons/fa6"

const Export = (): JSX.Element => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="flex w-[600px] justify-between">
      <div className="flex h-32 w-32 flex-col items-center justify-center rounded-md bg-pink-200">
        <FaFileExport size={40} className="my-4 text-slate-500" />
        <div className="flex flex-col items-center">
          <div className="text-xs">採点データ</div>
        </div>
      </div>
      <div className="flex h-32 w-32 flex-col items-center justify-center rounded-md bg-red-100">
        <FaFilePdf size={40} className="my-4 text-slate-500" />
        <div className="flex flex-col items-center">
          <div className="text-xs">採点済み答案</div>
        </div>
      </div>
      <div className="flex h-32 w-32 flex-col items-center justify-center rounded-md bg-blue-100">
        <FaFilePdf size={40} className="my-4 text-slate-500" />
        <div className="flex flex-col items-center">
          <div className="text-xs">個人成績表</div>
        </div>
      </div>
      <div className="flex h-32 w-32 flex-col items-center justify-center rounded-md bg-emerald-100">
        <FaFileExcel size={40} className="my-4 text-slate-500" />
        <div className="flex flex-col items-center">
          <div className="text-xs">点数データ</div>
        </div>
      </div>
    </div>
  </div>
)
export default Export
