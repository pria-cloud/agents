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

async function debugPortSimple() {
  loadEnvLocal()
  
  console.log('🔍 Simple Port Debug')
  console.log('===================')
  
  try {
    const sandbox = await Sandbox.connect('iqpici7sz3zdi0hzx2umm')
    console.log(`✅ Connected to sandbox: ${sandbox.sandboxId}`)
    
    // Check the package.json in baseline project
    console.log('\n📦 Checking baseline project package.json...')
    const packageJson = await sandbox.commands.run('cat /code/baseline-project/package.json')
    console.log('Package.json dev script:')
    const lines = packageJson.stdout.split('\n')
    const devLine = lines.find(line => line.includes('"dev"'))
    console.log(devLine || 'Dev script not found')
    
    // Check environment variables in startup script
    console.log('\n🔧 Checking NEXT_PORT environment variable...')
    const envCheck = await sandbox.commands.run('echo "NEXT_PORT: $NEXT_PORT"')
    console.log(envCheck.stdout)
    
    // Check what ports are actually being used
    console.log('\n🔍 Finding listening ports (using ss instead of netstat)...')
    const portCheck = await sandbox.commands.run('ss -tlnp | grep -E ":3000|:4000|:8080" || echo "No ports found"')
    console.log('Listening ports:')
    console.log(portCheck.stdout)
    
    // Check running processes with port info
    console.log('\n⚡ Checking Next.js process details...')
    const nextProcess = await sandbox.commands.run('ps aux | grep "next dev" | grep -v grep')
    console.log('Next.js process:')
    console.log(nextProcess.stdout)
    
    // Try to manually check if we can fix the port
    console.log('\n🔧 Attempting to kill current Next.js and restart on port 4000...')
    await sandbox.commands.run('pkill -f "next dev"')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const restartResult = await sandbox.commands.run('cd /code/baseline-project && NEXT_PORT=4000 npm run dev > /tmp/port4000.log 2>&1 &')
    console.log(`Restart command exit code: ${restartResult.exitCode}`)
    
    // Wait and check
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    const port4000Check = await sandbox.commands.run('ss -tlnp | grep ":4000" || echo "Port 4000 not found"')
    console.log('\nPort 4000 status:')
    console.log(port4000Check.stdout)
    
    const restartLog = await sandbox.commands.run('tail -10 /tmp/port4000.log 2>/dev/null || echo "No restart log"')
    console.log('\nRestart log:')
    console.log(restartLog.stdout)
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message)
  }
}

debugPortSimple().catch(console.error)