const { execSync } = require("child_process")

async function createAdvancedPrerelease(type, identifier) {
  try {
    console.log(`🚀 Creating ${identifier} pre-release (${type})...`)

    let versionCommand

    switch (identifier) {
      case "alpha":
        versionCommand = `npm version pre${type} --preid=alpha`
        break
      case "beta":
        versionCommand = `npm version pre${type} --preid=beta`
        break
      case "rc":
        versionCommand = `npm version pre${type} --preid=rc`
        break
      default:
        versionCommand = `npm version pre${type}`
    }

    // Bump version with specific prerelease identifier
    execSync(versionCommand, { stdio: "inherit" })

    // Get new version
    const packageJson = require("../package.json")
    const newVersion = packageJson.version

    console.log(`✅ Version bumped to: ${newVersion}`)
    console.log("📤 Pushing version commit and tag...")

    // Push the version commit and tag created by npm version
    execSync("git push", { stdio: "inherit" })
    execSync("git push --tags", { stdio: "inherit" })

    // Create pre-release using the existing function
    const { createPrereleaseGitHub } = require("./prerelease")
    await createPrereleaseGitHub(newVersion)
  } catch (error) {
    console.error("❌ Advanced pre-release failed:", error.message)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const type = args[0] || "patch" // patch, minor, major
const identifier = args[1] || "alpha" // alpha, beta, rc

if (!["patch", "minor", "major"].includes(type)) {
  console.error("❌ Invalid version type. Use: patch, minor, or major")
  console.log("Usage: node scripts/prerelease-advanced.js <type> <identifier>")
  console.log("Example: node scripts/prerelease-advanced.js patch alpha")
  process.exit(1)
}

if (!["alpha", "beta", "rc"].includes(identifier)) {
  console.error("❌ Invalid identifier. Use: alpha, beta, or rc")
  console.log("Usage: node scripts/prerelease-advanced.js <type> <identifier>")
  console.log("Example: node scripts/prerelease-advanced.js patch alpha")
  process.exit(1)
}

createAdvancedPrerelease(type, identifier)
