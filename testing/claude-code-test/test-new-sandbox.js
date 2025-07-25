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

async function testNewSandbox() {
  loadEnvLocal()
  
  console.log('🧪 Testing New Sandbox Connection')
  console.log('==================================')
  console.log(`Sandbox ID: ${process.env.E2B_MANUAL_SANDBOX_ID}`)
  console.log(`API Key: ${process.env.E2B_API_KEY?.substring(0, 10)}...`)
  console.log('')
  
  try {
    console.log('🔌 Connecting to new sandbox...')
    
    const sandbox = new Sandbox({ 
      id: process.env.E2B_MANUAL_SANDBOX_ID
    })
    
    console.log('✅ Sandbox instance created')
    console.log('Available properties:', Object.keys(sandbox))
    
    // Test if we can access the sandbox URL
    const sandboxUrl = `https://3000-${process.env.E2B_MANUAL_SANDBOX_ID}.e2b.app`
    console.log(`🌐 Sandbox URL: ${sandboxUrl}`)
    
    // Test filesystem access
    if (sandbox.filesystem) {
      console.log('\n📁 Testing filesystem access...')
      console.log('Filesystem methods:', Object.keys(sandbox.filesystem))
      
      try {
        const testData = {
          message: 'Hello from new sandbox test',
          timestamp: new Date().toISOString(),
          sandbox_id: process.env.E2B_MANUAL_SANDBOX_ID
        }
        
        console.log('📝 Writing test file...')
        await sandbox.filesystem.write('/tmp/new_sandbox_test.json', JSON.stringify(testData, null, 2))
        console.log('✅ File written successfully')
        
        console.log('📖 Reading test file...')
        const content = await sandbox.filesystem.read('/tmp/new_sandbox_test.json')
        const parsed = JSON.parse(content)
        
        console.log('✅ File read successfully:')
        console.log('  Message:', parsed.message)
        console.log('  Timestamp:', parsed.timestamp)
        console.log('  Sandbox ID:', parsed.sandbox_id)
        
        // Test directory listing
        console.log('\n📂 Testing directory operations...')
        const tmpFiles = await sandbox.filesystem.list('/tmp')
        console.log('Files in /tmp:', tmpFiles.slice(0, 5).map(f => f.name)) // Show first 5
        
        // Check if our file is there
        const ourFile = tmpFiles.find(f => f.name === 'new_sandbox_test.json')
        if (ourFile) {
          console.log('✅ Our test file found in listing')
        }
        
        // Test access to /code directory (where template files should be)
        console.log('\n🏗️  Testing template directory access...')
        try {
          const codeFiles = await sandbox.filesystem.list('/code')
          console.log('✅ /code directory accessible')
          console.log('Contents:', codeFiles.slice(0, 8).map(f => `${f.type}:${f.name}`))
          
          // Look for our specific template files
          const scriptsDir = codeFiles.find(f => f.name === 'scripts' && f.type === 'dir')
          const baselineDir = codeFiles.find(f => f.name === 'baseline-project' && f.type === 'dir')
          
          if (scriptsDir) console.log('✅ scripts directory found')
          if (baselineDir) console.log('✅ baseline-project directory found')
          
        } catch (codeError) {
          console.log('❌ /code directory access failed:', codeError.message)
        }
        
        console.log('\n🎉 Filesystem test completed successfully!')
        console.log('✅ The new sandbox connection is working!')
        
      } catch (fsError) {
        console.log('❌ Filesystem test failed:', fsError.message)
        console.log('Error details:', fsError)
      }
    } else {
      console.log('❌ No filesystem property available')
    }
    
  } catch (error) {
    console.log('❌ Sandbox connection failed:', error.message)
    console.log('Error details:', error)
  }
}

testNewSandbox().catch(console.error)