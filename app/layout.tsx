import AppShell from "@/components/layout/AppShell"
import { AuthProvider } from "@/contexts/AuthContext"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "一括採点",
  description: "複数教員対応型採点アプリケーション",
  icons: {
    icon: "/一括採点アイコン.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.MathJax = {
                tex: {
                  inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                  displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                  processEscapes: true,
                  processEnvironments: true
                },
                svg: {
                  fontCache: 'global',
                  // オフライン環境用の設定
                  scale: 1,
                  minScale: 0.5,
                  mtextInheritFont: false,
                  merrorInheritFont: true,
                  mathmlSpacing: false,
                  skipAttributes: {},
                  exFactor: 0.5,
                  displayAlign: 'center',
                  displayIndent: '0'
                },
                // オフライン専用設定
                options: {
                  // 外部リソースの読み込みを無効化
                  enableMenu: false,
                  menuOptions: {
                    settings: {
                      assistiveMml: false,
                      collapsible: false,
                      explorer: false
                    }
                  }
                },
                // ローダー設定（オフライン）
                loader: {
                  load: [],
                  ready: () => {},
                  failed: () => {},
                  require: () => {},
                  paths: {},
                  source: {},
                  dependencies: {},
                  provides: {},
                  mathjax: {}
                },
                startup: {
                  ready: () => {
                    console.log('🔥 MathJax 4 initialized successfully (Offline Mode)');
                    MathJax.startup.defaultReady();
                    // 初期化完了をグローバルに通知
                    window.mathJaxReady = true;
                    window.dispatchEvent(new Event('mathjax-ready'));
                  }
                }
              };
            `,
          }}
        />
        <script
          id="MathJax-script"
          async
          src="/js/mathjax/tex-svg.js"
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
