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

async function debugPort4000() {
  loadEnvLocal()
  
  console.log('🔍 Debugging Port 4000 Issue')
  console.log('============================')
  console.log(`Connecting to sandbox: iqpici7sz3zdi0hzx2umm`)
  console.log('')
  
  try {
    // Connect to the existing sandbox
    console.log('1️⃣  Connecting to sandbox...')
    const sandbox = await Sandbox.connect('iqpici7sz3zdi0hzx2umm')
    console.log(`✅ Connected to sandbox: ${sandbox.sandboxId}`)
    
    // Check running processes
    console.log('\n2️⃣  Checking all running processes...')
    const processCheck = await sandbox.commands.run('ps aux | grep -E "(node|npm)" | grep -v grep')
    console.log('Running Node processes:')
    console.log(processCheck.stdout || 'No Node processes found')
    
    // Check listening ports
    console.log('\n3️⃣  Checking all listening ports...')
    const portCheck = await sandbox.commands.run('netstat -tlnp | grep -E ":3000|:4000|:8080"')
    console.log('Listening ports:')
    console.log(portCheck.stdout || 'No services listening on target ports')
    
    // Check startup logs
    console.log('\n4️⃣  Checking startup logs...')
    const startupLogCheck = await sandbox.commands.run('ls -la /code/*.log /code/logs/*.log 2>/dev/null || echo "No log files found"')
    console.log('Available log files:')
    console.log(startupLogCheck.stdout)
    
    // Check specific startup logs
    const startupTriggerLog = await sandbox.commands.run('cat /code/startup-trigger.log 2>/dev/null || echo "No startup-trigger.log"')
    console.log('\nStartup Trigger Log:')
    console.log(startupTriggerLog.stdout)
    
    const nextjsLog = await sandbox.commands.run('tail -20 /code/logs/nextjs.log 2>/dev/null || echo "No nextjs.log"')
    console.log('\nNext.js Log (last 20 lines):')
    console.log(nextjsLog.stdout)
    
    // Check baseline project directory
    console.log('\n5️⃣  Checking baseline project directory...')
    const baselineCheck = await sandbox.commands.run('ls -la /code/baseline-project/')
    console.log('Baseline project contents:')
    console.log(baselineCheck.stdout)
    
    // Check if package.json exists and its content
    const packageJsonCheck = await sandbox.commands.run('cat /code/baseline-project/package.json 2>/dev/null || echo "No package.json found"')
    console.log('\nBaseline project package.json:')
    console.log(packageJsonCheck.stdout.split('\n').slice(0, 15).join('\n'))
    
    // Try to manually start the Next.js service
    console.log('\n6️⃣  Attempting to manually start Next.js service...')
    const manualStart = await sandbox.commands.run('cd /code/baseline-project && npm run dev > /tmp/manual-nextjs.log 2>&1 &')
    console.log(`Manual start command exit code: ${manualStart.exitCode}`)
    
    // Wait a moment and check again
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    const manualLog = await sandbox.commands.run('tail -10 /tmp/manual-nextjs.log 2>/dev/null || echo "No manual log"')
    console.log('Manual start log:')
    console.log(manualLog.stdout)
    
    // Final port check
    const finalPortCheck = await sandbox.commands.run('netstat -tlnp | grep -E ":4000"')
    console.log('\nFinal port 4000 check:')
    console.log(finalPortCheck.stdout || 'Port 4000 still not listening')
    
    console.log(`\n🌐 Test URLs:`)
    console.log(`- Builder (port 3000): https://3000-${sandbox.sandboxId}.e2b.app`)
    console.log(`- App (port 4000): https://4000-${sandbox.sandboxId}.e2b.app`)
    console.log(`- API (port 8080): https://8080-${sandbox.sandboxId}.e2b.app/health`)
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message)
    console.error('Full error:', error)
  }
}

debugPort4000().catch(console.error)