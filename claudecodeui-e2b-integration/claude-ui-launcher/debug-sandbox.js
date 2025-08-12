// Debug script for E2B sandbox issues
const { Sandbox } = require('e2b')

async function debugSandbox() {
  try {
    console.log('🔍 Debugging E2B sandbox startup issues...')
    
    // Connect to existing sandbox
    const sandboxId = 'iqkcexfqvec2x1ngyret1' // Replace with actual ID
    const sandbox = await Sandbox.create(sandboxId)
    
    console.log(`📡 Connected to sandbox: ${sandboxId}`)
    
    // Check if services are running
    console.log('\n📋 Checking running processes:')
    const processes = await sandbox.process.startAndWait('ps aux | grep -E "(node|npm|vite)"')
    console.log(processes.stdout)
    
    // Check port 3009 specifically
    console.log('\n🔌 Checking port 3009:')
    const portCheck = await sandbox.process.startAndWait('netstat -tlnp | grep 3009 || echo "Port 3009 not found"')
    console.log(portCheck.stdout)
    
    // Check claudecodeui directory and package.json
    console.log('\n📂 Checking claudecodeui setup:')
    const dirCheck = await sandbox.process.startAndWait('ls -la /home/user/claudecodeui/')
    console.log(dirCheck.stdout)
    
    // Check package.json scripts
    console.log('\n📜 Checking package.json scripts:')
    const scriptsCheck = await sandbox.process.startAndWait('cat /home/user/claudecodeui/package.json | jq .scripts')
    console.log(scriptsCheck.stdout)
    
    // Check if node_modules exists
    console.log('\n📦 Checking node_modules:')
    const nodeModulesCheck = await sandbox.process.startAndWait('ls -la /home/user/claudecodeui/node_modules | head -10')
    console.log(nodeModulesCheck.stdout)
    
    // Check startup script
    console.log('\n🚀 Checking startup script:')
    const startupCheck = await sandbox.process.startAndWait('cat /home/user/start-all-services.sh')
    console.log(startupCheck.stdout)
    
    // Try to start the client manually
    console.log('\n🔧 Attempting to start client manually:')
    const manualStart = await sandbox.process.startAndWait('cd /home/user/claudecodeui && npm run client', {
      timeout: 30000
    })
    console.log('STDOUT:', manualStart.stdout)
    console.log('STDERR:', manualStart.stderr)
    console.log('Exit code:', manualStart.exitCode)
    
  } catch (error) {
    console.error('❌ Debug failed:', error)
  }
}

debugSandbox()