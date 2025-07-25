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

async function testBackgroundStartup() {
  loadEnvLocal()
  
  console.log('🧪 Testing Background Startup Script')
  console.log('===================================')
  
  // Use the updated template ID
  const templateId = '33mz2agmad58ip0izxbc'
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
    
    // Start the startup script in the background 
    console.log('\n3️⃣  Starting services in background...')
    sandbox.commands.run('nohup /code/scripts/start-services.sh > /code/startup-log.txt 2>&1 &')
    
    // Give it time to start
    console.log('⏳ Waiting 30 seconds for services to start...')
    await new Promise(resolve => setTimeout(resolve, 30000))
    
    // Check if processes are running
    console.log('\n4️⃣  Checking running processes...')
    const processCheck = await sandbox.commands.run('ps aux | grep -E "(node|npm)" | grep -v grep')
    console.log('Running Node processes:')
    console.log(processCheck.stdout || 'No Node processes found')
    
    // Check if ports are listening
    console.log('\n5️⃣  Checking listening ports...')
    const portCheck = await sandbox.commands.run('netstat -tlnp | grep -E ":8080|:3000" || echo "No services listening"')
    console.log('Listening ports:')
    console.log(portCheck.stdout)
    
    // Check service health
    console.log('\n6️⃣  Testing service endpoints...')
    
    // API service health check
    const apiHealthCheck = await sandbox.commands.run('curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health || echo "000"')
    console.log(`API Health Check: HTTP ${apiHealthCheck.stdout}`)
    
    // Next.js health check  
    const nextHealthCheck = await sandbox.commands.run('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000"')
    console.log(`Next.js Health Check: HTTP ${nextHealthCheck.stdout}`)
    
    // Check startup logs
    console.log('\n7️⃣  Checking startup logs...')
    const startupLogCheck = await sandbox.commands.run('cat /code/startup-log.txt 2>/dev/null || echo "No startup log found"')
    console.log('Startup log:')
    console.log(startupLogCheck.stdout)
    
    // Check individual service logs
    console.log('\n8️⃣  Checking service logs...')
    const apiLogCheck = await sandbox.commands.run('tail -10 /code/logs/api-service.log 2>/dev/null || echo "No API log"')
    console.log('API Service Log (last 10 lines):')
    console.log(apiLogCheck.stdout)
    
    const nextLogCheck = await sandbox.commands.run('tail -10 /code/logs/nextjs.log 2>/dev/null || echo "No Next.js log"')
    console.log('\nNext.js Log (last 10 lines):')
    console.log(nextLogCheck.stdout)
    
    // Try to get actual content from the services
    console.log('\n9️⃣  Testing service responses...')
    
    // Get API service info
    const apiInfoCheck = await sandbox.commands.run('curl -s http://localhost:8080/health 2>/dev/null || echo "API not responding"')
    console.log('API Service Response:')
    console.log(apiInfoCheck.stdout)
    
    // Get Next.js homepage
    const nextContentCheck = await sandbox.commands.run('curl -s http://localhost:3000 2>/dev/null | head -10 || echo "Next.js not responding"')
    console.log('\nNext.js Homepage Response (first 10 lines):')
    console.log(nextContentCheck.stdout)
    
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

testBackgroundStartup().catch(console.error)