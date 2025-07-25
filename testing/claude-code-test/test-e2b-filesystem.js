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

async function testFilesystemConnection() {
  loadEnvLocal()
  
  console.log('🧪 E2B Filesystem Connection Test')
  console.log('=' .repeat(50))
  console.log(`Manual Sandbox ID: ${process.env.E2B_MANUAL_SANDBOX_ID}`)
  console.log(`API Key present: ${!!process.env.E2B_API_KEY}`)
  console.log('=' .repeat(50))
  
  try {
    console.log('🔌 Connecting to existing sandbox...')
    const sandbox = new Sandbox({ 
      id: process.env.E2B_MANUAL_SANDBOX_ID,
      apiKey: process.env.E2B_API_KEY 
    })
    
    console.log('✅ Sandbox instance created')
    
    // Test filesystem write/read
    console.log('📝 Testing filesystem write...')
    const testData = {
      message: 'Hello from Claude Code test',
      timestamp: new Date().toISOString(),
      test: true
    }
    
    await sandbox.filesystem.write('/tmp/claude_test.json', JSON.stringify(testData, null, 2))
    console.log('✅ File written successfully')
    
    console.log('📖 Testing filesystem read...')
    const readData = await sandbox.filesystem.read('/tmp/claude_test.json')
    const parsedData = JSON.parse(readData)
    
    console.log('✅ File read successfully:')
    console.log(parsedData)
    
    // Test directory listing
    console.log('📁 Testing directory listing...')
    const files = await sandbox.filesystem.list('/tmp')
    console.log('Files in /tmp:', files.map(f => f.name))
    
    // Test if we can see our test file
    const ourFile = files.find(f => f.name === 'claude_test.json')
    if (ourFile) {
      console.log('✅ Our test file found:', ourFile)
    }
    
    // Test writing a message like the E2B service would
    console.log('📨 Testing message communication pattern...')
    const messagePayload = {
      message: 'Create a simple React component for a todo list',
      context: {
        session_id: 'test-session-123',
        user_id: 'test-user'
      },
      timestamp: new Date().toISOString()
    }
    
    await sandbox.filesystem.write('/tmp/user_message.json', JSON.stringify(messagePayload))
    console.log('✅ Message payload written to sandbox')
    
    // Read it back to verify
    const messageContent = await sandbox.filesystem.read('/tmp/user_message.json')
    const parsedMessage = JSON.parse(messageContent)
    console.log('✅ Message verified:', parsedMessage.message)
    
    // Test if we can access the /code directory (where our template should be)
    console.log('🏗️  Testing access to /code directory...')
    try {
      const codeFiles = await sandbox.filesystem.list('/code')
      console.log('✅ /code directory accessible:')
      console.log(codeFiles.slice(0, 10).map(f => `${f.type}: ${f.name}`)) // Show first 10 items
    } catch (codeError) {
      console.log('⚠️  /code directory not accessible:', codeError.message)
    }
    
    console.log('\n' + '=' .repeat(50))
    console.log('✅ Filesystem test completed successfully!')
    console.log(`🌐 Sandbox URL: https://3000-${sandbox.id}.e2b.app`)
    console.log('=' .repeat(50))
    
  } catch (error) {
    console.error('❌ Filesystem test failed:', error.message)
    console.error('Error details:', error)
  }
}

testFilesystemConnection().catch(console.error)