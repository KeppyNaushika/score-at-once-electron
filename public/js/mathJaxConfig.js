/**
 * MathJax の設定と読み込み（`src/app/layout.tsx` が `<script async>` で読む）。
 *
 * 設定は MathJax 本体（`/js/mathjax/tex-svg.js`）より先に `window.MathJax` に置く必要がある。
 * 以前は layout にインラインの `<script>` で書いていたが、web 版の CSP でインラインの
 * スクリプトを許さないため外のファイルにした。React は `async` の `<script>` を `<head>` の
 * 前の方へ寄せるので、layout に本体と設定を並べても順は保てない。そこで本体の読み込みも
 * ここから行い、設定を置いてから本体を足す。デスクトップ版（Electron）も web 版も同じ。
 *
 * 外へは何も取りに行かせない:
 * - 置き場（`loader.paths`）を自前の場所に明示する。MathJax の既定では、フォントの
 *   置き場が CDN（cdn.jsdelivr.net）になっている
 * - 追加の部品の読み込み（`loader.require`）は記録だけにする。SVG 出力は本体に入った
 *   フォントのパスで描くので、追加の読み込みは要らない
 * - 読み上げ・点字・意味付け（a11y の enrichment と speech）を切る。数式は答案用紙の
 *   SVG にして使うので読み上げは使わず、speech は blob: の URL から Worker を作る
 *   （`/js/mathjax/sre/speech-worker.js` を読む）。右クリックのメニューも出さない
 *   （メニューから読み上げを入れ直せないように）
 */
;(function () {
  var MATHJAX_ROOT = "/js/mathjax"

  window.MathJax = {
    tex: {
      inlineMath: [
        ["$", "$"],
        ["\\(", "\\)"],
      ],
      displayMath: [
        ["$$", "$$"],
        ["\\[", "\\]"],
      ],
      processEscapes: true,
      processEnvironments: true,
      packages: { "[+]": ["base", "ams", "newcommand"] },
    },
    svg: {
      fontCache: "global",
      scale: 1.0,
      minScale: 0.5,
      mtextInheritFont: false,
      merrorInheritFont: true,
      mathmlSpacing: false,
      skipAttributes: {},
      exFactor: 0.5,
      displayAlign: "left",
      displayIndent: "0",
    },
    options: {
      skipHtmlTags: ["script", "noscript", "style", "textarea", "pre"],
      ignoreHtmlClass: "no-mathjax",
      processHtmlClass: "mathjax",
      enableMenu: false,
      enableEnrichment: false,
      enableSpeech: false,
      enableBraille: false,
      enableExplorer: false,
      enableComplexity: false,
      menuOptions: {
        settings: {
          enrich: false,
          speech: false,
          braille: false,
          collapsible: false,
        },
      },
    },
    loader: {
      paths: {
        mathjax: MATHJAX_ROOT,
        fonts: MATHJAX_ROOT + "/fonts",
        sre: MATHJAX_ROOT + "/sre",
      },
      source: {},
      dependencies: {},
      provides: {},
      failed: function () {
        console.warn("MathJax loader failed")
      },
      require: function (url) {
        console.log("MathJax require:", url)
      },
    },
    startup: {
      ready: function () {
        console.log("MathJax 4 initialized (Offline Mode)")
        window.MathJax.startup.defaultReady()
      },
    },
  }

  var mathJaxScript = document.createElement("script")
  mathJaxScript.id = "MathJax-script"
  mathJaxScript.async = true
  mathJaxScript.src = MATHJAX_ROOT + "/tex-svg.js"
  document.head.appendChild(mathJaxScript)
})()
