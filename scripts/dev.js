const { spawn } = require("child_process")
const { promisify } = require("util")
const sleep = promisify(setTimeout)

async function startDev() {
  console.log("Building Electron...")

  // Build Electron
  const buildProcess = spawn("npx", ["tsc", "-p", "electron-src"], {
    stdio: "inherit",
    shell: true,
  })
  await new Promise((resolve, reject) => {
    buildProcess.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Build failed with code ${code}`))
    })
  })

  console.log("Starting Next.js...")

  // Start Next.js
  const nextProcess = spawn("npx", ["next", "dev"], { stdio: "inherit", shell: true })

  // Wait for Next.js to be ready
  console.log("Waiting for Next.js to start...")
  await sleep(5000)

  console.log("Starting Electron...")

  // Start Electron
  const electronProcess = spawn("npx", ["electron", "."], { stdio: "inherit", shell: true })

  // Handle cleanup
  process.on("SIGINT", () => {
    console.log("\nShutting down...")
    nextProcess.kill()
    electronProcess.kill()
    process.exit()
  })
}

startDev().catch(console.error)
