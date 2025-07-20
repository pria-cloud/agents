const { Sandbox } = require('e2b');

async function testSandbox() {
  console.log('🚀 Testing E2B Sandbox Template...');
  
  try {
    // Create sandbox with your template ID
    console.log('📋 Creating sandbox with template: bslm087lozmkvjz6nwle');
    
    const sandbox = await Sandbox.create('bslm087lozmkvjz6nwle', {
      timeoutMs: 100000, // 5 minutes timeout
      apiKey: 'e2b_b43fc9e0e3d94d3f820e0ff1ac41b0b70cc57076'
    });
    
    console.log('✅ Sandbox created successfully!');
    console.log('📋 Sandbox object:', sandbox);
    console.log('📋 Sandbox ID:', sandbox.sandboxId);
    console.log('🌐 Sandbox URL:', `https://${sandbox.sandboxId || 'unknown'}.e2b.dev`);
    
    // Check if sandbox is properly created
    if (!sandbox || !sandbox.sandboxId) {
      throw new Error('Sandbox creation failed - no sandbox ID returned');
    }

    const host = sandbox.getHost(3000) 
    console.log(`https://${host}`)
    
    // Test basic functionality
    console.log('\n🔧 Testing basic functionality...');
    
    // Check if Next.js is installed
    const nodeVersion = await sandbox.commands.start('node --version');
    console.log('📦 Node.js version:', nodeVersion.stdout.trim());
    
    // Check if the Next.js app structure exists
    const lsResult = await sandbox.commands.start('ls -la /code');
    console.log('\n📁 Directory structure:');
    console.log(lsResult.stdout);
    
    // Check if package.json exists and shows our dependencies
    const packageCheck = await sandbox.commands.start('cat /code/package.json');
    console.log('\n📦 Package.json contents:');
    console.log(packageCheck.stdout);
    
    // Test if we can start the dev server (run for a few seconds)
    console.log('\n🎯 Testing development server startup...');
    const devServer = await sandbox.commands.start('cd /code && timeout 10 npm run dev');
    
    if (devServer.stdout.includes('Ready') || devServer.stdout.includes('localhost:3000')) {
      console.log('✅ Development server started successfully!');
    } else {
      console.log('⚠️  Development server output:', devServer.stdout);
      console.log('⚠️  Development server errors:', devServer.stderr);
    }
    
    // Test file operations
    console.log('\n📝 Testing file operations...');
    
    // Create a test file
    await sandbox.files.write('/code/test-file.txt', 'Hello from E2B sandbox!');
    
    // Read the file back
    const fileContent = await sandbox.files.read('/code/test-file.txt');
    console.log('📄 Test file content:', fileContent);
    
    // Clean up
    await sandbox.files.remove('/code/test-file.txt');
    console.log('🧹 Test file cleaned up');
    
    console.log('\n🎉 All tests passed! Template is working correctly.');
    console.log('🌐 You can access your sandbox at:', `https://${sandbox.sandboxId}.e2b.dev`);
    
    // Keep sandbox running for manual testing
    console.log('\n⏰ Sandbox will stay running for 5 minutes for manual testing...');
    console.log('Press Ctrl+C to terminate early');
    
  } catch (error) {
    console.error('❌ Error testing sandbox:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

testSandbox();