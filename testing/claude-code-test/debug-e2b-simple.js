const { Sandbox } = require('@e2b/sdk')
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

async function quickTest() {
  loadEnvLocal()
  
  console.log('🧪 Quick E2B Test')
  console.log('API Key present:', !!process.env.E2B_API_KEY)
  console.log('Template ID:', process.env.E2B_TEMPLATE_ID)
  
  try {
    console.log('⏰ Creating sandbox with 2 minute timeout...')
    const startTime = Date.now()
    
    const sandbox = await Sandbox.create({
      template: process.env.E2B_TEMPLATE_ID,
      timeoutMs: 120000 // 2 minutes
    })
    
    const duration = Math.round((Date.now() - startTime) / 1000)
    console.log(`✅ Sandbox created in ${duration}s:`, sandbox.id)
    
    // Test basic command
    console.log('🔧 Testing basic command...')
    const result = await sandbox.commands.run('echo "Hello from sandbox"')
    console.log('Command output:', result.stdout)
    
    // Check if services are running
    console.log('🔍 Checking for running services...')
    const processCheck = await sandbox.commands.run('ps aux | grep -v grep | grep -E "(node|npm|start-services)"')
    console.log('Node processes:', processCheck.stdout || 'None found')
    
    // Check if start script exists
    const scriptCheck = await sandbox.commands.run('ls -la /code/scripts/start-services.sh')
    console.log('Start script:', scriptCheck.stdout || 'Not found')
    
    // Try to manually start services
    console.log('🚀 Attempting to start services manually...')
    const startResult = await sandbox.commands.run('cd /code && chmod +x scripts/start-services.sh && ./scripts/start-services.sh &')
    console.log('Start command result:', startResult.stdout || startResult.stderr)
    
    // Wait and check services
    console.log('⏳ Waiting 30 seconds for services to start...')
    await new Promise(resolve => setTimeout(resolve, 30000))
    
    const serviceCheck = await sandbox.commands.run('curl -s http://localhost:3000 || echo "Port 3000 not responding"')
    console.log('Port 3000 check:', serviceCheck.stdout)
    
    const apiCheck = await sandbox.commands.run('curl -s http://localhost:8080/health || echo "Port 8080 not responding"')
    console.log('Port 8080 check:', apiCheck.stdout)
    
    console.log(`🌐 Sandbox URL: https://3000-${sandbox.id}.e2b.app`)
    
    // Keep alive for a bit
    console.log('✋ Keeping sandbox alive for 60 seconds for manual testing...')
    await new Promise(resolve => setTimeout(resolve, 60000))
    
    await sandbox.close()
    console.log('🏁 Test complete')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    
    if (error.message.includes('timeout')) {
      console.log('💡 Template is taking too long to start. This could be because:')
      console.log('   - Template has heavy dependencies to install')
      console.log('   - Template build process is slow')
      console.log('   - E2B service is experiencing delays')
    }
  }
}

quickTest().catch(console.error)