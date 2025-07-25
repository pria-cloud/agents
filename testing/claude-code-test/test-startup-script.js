const { Sandbox } = require('e2b')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env.local
function loadEnvLocal() {
  try {
    const envPath = path.join(__dirname, '.env.local')
    const envContent = fs.readFileSync(envPath, 'utf8')
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim()
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    })
  } catch (error) {
    console.log('Warning: Could not load .env.local file')
  }
}

async function testStartupScript() {
  loadEnvLocal()
  
  console.log('🧪 Testing Startup Script Execution')
  console.log('===================================')
  console.log(`Template ID: ${process.env.E2B_TEMPLATE_ID}`)
  console.log('')
  
  try {
    console.log('1️⃣  Creating fresh sandbox...')
    const sandbox = await Sandbox.create(process.env.E2B_TEMPLATE_ID)
    console.log(`✅ Sandbox created: ${sandbox.sandboxId}`)
    console.log(`🌐 URL: https://3000-${sandbox.sandboxId}.e2b.app`)
    
    // Wait a moment for sandbox to fully initialize
    console.log('\n2️⃣  Waiting for sandbox initialization...')
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // Check if the startup script exists and is executable
    console.log('\n3️⃣  Checking startup script...')
    const scriptCheck = await sandbox.commands.run('ls -la /code/scripts/start-services.sh')
    
    if (scriptCheck.exitCode !== 0) {
      console.log('❌ Startup script not found!')
      console.log('stdout:', scriptCheck.stdout)
      console.log('stderr:', scriptCheck.stderr)
      return
    }
    
    console.log('✅ Startup script found:')
    console.log(scriptCheck.stdout)
    
    // Make sure it's executable
    console.log('\n4️⃣  Making script executable...')
    const chmodResult = await sandbox.commands.run('chmod +x /code/scripts/start-services.sh')
    
    if (chmodResult.exitCode === 0) {
      console.log('✅ Script made executable')
    } else {
      console.log('❌ Failed to make script executable')
      console.log('stderr:', chmodResult.stderr)
    }
    
    // Check what's in the /code directory
    console.log('\n5️⃣  Examining /code directory structure...')
    const codeList = await sandbox.commands.run('find /code -type f -name "*.json" -o -name "*.sh" -o -type d | head -20')
    console.log('Code directory contents:')
    console.log(codeList.stdout)
    
    // Check if we have Node.js and npm
    console.log('\n6️⃣  Checking Node.js installation...')
    const nodeCheck = await sandbox.commands.run('node --version && npm --version')
    console.log('Node.js version info:')
    console.log(nodeCheck.stdout)
    if (nodeCheck.stderr) console.log('stderr:', nodeCheck.stderr)
    
    // Try to run the startup script and capture detailed output
    console.log('\n7️⃣  Running startup script with full logging...')
    const startResult = await sandbox.commands.run('cd /code && timeout 60 ./scripts/start-services.sh')
    
    console.log(`Script exit code: ${startResult.exitCode}`)
    console.log('Script stdout:')
    console.log(startResult.stdout || 'No stdout')
    console.log('Script stderr:')
    console.log(startResult.stderr || 'No stderr')
    
    // If the script failed, let's check what went wrong
    if (startResult.exitCode !== 0) {
      console.log('\n8️⃣  Diagnosing startup failure...')
      
      // Check if API service dependencies can be installed
      console.log('Checking API service directory...')
      const apiCheck = await sandbox.commands.run('ls -la /code/api-service/')
      console.log('API service dir:', apiCheck.stdout)
      
      // Try to build the API service manually
      console.log('Attempting to build API service manually...')
      const manualBuild = await sandbox.commands.run('cd /code/api-service && npm install && npm run build')
      console.log(`Manual build exit code: ${manualBuild.exitCode}`)
      console.log('Manual build stdout:', manualBuild.stdout)
      console.log('Manual build stderr:', manualBuild.stderr)
    }
    
    // Check what processes are running
    console.log('\n9️⃣  Checking running processes...')
    const processCheck = await sandbox.commands.run('ps aux | grep -E "(node|npm)" | grep -v grep')
    console.log('Running Node processes:')
    console.log(processCheck.stdout || 'No Node processes found')
    
    // Check if any logs were created
    console.log('\n🔟 Checking for service logs...')
    const logCheck = await sandbox.commands.run('ls -la /code/logs/ 2>/dev/null || echo "No logs directory"')
    console.log('Logs directory:', logCheck.stdout)
    
    if (logCheck.stdout.includes('api-service.log')) {
      const apiLogCheck = await sandbox.commands.run('cat /code/logs/api-service.log')
      console.log('API service log:')
      console.log(apiLogCheck.stdout)
    }
    
    if (logCheck.stdout.includes('nextjs.log')) {
      const nextLogCheck = await sandbox.commands.run('cat /code/logs/nextjs.log')
      console.log('Next.js log:')
      console.log(nextLogCheck.stdout)
    }
    
    console.log(`\n🎯 Sandbox available at: https://3000-${sandbox.sandboxId}.e2b.app`)
    console.log('⏰ Keeping sandbox alive for 2 minutes for manual inspection...')
    
    // Keep alive for manual testing
    await new Promise(resolve => setTimeout(resolve, 120000))
    
    await sandbox.kill()
    console.log('✅ Sandbox closed')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Full error:', error)
  }
}

testStartupScript().catch(console.error)