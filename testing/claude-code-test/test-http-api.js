const fetch = require('node-fetch')
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

async function testHttpApi() {
  loadEnvLocal()
  
  console.log('🧪 Testing E2B HTTP API Direct Calls')
  console.log('====================================')
  console.log(`API Key: ${process.env.E2B_API_KEY?.substring(0, 10)}...`)
  console.log(`Template ID: ${process.env.E2B_TEMPLATE_ID}`)
  console.log('')
  
  const apiKey = process.env.E2B_API_KEY
  const templateId = process.env.E2B_TEMPLATE_ID
  
  if (!apiKey || !templateId) {
    console.log('❌ Missing API key or template ID')
    return
  }
  
  try {
    // Try to create a sandbox via HTTP API
    console.log('1️⃣  Testing sandbox creation via HTTP API...')
    
    const createResponse = await fetch('https://api.e2b.dev/sandboxes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template_id: templateId,
        metadata: {
          test: 'http-api-test',
          timestamp: new Date().toISOString()
        }
      })
    })
    
    console.log('Response status:', createResponse.status)
    const responseText = await createResponse.text()
    console.log('Response:', responseText)
    
    if (!createResponse.ok) {
      console.log('❌ HTTP API sandbox creation failed')
      
      // Try to list existing sandboxes
      console.log('\n2️⃣  Trying to list existing sandboxes...')
      
      const listResponse = await fetch('https://api.e2b.dev/sandboxes', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('List response status:', listResponse.status)
      const listText = await listResponse.text()
      console.log('List response:', listText)
      
    } else {
      console.log('✅ HTTP API seems to work!')
      const sandboxData = JSON.parse(responseText)
      console.log('Created sandbox:', sandboxData)
    }
    
  } catch (error) {
    console.log('❌ HTTP API test failed:', error.message)
  }
  
  console.log('\n3️⃣  Testing manual sandbox access...')
  const manualSandboxId = process.env.E2B_MANUAL_SANDBOX_ID
  
  if (manualSandboxId) {
    // Test direct URL access
    const sandboxUrl = `https://3000-${manualSandboxId}.e2b.app`
    const apiUrl = `https://8080-${manualSandboxId}.e2b.app`
    
    console.log(`Testing ${sandboxUrl}...`)
    try {
      const response = await fetch(sandboxUrl, { timeout: 10000 })
      console.log(`Next.js app status: ${response.status}`)
    } catch (urlError) {
      console.log(`Next.js app error: ${urlError.message}`)
    }
    
    console.log(`Testing ${apiUrl}...`)
    try {
      const response = await fetch(`${apiUrl}/health`, { timeout: 10000 })
      console.log(`API service status: ${response.status}`)
      if (response.ok) {
        const healthData = await response.text()
        console.log('Health response:', healthData)
      }
    } catch (apiError) {
      console.log(`API service error: ${apiError.message}`)
    }
  } else {
    console.log('No manual sandbox ID configured')
  }
  
  console.log('\n🏁 HTTP API test completed')
}

testHttpApi().catch(console.error)