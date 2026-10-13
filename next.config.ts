import type { NextConfig } from "next"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants"

import packageJson from "./package.json"
import {
  ROUTE_PARAM_NAMES,
  ROUTE_SHELL_PARAM,
  type RouteSection,
} from "./src/lib/routeShell"

/**
 * 静的書き出しの置き場。デスクトップ版はこれを main が配り（`electron-src/rendererProtocol.ts`。
 * パッケージ版では `Resources/renderer`）、web 版はこれをそのまま配信に載せる。
 *
 * `.next` 以外の名前にしておく。Next は `distDir` が既定の `.next` のときだけ書き出しを
 * `out/` に置き、`out/` は electron-forge の出力先と重なる
 */
export const RENDERER_EXPORT_DIR = "renderer"

/**
 * 開発用サーバーで、実際の id の URL を殻へ書き換える（`src/lib/routeShell.ts`）。
 * 動的ルートは殻以外の値を描かない（`dynamicParams = false`）ので、ファイルを探す前に
 * 書き換える（`beforeFiles`）。ビルドは静的書き出しで `rewrites` を持てないので、配る側
 * （main・web の配信）が同じ書き換えをする
 */
export async function routeShellRewrites() {
  const sections = Object.keys(ROUTE_PARAM_NAMES) as RouteSection[]
  return {
    beforeFiles: sections.flatMap((section) => [
      {
        source: `/${section}/:id`,
        destination: `/${section}/${ROUTE_SHELL_PARAM}`,
      },
      {
        source: `/${section}/:id/:path*`,
        destination: `/${section}/${ROUTE_SHELL_PARAM}/:path*`,
      },
    ]),
  }
}

const sharedConfig: NextConfig = {
  /**
   * 「一括採点について」に出すバージョンとソースの在りか。手で書かず package.json から埋め込む
   * （web 版の Worker の `__APP_VERSION__` と同じ出どころ）
   */
  env: {
    APP_VERSION: packageJson.version,
    APP_REPOSITORY_URL: packageJson.repository.url,
  },
  /**
   * 左下の開発インジケーター（「N」の丸）。撮影では消す。公式サイトの使い方に
   * 貼る図に開発中の印が写るため。ビルドやランタイムのエラー表示は消えない。
   */
  ...(process.env.SCORE_AT_ONCE_HIDE_DEV_INDICATOR
    ? { devIndicators: false }
    : {}),
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  reactStrictMode: false, // Strict Modeを無効化してテスト
}

/**
 * 既定の `.next` 以外の置き場で開発用サーバーを動かすときに使う tsconfig。置き場ごとに1つ。
 *
 * 開発用サーバーは起動のたびに、使う tsconfig の `include` へ置き場の型
 * （`<置き場>/types/**` など）を書き足す。`tsconfig.json` のままだと e2e・撮影の置き場の型が
 * 本番の型検査（`npm run typecheck`・`next build`）に入り、置き場に残った古い型
 * （今は無いルートを指す `validator.ts` 等）で落ちる。ここに挙げた tsconfig は
 * `tsconfig.json` を `extends` していて、Next は `extends` を持つ tsconfig を書き換えない
 * （`next/dist/lib/typescript/writeConfigurationDefaults.js`）ので、足した型の行も戻されない
 */
const DEV_TSCONFIG_BY_DIST_DIR: Record<string, string> = {
  ".next-e2e": "tsconfig.e2e.json",
  ".next-screenshot": "tsconfig.screenshot.json",
}

/** 開発用サーバーの置き場と tsconfig。置き場が既定でなく tsconfig も無いなら止める */
function resolveDevBuildPaths(): { distDir: string; tsconfigPath?: string } {
  const distDir = process.env.NEXT_DIST_DIR
  if (!distDir || distDir === ".next") return { distDir: ".next" }
  const tsconfigPath = DEV_TSCONFIG_BY_DIST_DIR[distDir]
  if (!tsconfigPath) {
    throw new Error(
      `NEXT_DIST_DIR=${distDir} に対応する tsconfig が無い。next.config.ts の DEV_TSCONFIG_BY_DIST_DIR に足す（無いと置き場の型が tsconfig.json に書き足され、本番の型検査が拾う）`
    )
  }
  return { distDir, tsconfigPath }
}

export default function nextConfig(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const { distDir, tsconfigPath } = resolveDevBuildPaths()
    return {
      ...sharedConfig,
      rewrites: routeShellRewrites,
      /**
       * ビルド成果物の置き場。既定は `.next`。
       *
       * e2e・撮影は `NEXT_DIST_DIR` を別の名前にして走る。同じ作業ツリーで開発用サーバーが
       * 動いていることがあり、`.next` を共有すると互いのビルドを壊すため。
       */
      distDir,
      ...(tsconfigPath ? { typescript: { tsconfigPath } } : {}),
    }
  }
  // デスクトップ版も web 版も、同じ静的書き出しを配る（`src/lib/routeShell.ts`）
  return {
    ...sharedConfig,
    output: "export",
    distDir: RENDERER_EXPORT_DIR,
  }
}
