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

async function debugE2BObject() {
  loadEnvLocal()
  
  console.log('🔍 Debugging E2B SDK Object Structure')
  console.log('====================================')
  
  try {
    console.log('1️⃣  Checking Sandbox class...')
    console.log('Sandbox constructor:', typeof Sandbox)
    console.log('Sandbox properties:', Object.getOwnPropertyNames(Sandbox))
    console.log('Sandbox prototype:', Object.getOwnPropertyNames(Sandbox.prototype))
    
    console.log('\n2️⃣  Testing Sandbox.create()...')
    
    const sandbox = await Sandbox.create(process.env.E2B_TEMPLATE_ID)
    
    console.log('Sandbox created:', !!sandbox)
    console.log('Sandbox type:', typeof sandbox)
    console.log('Sandbox constructor name:', sandbox?.constructor?.name)
    
    if (sandbox) {
      console.log('\n3️⃣  Inspecting sandbox object...')
      console.log('Sandbox properties:', Object.getOwnPropertyNames(sandbox))
      console.log('Sandbox prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(sandbox)))
      
      // Check for common properties
      console.log('\n4️⃣  Checking common properties...')
      console.log('sandbox.id:', sandbox.id)
      console.log('sandbox.url:', sandbox.url)
      console.log('sandbox.status:', sandbox.status)
      console.log('sandbox.templateId:', sandbox.templateId)
      
      // Check for methods
      console.log('\n5️⃣  Checking available methods...')
      console.log('sandbox.commands:', typeof sandbox.commands)
      console.log('sandbox.filesystem:', typeof sandbox.filesystem)
      console.log('sandbox.files:', typeof sandbox.files)
      console.log('sandbox.process:', typeof sandbox.process)
      console.log('sandbox.terminal:', typeof sandbox.terminal)
      console.log('sandbox.exec:', typeof sandbox.exec)
      console.log('sandbox.run:', typeof sandbox.run)
      
      if (sandbox.commands) {
        console.log('sandbox.commands properties:', Object.getOwnPropertyNames(sandbox.commands))
        console.log('sandbox.commands.exec:', typeof sandbox.commands.exec)
        console.log('sandbox.commands.start:', typeof sandbox.commands.start)
        console.log('sandbox.commands.run:', typeof sandbox.commands.run)
      }
      
      // Try different execution methods
      console.log('\n6️⃣  Testing execution methods...')
      
      if (typeof sandbox.exec === 'function') {
        console.log('Trying sandbox.exec...')
        try {
          const result = await sandbox.exec('echo "test exec"')
          console.log('exec result:', result)
        } catch (execError) {
          console.log('exec error:', execError.message)
        }
      }
      
      if (sandbox.commands && typeof sandbox.commands.exec === 'function') {
        console.log('Trying sandbox.commands.exec...')
        try {
          const result = await sandbox.commands.exec('echo "test commands.exec"')
          console.log('commands.exec result:', result)
        } catch (commandsError) {
          console.log('commands.exec error:', commandsError.message)
        }
      }
      
      // Try to clean up
      try {
        if (typeof sandbox.kill === 'function') {
          await sandbox.kill()
          console.log('✅ Sandbox killed successfully')
        } else if (typeof sandbox.close === 'function') {
          await sandbox.close()
          console.log('✅ Sandbox closed successfully')
        }
      } catch (cleanupError) {
        console.log('Cleanup error:', cleanupError.message)
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message)
    console.error('Full error:', error)
  }
}

debugE2BObject().catch(console.error)