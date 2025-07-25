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

async function testNewSDK() {
  loadEnvLocal()
  
  console.log('🧪 Testing E2B SDK v1.9.0')
  console.log('==========================')
  console.log(`API Key: ${process.env.E2B_API_KEY?.substring(0, 10)}...`)
  console.log(`Template ID: ${process.env.E2B_TEMPLATE_ID}`)
  console.log('')
  
  try {
    // Test 1: Create a new sandbox with the new SDK
    console.log('1️⃣  Testing sandbox creation with new SDK...')
    const startTime = Date.now()
    
    const sandbox = await Sandbox.create(process.env.E2B_TEMPLATE_ID)
    
    const creationTime = Math.round((Date.now() - startTime) / 1000)
    console.log(`✅ Sandbox created in ${creationTime}s: ${sandbox.sandboxId}`)
    console.log(`🌐 URL: https://3000-${sandbox.sandboxId}.e2b.app`)
    
    // Test 2: Execute a simple command
    console.log('\n2️⃣  Testing command execution...')
    
    const result = await sandbox.commands.run('echo "Hello from new E2B SDK v1.9.0!"')
    
    console.log('✅ Command executed successfully')
    console.log(`Exit code: ${result.exitCode}`)
    console.log(`Output: ${result.stdout}`)
    
    // Test 3: Test filesystem operations
    console.log('\n3️⃣  Testing filesystem operations...')
    
    const testData = {
      message: 'Hello from new SDK',
      version: '1.9.0',
      timestamp: new Date().toISOString(),
      sandbox_id: sandbox.sandboxId
    }
    
    await sandbox.files.write('/tmp/sdk_test.json', JSON.stringify(testData, null, 2))
    console.log('✅ File written successfully')
    
    const fileContent = await sandbox.files.read('/tmp/sdk_test.json')
    const parsed = JSON.parse(fileContent)
    console.log('✅ File read successfully:', parsed.message)
    
    // Test 4: Check our template structure
    console.log('\n4️⃣  Testing template structure...')
    
    try {
      const codeFiles = await sandbox.files.list('/code')
      console.log('✅ /code directory accessible')
      console.log('Contents:', codeFiles.slice(0, 5).map(f => f.name))
      
      // Check if our startup script exists
      const hasScripts = codeFiles.some(f => f.name === 'scripts')
      const hasBaseline = codeFiles.some(f => f.name === 'baseline-project')
      
      console.log(`Scripts directory: ${hasScripts ? '✅ Found' : '❌ Missing'}`)
      console.log(`Baseline project: ${hasBaseline ? '✅ Found' : '❌ Missing'}`)
      
      if (hasScripts) {
        // Check if the start script exists and is executable
        const startScriptCheck = await sandbox.commands.run('ls -la /code/scripts/start-services.sh')
        
        if (startScriptCheck.exitCode === 0) {
          console.log('✅ Start script found')
          console.log('Start script details:', startScriptCheck.stdout)
        } else {
          console.log('❌ Start script not found')
        }
      }
      
    } catch (codeError) {
      console.log('❌ Template structure check failed:', codeError.message)
    }
    
    // Test 5: Try to start the services
    console.log('\n5️⃣  Testing service startup...')
    
    try {
      // Make the script executable and run it
      const chmodResult = await sandbox.commands.run('chmod +x /code/scripts/start-services.sh')
      
      if (chmodResult.exitCode === 0) {
        console.log('✅ Start script made executable')
        
        // Run the startup script in background
        console.log('🚀 Starting services...')
        const startServices = await sandbox.commands.run('cd /code && nohup ./scripts/start-services.sh > /tmp/services.log 2>&1 &')
        
        console.log('⏳ Waiting 30 seconds for services to start...')
        await new Promise(resolve => setTimeout(resolve, 30000))
        
        // Check if services are running
        const processCheck = await sandbox.commands.run('ps aux | grep -E "(node|npm)" | grep -v grep')
        
        console.log('Running processes:')
        console.log(processCheck.stdout || 'No Node.js processes found')
        
        // Check service logs
        const logCheck = await sandbox.commands.run('cat /tmp/services.log')
        
        console.log('\nService startup logs:')
        console.log(logCheck.stdout || 'No logs found')
        
      } else {
        console.log('❌ Failed to make start script executable')
      }
      
    } catch (serviceError) {
      console.log('❌ Service startup test failed:', serviceError.message)
    }
    
    console.log(`\n🎉 New SDK test completed! Sandbox URL: https://3000-${sandbox.sandboxId}.e2b.app`)
    console.log('⏰ Keeping sandbox alive for 2 minutes for manual testing...')
    
    // Keep alive for manual testing
    await new Promise(resolve => setTimeout(resolve, 120000))
    
    await sandbox.kill()
    console.log('✅ Sandbox closed')
    
  } catch (error) {
    console.error('❌ New SDK test failed:', error.message)
    console.error('Error details:', error)
  }
}

testNewSDK().catch(console.error)