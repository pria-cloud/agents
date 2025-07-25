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

async function testBasicE2B() {
  loadEnvLocal()
  
  console.log('🧪 Basic E2B Test')
  console.log('==================')
  console.log(`API Key: ${process.env.E2B_API_KEY?.substring(0, 10)}...`)
  console.log(`Template ID: ${process.env.E2B_TEMPLATE_ID}`)
  console.log('')
  
  let baseStartTime = Date.now()
  try {
    // Try with the simplest template first
    console.log('1️⃣  Testing with base template...')
    baseStartTime = Date.now()
    
    const baseSandbox = await Sandbox.create({
      template: 'base', // Simple Ubuntu template
      timeoutMs: 30000  // 30 seconds
    })
    
    const baseTime = Math.round((Date.now() - baseStartTime) / 1000)
    console.log(`✅ Base sandbox created in ${baseTime}s: ${baseSandbox.id}`)
    
    // Test if we can execute a simple command via any method
    console.log('Testing command execution...')
    
    // Try to find any working method
    console.log('Available methods:', Object.keys(baseSandbox))
    
    if (baseSandbox.process) {
      console.log('Process methods:', Object.keys(baseSandbox.process))
      
      try {
        const result = await baseSandbox.process.startAndWait({
          cmd: ['echo', 'test']
        })
        console.log('✅ Command executed via process.startAndWait:', result)
      } catch (processError) {
        console.log('❌ process.startAndWait failed:', processError.message)
      }
    }
    
    if (baseSandbox.filesystem) {
      console.log('Filesystem methods:', Object.keys(baseSandbox.filesystem))
      
      try {
        await baseSandbox.filesystem.write('/tmp/test.txt', 'Hello E2B')
        const content = await baseSandbox.filesystem.read('/tmp/test.txt')
        console.log('✅ Filesystem test successful:', content)
      } catch (fsError) {
        console.log('❌ Filesystem test failed:', fsError.message)
      }
    }
    
    await baseSandbox.close()
    console.log('✅ Base sandbox closed')
    
  } catch (baseError) {
    const errorTime = Math.round((Date.now() - (baseStartTime || Date.now())) / 1000)
    console.log(`❌ Base template failed after ${errorTime}s:`, baseError.message)
  }
  
  console.log('')
  
  let customStartTime = Date.now()
  try {
    // Now try our custom template
    console.log('2️⃣  Testing with our custom template...')
    customStartTime = Date.now()
    
    const customSandbox = await Sandbox.create({
      template: process.env.E2B_TEMPLATE_ID,
      timeoutMs: 30000  // 30 seconds
    })
    
    const customTime = Math.round((Date.now() - customStartTime) / 1000)
    console.log(`✅ Custom sandbox created in ${customTime}s: ${customSandbox.id}`)
    console.log(`🌐 URL: https://3000-${customSandbox.id}.e2b.app`)
    
    // Keep it alive for manual testing
    console.log('⏰ Keeping sandbox alive for 60 seconds for manual testing...')
    await new Promise(resolve => setTimeout(resolve, 60000))
    
    await customSandbox.close()
    console.log('✅ Custom sandbox closed')
    
  } catch (customError) {
    const errorTime = Math.round((Date.now() - (customStartTime || Date.now())) / 1000)
    console.log(`❌ Custom template failed after ${errorTime}s:`, customError.message)
    
    if (customError.message.includes('timeout') || customError.message.includes('60000')) {
      console.log('')
      console.log('💡 Template timeout troubleshooting:')
      console.log('   - Your template might be too heavy/complex')
      console.log('   - Try simplifying the template startup script')
      console.log('   - Check E2B dashboard for build logs')
      console.log('   - Consider using a lighter base image')
    }
  }
  
  console.log('')
  console.log('🏁 Basic E2B test completed')
}

testBasicE2B().catch(console.error)