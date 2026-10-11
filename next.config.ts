import type { NextConfig } from "next"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants"

import {
  ROUTE_PARAM_NAMES,
  ROUTE_SHELL_PARAM,
  type RouteSection,
} from "./src/lib/routeShell"

/**
 * 静的書き出しの置き場。デスクトップ版はこれを main が配り（`electron-src/rendererStaticServer.ts`。
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

export default function nextConfig(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      ...sharedConfig,
      rewrites: routeShellRewrites,
      /**
       * ビルド成果物の置き場。既定は `.next`。
       *
       * e2e は `NEXT_DIST_DIR` を別の名前にして走る。同じ作業ツリーで開発用サーバーが
       * 動いていることがあり、`.next` を共有すると互いのビルドを壊すため。
       */
      distDir: process.env.NEXT_DIST_DIR || ".next",
    }
  }
  // デスクトップ版も web 版も、同じ静的書き出しを配る（`src/lib/routeShell.ts`）
  return {
    ...sharedConfig,
    output: "export",
    distDir: RENDERER_EXPORT_DIR,
  }
}
