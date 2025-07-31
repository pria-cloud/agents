// Move to builder-app directory and run from there

async function testE2BTemplate() {
  console.log('Testing E2B Template: pria-dev-env-v3');
  console.log('Template ID:', process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2');
  
  try {
    // Create sandbox using the template ID
    const sandbox = await Sandbox.create({
      template: process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2',
      timeoutMs: 300000
    });
    
    console.log('\n✅ Sandbox created successfully!');
    console.log('Sandbox ID:', sandbox.sandboxId);
    
    // Check if template files exist
    console.log('\n📁 Checking template directory contents...');
    const lsResult = await sandbox.process.startAndWait('ls -la /home/user/');
    console.log('Home directory contents:');
    console.log(lsResult.stdout);
    
    // Check for Next.js project structure
    console.log('\n🔍 Checking for Next.js project structure...');
    const projectCheck = await sandbox.process.startAndWait('ls -la /home/user/app/ 2>/dev/null || echo "No app directory found"');
    console.log('App directory contents:');
    console.log(projectCheck.stdout);
    
    // Check for package.json
    console.log('\n📦 Checking for package.json...');
    const packageCheck = await sandbox.process.startAndWait('test -f /home/user/app/package.json && echo "package.json found" || echo "package.json not found"');
    console.log(packageCheck.stdout);
    
    // Check Node.js version
    console.log('\n🚀 Checking Node.js version...');
    const nodeVersion = await sandbox.process.startAndWait('node --version');
    console.log('Node.js version:', nodeVersion.stdout.trim());
    
    // Check if npm is available
    console.log('\n📋 Checking npm availability...');
    const npmVersion = await sandbox.process.startAndWait('npm --version');
    console.log('npm version:', npmVersion.stdout.trim());
    
    console.log('\n✅ Template test completed successfully!');
    
    // Clean up
    await sandbox.close();
    console.log('🧹 Sandbox closed');
    
  } catch (error) {
    console.error('\n❌ Template test failed:');
    console.error(error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testE2BTemplate();