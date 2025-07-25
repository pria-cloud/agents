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

async function testOfficialSDKApproach() {
  loadEnvLocal()
  
  console.log('🧪 E2B Official SDK Test (Following v1.9.0 Docs)')
  console.log('=' .repeat(60))
  console.log(`Template ID: ${process.env.E2B_TEMPLATE_ID}`)
  console.log(`API Key present: ${!!process.env.E2B_API_KEY}`)
  console.log('=' .repeat(60))
  
  // Test 1: Try connecting to existing manual sandbox
  if (process.env.E2B_MANUAL_SANDBOX_ID) {
    console.log('\n📦 Test 1: Connecting to existing sandbox')
    console.log(`Sandbox ID: ${process.env.E2B_MANUAL_SANDBOX_ID}`)
    
    try {
      // Using official constructor approach
      const existingSandbox = new Sandbox({ 
        id: process.env.E2B_MANUAL_SANDBOX_ID 
      })
      
      console.log('✅ Sandbox instance created')
      
      // Test connection
      console.log('Available methods on sandbox:', Object.getOwnPropertyNames(existingSandbox))
      console.log('Sandbox prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(existingSandbox)))
      
      // Let's explore the sandbox structure more thoroughly
      console.log('🔍 Deep inspection of sandbox structure...')
      console.log('Available on terminal:', existingSandbox.terminal ? Object.keys(existingSandbox.terminal) : 'No terminal property')
      console.log('Available on filesystem:', existingSandbox.filesystem ? Object.keys(existingSandbox.filesystem) : 'No filesystem property')
      
      // Try terminal.run which is more likely to exist
      if (existingSandbox.terminal && typeof existingSandbox.terminal.run === 'function') {
        console.log('✅ Using sandbox.terminal.run()')
        testResult = await existingSandbox.terminal.run('echo "Hello from existing sandbox"')
      }
      // Or check if it's available via _actions
      else if (existingSandbox._actions && existingSandbox._actions.terminal) {
        console.log('✅ Using sandbox._actions.terminal approach')
        // This would require more complex setup
        console.log('Terminal actions available:', Object.keys(existingSandbox._actions.terminal))
        return // Skip for now
      }
      else {
        console.log('❌ Could not find command execution method')
        console.log('Let me try creating a terminal session first...')
        
        try {
          // Try using the process.startAndWait method with proper syntax
          console.log('🔄 Trying process.startAndWait with correct parameters...')
          console.log('Process methods:', Object.keys(existingSandbox.process))
          
          // Try the process API
          const processResult = await existingSandbox.process.startAndWait({
            cmd: ['echo', 'Hello from process API']
          })
          
          console.log('✅ Process command executed:', processResult)
          testResult = { 
            exitCode: processResult.exitCode, 
            stdout: processResult.stdout,
            stderr: processResult.stderr
          }
        } catch (processError) {
          console.log('❌ Process execution failed:', processError.message)
          
          // Last resort - try to find any working method
          console.log('🔍 Trying file system approach to test connectivity...')
          try {
            await existingSandbox.filesystem.write('/tmp/test.txt', 'Hello E2B')
            const content = await existingSandbox.filesystem.read('/tmp/test.txt')
            console.log('✅ File system test successful:', content)
            testResult = { exitCode: 0, stdout: 'File system test passed: ' + content }
          } catch (fsError) {
            console.log('❌ File system test also failed:', fsError.message)
            return
          }
        }
      }
      
      console.log(`Connection test - Exit code: ${testResult.exitCode}`)  
      console.log(`Connection test - Output: ${testResult.stdout}`)
      
      if (testResult.exitCode === 0) {
        console.log('✅ Successfully connected to existing sandbox!')
        
        // Test Claude Code SDK API
        console.log('\n🔧 Testing Claude Code SDK API...')
        const apiTest = await existingSandbox.process.commands.run('curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health')
        console.log(`API health check response: ${apiTest.stdout}`)
        
        const nextTest = await existingSandbox.process.commands.run('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000')
        console.log(`Next.js health check response: ${nextTest.stdout}`)
        
        // Test actual Claude API call
        console.log('\n🤖 Testing Claude Code SDK chat endpoint...')
        const chatTest = await existingSandbox.process.commands.run(`
          curl -X POST http://localhost:8080/api/claude/chat \\
            -H "Content-Type: application/json" \\
            -d '{"message": "Hello Claude, can you help me create a simple React component?"}' \\
            -w "\\nHTTP_CODE:%{http_code}"
        `)
        
        console.log('Chat API test result:')
        console.log(chatTest.stdout)
        if (chatTest.stderr) console.log('Chat API stderr:', chatTest.stderr)
        
      } else {
        console.log('❌ Failed to connect to existing sandbox')
      }
    } catch (error) {
      console.log('❌ Existing sandbox test failed:', error.message)
    }
  }
  
  // Test 2: Try programmatic creation with different approaches
  console.log('\n📦 Test 2: Programmatic creation with official SDK approach')
  
  try {
    console.log('🚀 Creating sandbox using Sandbox.create()...')
    
    const startTime = Date.now()
    
    // Use the exact approach from the documentation
    const newSandbox = await Sandbox.create({
      template: process.env.E2B_TEMPLATE_ID,
      // Try without timeoutMs to see if that's causing issues
      metadata: {
        test: 'official-sdk-test',
        timestamp: new Date().toISOString()
      }
    })
    
    const creationTime = Math.round((Date.now() - startTime) / 1000)
    console.log(`✅ Sandbox created in ${creationTime} seconds`)
    console.log(`📦 Sandbox ID: ${newSandbox.id}`)
    
    // Test the new sandbox
    const testResult = await newSandbox.process.commands.run('echo "Hello from new sandbox"')
    console.log(`New sandbox test - Exit code: ${testResult.exitCode}`)
    console.log(`New sandbox test - Output: ${testResult.stdout}`)
    
    // Clean up
    await newSandbox.close()
    console.log('✅ New sandbox closed')
    
  } catch (error) {
    const errorTime = Math.round((Date.now() - startTime) / 1000)
    console.log(`❌ Programmatic creation failed after ${errorTime} seconds`)
    console.log(`Error: ${error.message}`)
    
    // Try with explicit timeout
    console.log('\n🔄 Retrying with explicit timeout...')
    try {
      const startTime2 = Date.now()
      const sandboxWithTimeout = await Sandbox.create({
        template: process.env.E2B_TEMPLATE_ID,
        timeoutMs: 180000, // 3 minutes
        metadata: {
          test: 'timeout-test',
          timestamp: new Date().toISOString()
        }
      })
      
      const creationTime2 = Math.round((Date.now() - startTime2) / 1000)
      console.log(`✅ Sandbox with timeout created in ${creationTime2} seconds`)
      console.log(`📦 Sandbox ID: ${sandboxWithTimeout.id}`)
      
      await sandboxWithTimeout.close()
      console.log('✅ Timeout sandbox closed')
      
    } catch (timeoutError) {
      console.log(`❌ Timeout approach also failed: ${timeoutError.message}`)
    }
  }
  
  console.log('\n' + '=' .repeat(60))
  console.log('🏁 Official SDK test completed')
  console.log('=' .repeat(60))
}

// Run the test
testOfficialSDKApproach().catch(console.error)