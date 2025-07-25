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

async function testApiBuild() {
  loadEnvLocal()
  
  console.log('🧪 Testing API Service Build')
  console.log('============================')
  console.log(`Template ID: ${process.env.E2B_TEMPLATE_ID}`)
  console.log('')
  
  try {
    console.log('1️⃣  Creating fresh sandbox...')
    const sandbox = await Sandbox.create(process.env.E2B_TEMPLATE_ID)
    console.log(`✅ Sandbox created: ${sandbox.sandboxId}`)
    
    // Wait for initialization
    console.log('\n2️⃣  Waiting for sandbox initialization...')
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // Check API service directory structure
    console.log('\n3️⃣  Checking API service directory...')
    const apiCheck = await sandbox.commands.run('ls -la /code/api-service/')
    console.log('API service directory:')
    console.log(apiCheck.stdout)
    if (apiCheck.stderr) console.log('stderr:', apiCheck.stderr)
    
    // Check package.json exists
    console.log('\n4️⃣  Checking package.json...')
    const packageCheck = await sandbox.commands.run('cat /code/api-service/package.json')
    console.log('Package.json content (first 10 lines):')
    console.log(packageCheck.stdout.split('\n').slice(0, 10).join('\n'))
    
    // Check Node.js and npm versions
    console.log('\n5️⃣  Checking Node.js environment...')
    const nodeCheck = await sandbox.commands.run('cd /code/api-service && node --version && npm --version')
    console.log('Node.js environment:')
    console.log(nodeCheck.stdout)
    if (nodeCheck.stderr) console.log('stderr:', nodeCheck.stderr)
    
    // Check if dependencies are already installed
    console.log('\n6️⃣  Checking node_modules...')
    const nodeModulesCheck = await sandbox.commands.run('ls -la /code/api-service/node_modules/ | head -5')
    console.log('Node modules check:')
    console.log(nodeModulesCheck.stdout)
    
    // Try npm install first
    console.log('\n7️⃣  Installing dependencies...')
    const installResult = await sandbox.commands.run('cd /code/api-service && npm install --verbose')
    console.log(`Install exit code: ${installResult.exitCode}`)
    console.log('Install stdout (last 20 lines):')
    console.log(installResult.stdout.split('\n').slice(-20).join('\n'))
    if (installResult.stderr) {
      console.log('Install stderr (last 10 lines):')
      console.log(installResult.stderr.split('\n').slice(-10).join('\n'))
    }
    
    // Try the build
    console.log('\n8️⃣  Attempting build...')
    const buildResult = await sandbox.commands.run('cd /code/api-service && npm run build')
    console.log(`Build exit code: ${buildResult.exitCode}`)
    console.log('Build stdout:')
    console.log(buildResult.stdout)
    if (buildResult.stderr) {
      console.log('Build stderr:')
      console.log(buildResult.stderr)
    }
    
    // Check if dist directory was created
    if (buildResult.exitCode === 0) {
      console.log('\n9️⃣  Checking build output...')
      const distCheck = await sandbox.commands.run('ls -la /code/api-service/dist/')
      console.log('Dist directory contents:')
      console.log(distCheck.stdout)
    }
    
    // Try starting the API service manually
    console.log('\n🔟 Testing API service startup...')
    const startResult = await sandbox.commands.run('cd /code/api-service && timeout 10 npm start', { timeout: 15000 })
    console.log(`Start exit code: ${startResult.exitCode}`)
    console.log('Start stdout:')
    console.log(startResult.stdout)
    if (startResult.stderr) {
      console.log('Start stderr:')
      console.log(startResult.stderr)
    }
    
    console.log(`\n🎯 Sandbox available at: https://3000-${sandbox.sandboxId}.e2b.app`)
    console.log('⏰ Keeping sandbox alive for 2 minutes for inspection...')
    
    // Keep alive for manual testing
    await new Promise(resolve => setTimeout(resolve, 120000))
    
    await sandbox.kill()
    console.log('✅ Sandbox closed')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Full error:', error)
  }
}

testApiBuild().catch(console.error)