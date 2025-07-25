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

async function fixCurrentSandbox() {
  loadEnvLocal()
  
  console.log('🔧 Fixing Current Sandbox Port Issue')
  console.log('===================================')
  
  try {
    const sandbox = await Sandbox.connect('iqpici7sz3zdi0hzx2umm')
    console.log(`✅ Connected to sandbox: ${sandbox.sandboxId}`)
    
    // Kill existing Next.js process
    console.log('\n1️⃣  Stopping current Next.js process...')
    await sandbox.commands.run('pkill -f "next dev" || true')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Fix the package.json
    console.log('\n2️⃣  Updating package.json to use port 4000...')
    const updatePackageJson = await sandbox.commands.run('cd /code/baseline-project && sed -i "s/next dev -p [0-9]*/next dev -p 4000/g" package.json')
    console.log(`Package.json update exit code: ${updatePackageJson.exitCode}`)
    
    // Verify the fix
    const checkPackageJson = await sandbox.commands.run('cd /code/baseline-project && grep "dev.*next dev" package.json')
    console.log('Updated dev script:')
    console.log(checkPackageJson.stdout)
    
    // Restart Next.js on port 4000
    console.log('\n3️⃣  Starting Next.js on port 4000...')
    const startNextJs = await sandbox.commands.run('cd /code/baseline-project && npm run dev > /code/logs/nextjs-port4000.log 2>&1 &')
    console.log(`Next.js start exit code: ${startNextJs.exitCode}`)
    
    // Wait for it to start
    console.log('\n4️⃣  Waiting for Next.js to start (15 seconds)...')
    await new Promise(resolve => setTimeout(resolve, 15000))
    
    // Check if port 4000 is listening
    console.log('\n5️⃣  Checking if port 4000 is now listening...')
    const portCheck = await sandbox.commands.run('ss -tlnp | grep ":4000" || echo "Port 4000 not found"')
    console.log('Port 4000 status:')
    console.log(portCheck.stdout)
    
    // Check the logs
    const logCheck = await sandbox.commands.run('tail -10 /code/logs/nextjs-port4000.log')
    console.log('\nNext.js startup log:')
    console.log(logCheck.stdout)
    
    // Final test - try to access the service
    console.log('\n6️⃣  Testing HTTP access to port 4000...')
    const httpTest = await sandbox.commands.run('curl -s -I http://localhost:4000 | head -1 || echo "HTTP test failed"')
    console.log('HTTP test result:')
    console.log(httpTest.stdout)
    
    console.log(`\n🎉 Fix complete! Test URLs:`)
    console.log(`- App (port 4000): https://4000-${sandbox.sandboxId}.e2b.app`)
    console.log(`- Builder (port 3000): https://3000-${sandbox.sandboxId}.e2b.app`)
    console.log(`- API (port 8080): https://8080-${sandbox.sandboxId}.e2b.app/health`)
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message)
  }
}

fixCurrentSandbox().catch(console.error)