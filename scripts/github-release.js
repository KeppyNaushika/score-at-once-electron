const { execSync } = require("child_process")
require("dotenv").config()

/**
 * GitHub Actions経由でリリースをトリガーする
 * @param {string} versionType - version bump type (patch, minor, major)
 * @param {string} prereleaseType - prerelease type (alpha, beta, rc, or empty for stable)
 */
async function triggerGitHubRelease(versionType = "patch", prereleaseType = "") {
  try {
    console.log("🚀 Triggering GitHub Actions release workflow...")

    // GitHub CLI でワークフローをトリガー
    const command = [
      "gh", "workflow", "run", "manual-release.yml",
      "-f", `version_type=${versionType}`,
      "-f", `prerelease_type=${prereleaseType}`
    ].join(" ")

    console.log(`Executing: ${command}`)
    execSync(command, { stdio: "inherit" })

    console.log("✅ GitHub Actions workflow triggered successfully!")
    console.log("📝 Check the Actions tab in your repository to monitor the build progress.")
    
  } catch (error) {
    console.error("❌ Failed to trigger GitHub Actions workflow:", error.message)
    process.exit(1)
  }
}

// Export for use in other scripts
module.exports = { triggerGitHubRelease }

// Command line usage
if (require.main === module) {
  const versionType = process.argv[2] || "patch"
  const prereleaseType = process.argv[3] || ""

  if (!["patch", "minor", "major"].includes(versionType)) {
    console.error("❌ Invalid version type. Use: patch, minor, or major")
    process.exit(1)
  }

  if (prereleaseType && !["alpha", "beta", "rc"].includes(prereleaseType)) {
    console.error("❌ Invalid prerelease type. Use: alpha, beta, rc, or leave empty")
    process.exit(1)
  }

  triggerGitHubRelease(versionType, prereleaseType)
}