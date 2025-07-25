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

async function testSandboxCreation() {
  loadEnvLocal()
  
  console.log('🧪 E2B Sandbox Creation Test')
  console.log('=' .repeat(50))
  console.log(`Template ID: ${process.env.E2B_TEMPLATE_ID}`)
  console.log(`API Key present: ${!!process.env.E2B_API_KEY}`)
  console.log(`API Key prefix: ${process.env.E2B_API_KEY?.substring(0, 10)}...`)
  console.log('=' .repeat(50))
  
  const startTime = Date.now()
  let sandbox = null
  
  try {
    console.log('🚀 Starting sandbox creation...')
    console.log(`⏰ Start time: ${new Date().toISOString()}`)
    
    // Create sandbox with detailed logging
    sandbox = await Sandbox.create({
      template: process.env.E2B_TEMPLATE_ID,
      metadata: {
        test: 'sandbox-creation-test',
        timestamp: new Date().toISOString()
      }
    })
    
    const creationTime = Math.round((Date.now() - startTime) / 1000)
    console.log(`✅ Sandbox created successfully in ${creationTime} seconds`)
    console.log(`📦 Sandbox ID: ${sandbox.id}`)
    console.log(`🌐 Sandbox URL: https://3000-${sandbox.id}.e2b.app`)
    console.log('=' .repeat(50))
    
    // Test basic connectivity
    console.log('🔧 Testing basic connectivity...')
    const echoTest = await sandbox.commands.run('echo "Hello from E2B sandbox"')
    console.log(`Echo test - Exit code: ${echoTest.exitCode}`)
    console.log(`Echo test - Output: ${echoTest.stdout}`)
    if (echoTest.stderr) console.log(`Echo test - Error: ${echoTest.stderr}`)
    
    // Check current working directory and list contents
    console.log('\n📁 Checking sandbox filesystem...')
    const pwdResult = await sandbox.commands.run('pwd')
    console.log(`Current directory: ${pwdResult.stdout}`)
    
    const lsResult = await sandbox.commands.run('ls -la /code/')
    console.log('Contents of /code/:')
    console.log(lsResult.stdout || 'Directory not found or empty')
    if (lsResult.stderr) console.log(`LS error: ${lsResult.stderr}`)
    
    // Check if start script exists
    console.log('\n🔍 Checking for start script...')
    const scriptCheck = await sandbox.commands.run('ls -la /code/scripts/start-services.sh')
    console.log('Start script check:')
    console.log(scriptCheck.stdout || 'Script not found')
    if (scriptCheck.stderr) console.log(`Script check error: ${scriptCheck.stderr}`)
    
    // Check running processes
    console.log('\n🔄 Checking running processes...')
    const processCheck = await sandbox.commands.run('ps aux')
    console.log('Running processes:')
    console.log(processCheck.stdout)
    
    // Try to run the start script if it exists
    if (!scriptCheck.stderr) {
      console.log('\n🚀 Attempting to run start script...')
      
      // Make sure it's executable
      const chmodResult = await sandbox.commands.run('chmod +x /code/scripts/start-services.sh')
      console.log(`Chmod result - Exit code: ${chmodResult.exitCode}`)
      if (chmodResult.stderr) console.log(`Chmod error: ${chmodResult.stderr}`)
      
      // Run the start script in background
      const startResult = await sandbox.commands.run('cd /code && nohup ./scripts/start-services.sh > /tmp/start-output.log 2>&1 &')
      console.log(`Start script - Exit code: ${startResult.exitCode}`)
      console.log(`Start script - Output: ${startResult.stdout}`)
      if (startResult.stderr) console.log(`Start script - Error: ${startResult.stderr}`)
      
      // Wait a bit for services to start
      console.log('\n⏳ Waiting 30 seconds for services to start...')
      await new Promise(resolve => setTimeout(resolve, 30000))
      
      // Check the start script output
      const logCheck = await sandbox.commands.run('cat /tmp/start-output.log')
      console.log('\nStart script output:')
      console.log(logCheck.stdout || 'No output logged')
      if (logCheck.stderr) console.log(`Log check error: ${logCheck.stderr}`)
      
      // Check if services are running
      console.log('\n🏥 Health check - Port 3000...')
      const port3000Check = await sandbox.commands.run('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000')
      console.log(`Port 3000 response code: ${port3000Check.stdout}`)
      
      console.log('\n🏥 Health check - Port 8080...')
      const port8080Check = await sandbox.commands.run('curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health')
      console.log(`Port 8080 response code: ${port8080Check.stdout}`)
      
      // Check running processes again
      console.log('\n🔄 Checking processes after start script...')
      const processCheckAfter = await sandbox.commands.run('ps aux | grep -E "(node|npm)" | grep -v grep')
      console.log('Node processes:')
      console.log(processCheckAfter.stdout || 'No Node processes found')
    }
    
    console.log('\n' + '=' .repeat(50))
    console.log('✅ Test completed successfully!')
    console.log(`📦 Sandbox ID: ${sandbox.id}`)
    console.log(`🌐 Access URL: https://3000-${sandbox.id}.e2b.app`)
    console.log(`⏱️  Total time: ${Math.round((Date.now() - startTime) / 1000)} seconds`)
    console.log('=' .repeat(50))
    
    // Keep sandbox alive for manual testing
    console.log('\n🕐 Keeping sandbox alive for 2 minutes for manual testing...')
    console.log('   You can visit the URL above to test the application')
    console.log('   Press Ctrl+C to stop and close the sandbox')
    
    await new Promise(resolve => setTimeout(resolve, 120000)) // 2 minutes
    
  } catch (error) {
    const errorTime = Math.round((Date.now() - startTime) / 1000)
    console.error(`❌ Sandbox creation failed after ${errorTime} seconds`)
    console.error(`Error type: ${error.constructor.name}`)
    console.error(`Error message: ${error.message}`)
    
    if (error.message.includes('timeout')) {
      console.log('\n💡 Timeout troubleshooting:')
      console.log('   - Your template might be taking longer than expected to build')
      console.log('   - Try running: e2b sandbox spawn 33mz2agmad58ip0izxbc (for immediate testing)')
      console.log('   - Check E2B dashboard for any build errors')
    }
    
    if (error.message.includes('forbidden') || error.message.includes('unauthorized')) {
      console.log('\n💡 Authentication troubleshooting:')
      console.log('   - Check if your E2B API key is valid')
      console.log('   - Verify the template ID exists and is accessible')
    }
  } finally {
    // Clean up
    if (sandbox) {
      try {
        console.log('\n🧹 Closing sandbox...')
        await sandbox.close()
        console.log('✅ Sandbox closed successfully')
      } catch (closeError) {
        console.error('❌ Error closing sandbox:', closeError.message)
      }
    }
    
    console.log('\n🏁 Test script finished')
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted by user - cleaning up...')
  process.exit(0)
})

// Run the test
testSandboxCreation().catch(console.error)