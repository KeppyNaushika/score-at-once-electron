#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Force Cleanup Script for EBUSY Errors');
console.log('====================================');

/**
 * Force kill any processes that might be locking files
 */
function forceKillProcesses() {
  console.log('Checking for running processes...');
  
  try {
    // Kill any running Electron processes
    execSync('taskkill /F /IM "Score at Once.exe" 2>nul', { stdio: 'ignore' });
    console.log('✓ Killed Score at Once processes');
  } catch (e) {
    // Process not found, which is fine
  }

  try {
    // Kill any running electron processes
    execSync('taskkill /F /IM electron.exe 2>nul', { stdio: 'ignore' });
    console.log('✓ Killed Electron processes');
  } catch (e) {
    // Process not found, which is fine
  }

  try {
    // Kill Prisma processes that might be hanging
    console.log('Checking for Prisma processes...');
    const wmicOutput = execSync('wmic process where "CommandLine like \'%prisma%\'" get ProcessId,CommandLine /format:csv 2>nul', { 
      encoding: 'utf8',
      timeout: 5000
    });
    
    if (wmicOutput && wmicOutput.includes('prisma')) {
      console.log('Found Prisma processes:');
      const lines = wmicOutput.split('\n').filter(line => line.includes('prisma'));
      lines.forEach(line => {
        const match = line.match(/(\d+)$/);
        if (match) {
          const pid = match[1];
          try {
            execSync(`taskkill /F /PID ${pid} 2>nul`, { stdio: 'ignore' });
            console.log(`✓ Killed Prisma process PID: ${pid}`);
          } catch (e) {
            console.log(`✗ Failed to kill Prisma process PID: ${pid}`);
          }
        }
      });
    } else {
      console.log('✓ No Prisma processes found');
    }
  } catch (e) {
    console.log('✓ No Prisma processes found');
  }

  try {
    // Kill any Node.js processes that might be related to this project
    const nodeProcesses = execSync('wmic process where "name=\'node.exe\'" get ProcessId,CommandLine /format:csv 2>nul', { 
      encoding: 'utf8',
      timeout: 5000
    });
    
    if (nodeProcesses) {
      const projectPath = process.cwd().replace(/\\/g, '\\\\');
      const lines = nodeProcesses.split('\n').filter(line => line.includes(projectPath));
      
      if (lines.length > 0) {
        console.log('Found project-related Node.js processes:');
        lines.forEach(line => {
          const match = line.match(/(\d+)$/);
          if (match) {
            const pid = match[1];
            // Don't kill the current process
            if (pid !== process.pid.toString()) {
              try {
                execSync(`taskkill /F /PID ${pid} 2>nul`, { stdio: 'ignore' });
                console.log(`✓ Killed Node.js process PID: ${pid}`);
              } catch (e) {
                console.log(`✗ Failed to kill Node.js process PID: ${pid}`);
              }
            }
          }
        });
      } else {
        console.log('✓ No project-related Node.js processes found');
      }
    }
  } catch (e) {
    console.log('✓ No project-related Node.js processes found');
  }
}

/**
 * Force remove directory with retries
 */
function forceRemoveDirectory(dirPath, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      if (fs.existsSync(dirPath)) {
        console.log(`Attempting to remove ${dirPath} (attempt ${i + 1}/${retries})...`);
        
        // First try to change permissions
        try {
          execSync(`attrib -R "${dirPath}\\*.*" /S /D`, { stdio: 'ignore' });
        } catch (e) {
          // Ignore permission errors
        }
        
        // Try to remove
        fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
        console.log(`✓ Successfully removed ${dirPath}`);
        return true;
      }
      return true;
    } catch (error) {
      if (i === retries - 1) {
        console.error(`✗ Failed to remove ${dirPath}: ${error.message}`);
        return false;
      }
      console.log(`Retry ${i + 1} failed, waiting 2 seconds...`);
      // Wait before retry
      execSync('timeout /t 2 /nobreak >nul', { stdio: 'ignore' });
    }
  }
  return false;
}

// Main execution
async function main() {
  // Step 1: Kill processes
  forceKillProcesses();
  
  // Step 2: Wait a moment for processes to fully terminate
  console.log('Waiting for processes to terminate...');
  execSync('timeout /t 3 /nobreak >nul', { stdio: 'ignore' });
  
  // Step 3: Clear directories
  const dirsToClean = [
    path.join(process.cwd(), '.next'),
    path.join(process.cwd(), 'main'), 
    path.join(process.cwd(), 'out')
  ];
  
  let allSuccess = true;
  for (const dir of dirsToClean) {
    if (!forceRemoveDirectory(dir)) {
      allSuccess = false;
    }
  }
  
  if (allSuccess) {
    console.log('\n✓ Force cleanup completed successfully');
    console.log('Next steps:');
    console.log('1. Run: npm run build');
    console.log('2. Run: npm run make');
  } else {
    console.log('\n⚠ Some directories could not be removed');
    console.log('You may need to:');
    console.log('1. Restart your computer');
    console.log('2. Check Windows Explorer is not open in the build directories');
    console.log('3. Run this script as administrator');
  }
}

main().catch(console.error);