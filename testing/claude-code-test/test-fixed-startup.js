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

async function testFixedStartup() {
  loadEnvLocal()
  
  console.log('🧪 Testing Fixed Startup Script')
  console.log('==============================')
  
  // Use the template ID from the new build 
  const templateId = '33mz2agmad58ip0izxbc' // Updated template with fixed startup script
  console.log(`Template ID: ${templateId}`)
  console.log('')
  
  try {
    console.log('1️⃣  Creating fresh sandbox...')
    const sandbox = await Sandbox.create(templateId)
    console.log(`✅ Sandbox created: ${sandbox.sandboxId}`)
    console.log(`🌐 URL: https://3000-${sandbox.sandboxId}.e2b.app`)
    
    // Wait for initialization
    console.log('\n2️⃣  Waiting for sandbox initialization...')
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // Run the startup script directly 
    console.log('\n3️⃣  Testing startup script execution...')
    const startupResult = await sandbox.commands.run('/code/scripts/start-services.sh', { timeout: 60000 })
    console.log(`Startup script exit code: ${startupResult.exitCode}`)
    console.log('Startup stdout:')
    console.log(startupResult.stdout)
    if (startupResult.stderr) {
      console.log('Startup stderr:')
      console.log(startupResult.stderr)
    }
    
    // If the script is running in background, check service status
    if (startupResult.exitCode === 0 || startupResult.stdout.includes('Services are now running')) {
      console.log('\n4️⃣  Checking service health...')
      
      // Wait a moment for services to fully start
      await new Promise(resolve => setTimeout(resolve, 15000))
      
      // Check API service
      const apiHealthCheck = await sandbox.commands.run('curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health || echo "failed"')
      console.log(`API Health Check: ${apiHealthCheck.stdout}`)
      
      // Check Next.js service
      const nextHealthCheck = await sandbox.commands.run('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "failed"')
      console.log(`Next.js Health Check: ${nextHealthCheck.stdout}`)
      
      // Check running processes
      const processCheck = await sandbox.commands.run('ps aux | grep -E "(node|npm)" | grep -v grep')
      console.log('\nRunning Node processes:')
      console.log(processCheck.stdout || 'No Node processes found')
      
      // Check logs
      console.log('\n5️⃣  Checking service logs...')
      const apiLogCheck = await sandbox.commands.run('tail -20 /code/logs/api-service.log 2>/dev/null || echo "No API log"')
      console.log('API Service Log (last 20 lines):')
      console.log(apiLogCheck.stdout)
      
      const nextLogCheck = await sandbox.commands.run('tail -20 /code/logs/nextjs.log 2>/dev/null || echo "No Next.js log"')
      console.log('\nNext.js Log (last 20 lines):')
      console.log(nextLogCheck.stdout)
    }
    
    console.log(`\n🎯 Test complete! Sandbox available at: https://3000-${sandbox.sandboxId}.e2b.app`)
    console.log('⏰ Keeping sandbox alive for 3 minutes for manual inspection...')
    
    // Keep alive for manual testing
    await new Promise(resolve => setTimeout(resolve, 180000))
    
    await sandbox.kill()
    console.log('✅ Sandbox closed')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Full error:', error)
  }
}

testFixedStartup().catch(console.error)