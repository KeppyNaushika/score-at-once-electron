/**
 * Worker 側の `fs`。非同期の関数は `promises`（`opfsFs.ts`）にあり、同期の関数とストリームは
 * 呼ばれたら分かる例外にする。
 *
 * web から届く経路の main のコードは `fs/promises` に揃えてある（同期の fs は eslint で
 * 禁止。例外は同期・旧形式の取り込み・merge・external-formats などで、web 版では未対応の経路）。
 * 束ねる第三者のライブラリも、ブラウザ向けの入口を使うので `fs` を読まない（`buildWorker.mjs`
 * が束ねたときに `fs` を読んだモジュールを一覧にして確かめる）。
 */
import { unsupportedFsFunction } from "./fsError"
import * as opfsFs from "./opfsFs"

export const promises = opfsFs

export const constants = opfsFs.constants

const unsupported = (functionName: string) => (): never => {
  throw unsupportedFsFunction(functionName)
}

export const existsSync = unsupported("existsSync")
export const readFileSync = unsupported("readFileSync")
export const writeFileSync = unsupported("writeFileSync")
export const appendFileSync = unsupported("appendFileSync")
export const mkdirSync = unsupported("mkdirSync")
export const mkdtempSync = unsupported("mkdtempSync")
export const readdirSync = unsupported("readdirSync")
export const statSync = unsupported("statSync")
export const lstatSync = unsupported("lstatSync")
export const accessSync = unsupported("accessSync")
export const copyFileSync = unsupported("copyFileSync")
export const cpSync = unsupported("cpSync")
export const renameSync = unsupported("renameSync")
export const rmSync = unsupported("rmSync")
export const rmdirSync = unsupported("rmdirSync")
export const unlinkSync = unsupported("unlinkSync")
export const createReadStream = unsupported("createReadStream")
export const createWriteStream = unsupported("createWriteStream")
export const writeFile = unsupported("writeFile（コールバック版）")
export const readFile = unsupported("readFile（コールバック版）")
export const unlink = unsupported("unlink（コールバック版）")
