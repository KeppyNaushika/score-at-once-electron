#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('File Lock Detection Script');
console.log('==========================');

const lockedPath = 'C:\\Users\\taro_\\dev\\score-at-once-electron\\out\\Score at Once-win32-x64';

function findLockingProcesses() {
  console.log(`Checking what's locking: ${lockedPath}\n`);

  try {
    // Method 1: Use handle.exe if available (Sysinternals)
    console.log('1. Trying handle.exe (if available)...');
    try {
      const handleOutput = execSync(`handle.exe "${lockedPath}"`, { encoding: 'utf8', timeout: 5000 });
      console.log('Handle.exe output:');
      console.log(handleOutput);
    } catch (e) {
      console.log('handle.exe not available or no handles found');
    }
  } catch (e) {
    console.log('handle.exe method failed');
  }

  try {
    // Method 2: Use PowerShell to find processes with open handles
    console.log('\n2. Using PowerShell to find open handles...');
    const psScript = `
    Get-Process | Where-Object {
      try {
        $_.Modules | Where-Object { $_.FileName -like "*Score at Once*" -or $_.FileName -like "*${lockedPath.replace(/\\/g, '\\\\')}*" }
      } catch {}
    } | Select-Object ProcessName, Id, Path
    `;
    
    const psOutput = execSync(`powershell -Command "${psScript}"`, { 
      encoding: 'utf8', 
      timeout: 10000 
    });
    console.log('PowerShell output:');
    console.log(psOutput || 'No processes found');
  } catch (e) {
    console.log('PowerShell method failed:', e.message);
  }

  try {
    // Method 3: Check for any Electron/Node processes
    console.log('\n3. Checking for Electron/Node processes...');
    const tasklist = execSync('tasklist /FI "IMAGENAME eq electron.exe" /FO CSV', { encoding: 'utf8' });
    console.log('Electron processes:');
    console.log(tasklist);
  } catch (e) {
    console.log('No Electron processes found');
  }

  try {
    console.log('\n4. Checking for Score at Once processes...');
    const scoreProcesses = execSync('tasklist /FI "IMAGENAME eq Score at Once.exe" /FO CSV', { encoding: 'utf8' });
    console.log('Score at Once processes:');
    console.log(scoreProcesses);
  } catch (e) {
    console.log('No Score at Once processes found');
  }

  try {
    // Method 4: Check Windows Explorer
    console.log('\n5. Checking if Windows Explorer has the folder open...');
    const explorerProcesses = execSync('tasklist /FI "IMAGENAME eq explorer.exe" /FO CSV', { encoding: 'utf8' });
    console.log('Explorer processes found:');
    console.log(explorerProcesses);
    
    console.log('\nNote: If Explorer is running, check if any Explorer windows');
    console.log('are open to the out directory or its subdirectories.');
  } catch (e) {
    console.log('Could not check Explorer processes');
  }

  try {
    // Method 5: Use WMIC to get detailed process info
    console.log('\n6. Detailed process check with WMIC...');
    const wmicOutput = execSync('wmic process where "name=\'electron.exe\' or name=\'Score at Once.exe\' or name=\'node.exe\'" get ProcessId,Name,CommandLine /format:csv', { 
      encoding: 'utf8',
      timeout: 5000
    });
    console.log('WMIC process details:');
    console.log(wmicOutput);
  } catch (e) {
    console.log('WMIC method failed:', e.message);
  }

  try {
    // Method 6: Check if any antivirus is scanning
    console.log('\n7. Checking for potential antivirus interference...');
    const antivirusProcesses = [
      'MsMpEng.exe',      // Windows Defender
      'avp.exe',          // Kaspersky
      'avgnt.exe',        // Avira
      'mcshield.exe',     // McAfee
      'NortonSecurity.exe' // Norton
    ];
    
    for (const av of antivirusProcesses) {
      try {
        const avCheck = execSync(`tasklist /FI "IMAGENAME eq ${av}"`, { encoding: 'utf8' });
        if (avCheck.includes(av)) {
          console.log(`Found antivirus process: ${av}`);
        }
      } catch (e) {
        // Process not found, continue
      }
    }
  } catch (e) {
    console.log('Antivirus check failed');
  }

  console.log('\n=== RECOMMENDATIONS ===');
  console.log('1. Close any Windows Explorer windows pointing to the /out directory');
  console.log('2. Make sure no Electron app is running');
  console.log('3. Check if antivirus is scanning the directory');
  console.log('4. Try running as administrator');
  console.log('5. Restart Windows Explorer: taskkill /f /im explorer.exe && start explorer.exe');
}

findLockingProcesses();