/**
 * Worker 側の `os`。main のコードが使うのは一時ディレクトリと端末名だけ。
 */
import { WEB_TEMP_DIRECTORY } from "./webPaths"

export const EOL = "\n"

export const tmpdir = (): string => WEB_TEMP_DIRECTORY

export const homedir = (): string => WEB_TEMP_DIRECTORY

export const hostname = (): string => "web"

export const platform = (): string => "browser"
