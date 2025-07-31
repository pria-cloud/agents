const { Sandbox } = require('e2b');

async function testE2BTemplate() {
  console.log('Testing E2B Template: pria-dev-env-v3');
  const templateId = process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2';
  console.log('Template ID:', templateId);
  
  try {
    // Try both template ID and template name to see which works
    const configs = [
      { template: templateId, timeoutMs: 300000, description: 'Template ID' },
      { template: 'pria-dev-env-v3', timeoutMs: 300000, description: 'Template Name' }
    ];
    
    for (const config of configs) {
      console.log(`\n🧪 Testing with ${config.description}: ${config.template}`);
      
      try {
        const sandbox = await Sandbox.create({
          template: config.template,
          timeoutMs: config.timeoutMs
        });
        
        console.log('✅ Sandbox created successfully!');
        console.log('Sandbox ID:', sandbox.sandboxId);
        
        // Quick Node.js version check
        const nodeVersion = await sandbox.commands.run('node --version');
        console.log('Node.js version:', nodeVersion.stdout.trim());
        
        if (nodeVersion.stdout.trim().startsWith('v22.')) {
          console.log('🎉 SUCCESS! Using correct custom template with Node.js v22');
          
          // Test template structure
          const templateCheck = await sandbox.commands.run('ls -la /home/user/template/ 2>/dev/null | head -5');
          const scriptsCheck = await sandbox.commands.run('ls -la /home/user/scripts/ 2>/dev/null | head -5');
          
          console.log('Template files found:');
          console.log(templateCheck.stdout);
          console.log('Scripts found:');
          console.log(scriptsCheck.stdout);
          
          await sandbox.kill();
          return;
        } else {
          console.log('❌ Still using base template');
          await sandbox.kill();
        }
        
      } catch (error) {
        console.log(`❌ Failed with ${config.description}:`, error.message);
      }
    }
    
    console.log('\n❌ Neither template ID nor template name worked correctly');
    return;
    
    console.log('\n✅ Sandbox created successfully!');
    console.log('Sandbox ID:', sandbox.sandboxId);
    console.log('Sandbox object keys:', Object.keys(sandbox));
    
    // Check if there are any template-related properties
    if (sandbox.template) {
      console.log('Sandbox template property:', sandbox.template);
    }
    if (sandbox.metadata) {
      console.log('Sandbox metadata:', JSON.stringify(sandbox.metadata, null, 2));
    }
    
    // Check if template files exist
    console.log('\n📁 Checking template directory contents...');
    const lsResult = await sandbox.commands.run('ls -la /home/user/');
    console.log('Home directory contents:');
    console.log(lsResult.stdout);
    
    // Check for Next.js project structure
    console.log('\n🔍 Checking for Next.js project structure...');
    const projectCheck = await sandbox.commands.run('ls -la /home/user/app/ 2>/dev/null || echo "No app directory found"');
    console.log('App directory contents:');
    console.log(projectCheck.stdout);
    
    // Check for package.json
    console.log('\n📦 Checking for package.json...');
    const packageCheck = await sandbox.commands.run('test -f /home/user/app/package.json && echo "package.json found" || echo "package.json not found"');
    console.log(packageCheck.stdout);
    
    // Check Node.js version
    console.log('\n🚀 Checking Node.js version...');
    const nodeVersion = await sandbox.commands.run('node --version');
    console.log('Node.js version:', nodeVersion.stdout.trim());
    
    // Validate Node.js version - should be v22.x for our custom template
    const nodeVersionNumber = nodeVersion.stdout.trim();
    if (nodeVersionNumber.startsWith('v22.')) {
      console.log('✅ Correct Node.js version (v22.x) - using PRIA custom template');
    } else {
      console.log('❌ Incorrect Node.js version - likely using base template instead of PRIA custom template');
    }
    
    // Check if npm is available
    console.log('\n📋 Checking npm availability...');
    const npmVersion = await sandbox.commands.run('npm --version');
    console.log('npm version:', npmVersion.stdout.trim());
    
    // Check for PRIA template files
    console.log('\n🔍 Checking for PRIA template structure...');
    const templateCheck = await sandbox.commands.run('ls -la /home/user/template/ 2>/dev/null || echo "Template directory not found"');
    console.log('Template directory contents:');
    console.log(templateCheck.stdout);
    
    const scriptsCheck = await sandbox.commands.run('ls -la /home/user/scripts/ 2>/dev/null || echo "Scripts directory not found"');
    console.log('Scripts directory contents:');
    console.log(scriptsCheck.stdout);
    
    // Check if init script exists
    const initScriptCheck = await sandbox.commands.run('test -f /home/user/scripts/init-pria-project.sh && echo "✅ PRIA init script found" || echo "❌ PRIA init script missing"');
    console.log('Init script check:', initScriptCheck.stdout.trim());
    
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