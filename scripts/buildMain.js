const esbuild = require("esbuild")
const path = require("path")

const prismaClientPlugin = {
  name: "prisma-client-alias",
  setup(build) {
    build.onResolve({ filter: /^@prisma\/client$/ }, () => {
      return { path: path.resolve(__dirname, "../generated/prisma/client.ts") }
    })
  },
}

async function buildMain() {
  await esbuild.build({
    entryPoints: [path.join(__dirname, "../electron-src/index.ts")],
    bundle: true,
    platform: "node",
    target: "es2022",
    outdir: path.join(__dirname, "../main/electron-src"),
    format: "cjs",
    sourcemap: true,
    packages: "external",
    plugins: [prismaClientPlugin],
    banner: {
      js: 'var __import_meta_url = require("url").pathToFileURL(__filename).href;',
    },
    define: {
      "import.meta.url": "__import_meta_url",
    },
  })
}

buildMain().catch((err) => {
  console.error("Failed to build main:", err)
  process.exit(1)
})
