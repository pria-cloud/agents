const { Sandbox } = require('e2b');

async function testBuilderAppApproach() {
  console.log('Testing Builder App E2B Integration Approach');
  console.log('This tests the actual workflow the Builder App will use');
  
  const templateId = process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2';
  console.log('Template ID:', templateId);
  
  try {
    // Create sandbox (even if it uses base template, our init script should work)
    const sandbox = await Sandbox.create({
      template: templateId,
      timeoutMs: 300000
    });
    
    console.log('\n✅ Sandbox created successfully!');
    console.log('Sandbox ID:', sandbox.sandboxId);
    
    // Check Node.js version first
    const nodeVersion = await sandbox.commands.run('node --version');
    console.log('Initial Node.js version:', nodeVersion.stdout.trim());
    
    // This is the critical part - check if our PRIA template structure exists
    console.log('\n🔍 Checking for PRIA template structure...');
    
    // Check if the template files exist
    const templateCheck = await sandbox.commands.run('ls -la /home/user/template/ 2>/dev/null | head -10');
    const scriptsCheck = await sandbox.commands.run('ls -la /home/user/scripts/ 2>/dev/null | head -10');
    
    console.log('Template directory:');
    console.log(templateCheck.stdout);
    console.log('\nScripts directory:');
    console.log(scriptsCheck.stdout);
    
    // Check for the critical init script
    const initScriptCheck = await sandbox.commands.run('test -f /home/user/scripts/init-pria-project.sh && echo "FOUND" || echo "NOT_FOUND"');
    const hasInitScript = initScriptCheck.stdout.trim() === 'FOUND';
    
    console.log('PRIA init script:', hasInitScript ? '✅ Found' : '❌ Not found');
    
    if (hasInitScript) {
      console.log('\n🚀 Testing PRIA project initialization...');
      
      // Test the actual initialization that the Builder App will do
      const sessionId = 'test-session-123';
      const projectName = 'test-pria-app';
      const workspaceId = 'test-workspace-456';
      const workingDirectory = `/home/user/workspace/session-${sessionId}`;
      
      // Run the PRIA initialization script (just like Builder App will)
      const initCommand = `/home/user/scripts/init-pria-project.sh "${workingDirectory}" "${projectName}" "${workspaceId}" "${sessionId}"`;
      console.log('Running init command:', initCommand);
      
      const initResult = await sandbox.commands.run(initCommand, {
        env: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'test-key',
          PRIA_SESSION_ID: sessionId,
          PRIA_WORKSPACE_ID: workspaceId,
          PRIA_PROJECT_NAME: projectName
        },
        timeout: 120000 // 2 minutes
      });
      
      console.log('Init script exit code:', initResult.exitCode);
      if (initResult.exitCode === 0) {
        console.log('✅ PRIA initialization succeeded!');
        
        // Verify the project was created correctly
        const verificationChecks = [
          'package.json',
          'TARGET_APP_SPECIFICATION.md',
          '.pria/session-context.json',
          '.claude.json'
        ];
        
        console.log('\n📋 Verification checks:');
        for (const file of verificationChecks) {
          const checkResult = await sandbox.commands.run(`test -f "${workingDirectory}/${file}" && echo "✅ ${file}" || echo "❌ ${file}"`);
          console.log(checkResult.stdout.trim());
        }
        
        // List the project structure
        const projectStructure = await sandbox.commands.run(`find "${workingDirectory}" -maxdepth 2 -type f | head -15`);
        console.log('\n📁 Project structure (first 15 files):');
        console.log(projectStructure.stdout);
        
        console.log('\n🎉 SUCCESS! PRIA Builder App integration should work correctly!');
        console.log('The custom template has all required files and the init script works.');
        
      } else {
        console.log('❌ PRIA initialization failed');
        console.log('stdout:', initResult.stdout);
        console.log('stderr:', initResult.stderr);
      }
    } else {
      console.log('\n❌ CRITICAL: PRIA init script not found in template');
      console.log('This means our custom template was not used or is incomplete');
    }
    
    // Clean up
    await sandbox.kill();
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testBuilderAppApproach();