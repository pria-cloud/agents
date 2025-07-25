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

async function testSandboxServices() {
  loadEnvLocal()
  
  console.log('🧪 Testing Sandbox Services from App')
  console.log('===================================')
  console.log(`Using the same sandbox from your app: ii4n6r85ou8ajom0z1kp5`)
  console.log('')
  
  try {
    // Try to connect to the existing sandbox
    console.log('1️⃣  Connecting to existing sandbox...')
    const sandbox = await Sandbox.connect('ii4n6r85ou8ajom0z1kp5')
    console.log(`✅ Connected to sandbox: ${sandbox.sandboxId}`)
    
    // Check if services are running
    console.log('\n2️⃣  Checking running processes...')
    const processCheck = await sandbox.commands.run('ps aux | grep -E "(node|npm)" | grep -v grep')
    console.log('Running Node processes:')
    console.log(processCheck.stdout || 'No Node processes found')
    
    // Check if ports are listening
    console.log('\n3️⃣  Checking listening ports...')
    const portCheck = await sandbox.commands.run('netstat -tlnp | grep -E ":8080|:3000" || echo "No services listening"')
    console.log('Listening ports:')
    console.log(portCheck.stdout)
    
    // Try direct health check
    console.log('\n4️⃣  Testing API service directly...')
    const apiTest = await sandbox.commands.run('curl -s http://localhost:8080/health || echo "API not responding"')
    console.log('API Service Response:')
    console.log(apiTest.stdout)
    console.log('Exit code:', apiTest.exitCode)
    
    // Try Next.js service
    console.log('\n5️⃣  Testing Next.js service...')
    const nextTest = await sandbox.commands.run('curl -s http://localhost:3000 | head -5 || echo "Next.js not responding"')
    console.log('Next.js Service Response (first 5 lines):')
    console.log(nextTest.stdout)
    
    // Check service logs
    console.log('\n6️⃣  Checking service logs...')
    const apiLogCheck = await sandbox.commands.run('tail -10 /code/logs/api-service.log 2>/dev/null || echo "No API log"')
    console.log('API Service Log (last 10 lines):')
    console.log(apiLogCheck.stdout)
    
    console.log(`\n🌐 Visit your app at: https://3000-${sandbox.sandboxId}.e2b.app`)
    console.log(`🔧 API service should be at: https://8080-${sandbox.sandboxId}.e2b.app`)
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Full error:', error)
  }
}

testSandboxServices().catch(console.error)