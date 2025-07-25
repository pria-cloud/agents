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

async function testE2BConnection() {
  loadEnvLocal()
  console.log('🧪 Testing E2B Connection...')
  console.log('API Key present:', !!process.env.E2B_API_KEY)
  console.log('Template ID:', process.env.E2B_TEMPLATE_ID)
  
  try {
    // Test 1: Try different basic templates
    const basicTemplates = ['base', 'nodejs', 'python']
    
    for (const template of basicTemplates) {
      try {
        console.log(`\n📦 Test 1.${basicTemplates.indexOf(template) + 1}: Creating ${template} sandbox...`)
        const sandbox = await Sandbox.create({
          template: template,
          timeoutMs: 15000 // 15 seconds
        })
        console.log(`✅ ${template} sandbox created:`, sandbox.id)
        await sandbox.close()
        console.log(`✅ ${template} sandbox closed`)
        break // If one works, we don't need to test others
      } catch (error) {
        console.log(`❌ ${template} sandbox failed:`, error.message)
      }
    }
    
  } catch (error) {
    console.log('❌ All basic templates failed:', error.message)
  }

  try {
    // Test 2: Try your custom template
    console.log('\n📦 Test 2: Creating custom template sandbox...')
    console.log('⏱️  Attempting with 90 second timeout...')
    const customSandbox = await Sandbox.create({
      template: process.env.E2B_TEMPLATE_ID,
      timeoutMs: 90000 // 90 seconds - some templates take longer
    })
    console.log('✅ Custom template sandbox created:', customSandbox.id)
    
    // Test basic connectivity
    const response = await customSandbox.commands.run('echo "Hello from sandbox"')
    console.log('✅ Command response:', response.stdout)
    
    await customSandbox.close()
    console.log('✅ Custom sandbox closed')
    
  } catch (error) {
    console.log('❌ Custom template failed:', error.message)
    
    if (error.message.includes('template not found') || error.message.includes('404')) {
      console.log('🔍 Template might not exist or not be accessible')
    } else if (error.message.includes('timeout')) {
      console.log('🔍 Template exists but is taking too long to start')
    }
  }

  try {
    // Test 3: List available templates
    console.log('\n📋 Test 3: Checking available templates...')
    // Note: E2B SDK might not have a direct template list method
    // This is more for educational purposes
    console.log('ℹ️  Check https://e2b.dev/docs/templates for available templates')
    
  } catch (error) {
    console.log('❌ Template listing failed:', error.message)
  }

  console.log('\n🏁 E2B Connection Test Complete')
}

// Run the test
testE2BConnection().catch(console.error)