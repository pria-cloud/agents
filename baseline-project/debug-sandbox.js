const { Sandbox } = require('e2b');

async function debugSandbox() {
  console.log('🔍 Debugging E2B Sandbox Template...');
  
  try {
    // Create sandbox with your template ID
    console.log('📋 Creating sandbox with template: bslm087lozmkvjz6nwle');
    
    const sandbox = await Sandbox.create('bslm087lozmkvjz6nwle', {
      timeoutMs: 300000,
      apiKey: 'e2b_b43fc9e0e3d94d3f820e0ff1ac41b0b70cc57076'
    });
    
    console.log('✅ Sandbox created successfully!');
    console.log('📋 Sandbox ID:', sandbox.sandboxId);
    
    const host = sandbox.getHost(3000);
    console.log('🌐 Dev Server URL:', `https://${host}`);
    
    // Check the directory structure
    console.log('\n📁 Checking directory structure...');
    const lsResult = await sandbox.commands.start('ls -la /code');
    console.log(lsResult.stdout);
    
    // Check if package.json exists
    console.log('\n📦 Checking package.json...');
    const packageCheck = await sandbox.commands.start('cat /code/package.json');
    console.log(packageCheck.stdout);
    
    // Check if node_modules exists
    console.log('\n📦 Checking node_modules...');
    const nodeModulesCheck = await sandbox.commands.start('ls -la /code/node_modules | head -10');
    console.log(nodeModulesCheck.stdout);
    
    // Check if Next.js is installed
    console.log('\n⚡ Checking Next.js installation...');
    const nextCheck = await sandbox.commands.start('cd /code && npx next --version');
    console.log('Next.js version:', nextCheck.stdout.trim());
    
    // Run npm install to make sure dependencies are installed
    console.log('\n📦 Running npm install...');
    const npmInstall = await sandbox.commands.start('cd /code && npm install --legacy-peer-deps');
    console.log('npm install output:', npmInstall.stdout);
    if (npmInstall.stderr) {
      console.log('npm install errors:', npmInstall.stderr);
    }
    
    // Try to build the project first
    console.log('\n🔨 Trying to build the project...');
    const buildResult = await sandbox.commands.start('cd /code && npm run build');
    console.log('Build output:', buildResult.stdout);
    if (buildResult.stderr) {
      console.log('Build errors:', buildResult.stderr);
    }
    
    // Start the development server in the background
    console.log('\n🚀 Starting development server...');
    
    // Start the dev server as a background process
    const devServerProcess = await sandbox.commands.start('cd /code && npm run dev > /tmp/dev-server.log 2>&1 &');
    console.log('Dev server start command result:', devServerProcess.stdout);
    
    // Wait a bit for the server to start
    console.log('⏳ Waiting for server to start...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check if the process is running
    console.log('\n🔍 Checking running processes...');
    const processCheck = await sandbox.commands.start('ps aux | grep node');
    console.log('Running Node processes:', processCheck.stdout);
    
    // Check the dev server logs
    console.log('\n📄 Checking dev server logs...');
    const logCheck = await sandbox.commands.start('cat /tmp/dev-server.log');
    console.log('Dev server logs:', logCheck.stdout);
    
    // Check if port 3000 is listening
    console.log('\n🔍 Checking port 3000...');
    const portCheck = await sandbox.commands.start('netstat -tlnp | grep 3000 || ss -tlnp | grep 3000');
    console.log('Port 3000 status:', portCheck.stdout);
    
    // Try to make a request to localhost:3000
    console.log('\n🌐 Testing local connection...');
    const localTest = await sandbox.commands.start('curl -s http://localhost:3000 | head -20');
    console.log('Local curl test:', localTest.stdout);
    
    console.log('\n🎯 Manual testing URLs:');
    console.log(`🌐 Sandbox URL: https://${sandbox.sandboxId}.e2b.dev`);
    console.log(`⚡ Dev Server URL: https://${host}`);
    console.log('\n⏰ Keeping sandbox alive for 5 minutes for manual testing...');
    
    // Keep the sandbox alive
    setTimeout(() => {
      console.log('⏰ Sandbox session ending...');
      process.exit(0);
    }, 300000);
    
  } catch (error) {
    console.error('❌ Error debugging sandbox:', error);
  }
}

debugSandbox();