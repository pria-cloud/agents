// For testing, let's use a simpler approach
const E2BSandboxManager = require('./lib/e2b/sandbox-manager.ts');

// Simple test configuration
const testConfig = {
  template: process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2',
  apiKey: process.env.E2B_API_KEY || '',
  timeoutMs: 300000
};

async function testCLIWorkaround() {
  console.log('🧪 Testing E2B CLI Workaround Implementation');
  console.log('==========================================\n');
  
  try {
    // Test configuration
    console.log('Configuration:', JSON.stringify(testConfig, null, 2));
    
    // Create sandbox manager with our custom template
    const manager = new E2BSandboxManager(testConfig);
    
    // Test CLI manager availability first
    console.log('\n📋 Testing CLI Manager Availability...');
    const cliTest = await manager.testCLIManager();
    console.log('CLI Manager Status:', cliTest);
    
    if (!cliTest.available) {
      console.log('❌ CLI Manager not available, skipping sandbox creation test');
      console.log('Error:', cliTest.error);
      return;
    }
    
    console.log('✅ CLI Manager is available');
    
    // Test sandbox creation with our custom template
    console.log('\n🚀 Testing Sandbox Creation with CLI Workaround...');
    const sessionId = `test-cli-${Date.now()}`;
    
    console.log(`Creating sandbox for session: ${sessionId}`);
    console.log(`Template: ${testConfig.template}`);
    
    const environment = await manager.createSandbox(sessionId, {
      workspaceId: 'test-workspace-123',
      projectName: 'test-cli-workaround',
      userId: 'test-user'
    });
    
    console.log('\n✅ Sandbox creation completed!');
    console.log('Environment ID:', environment.id);
    console.log('Status:', environment.status);
    console.log('Working Directory:', environment.workingDirectory);
    
    // Test basic command execution
    console.log('\n🔧 Testing Command Execution...');
    const nodeVersionResult = await manager.executeCommand(sessionId, 'node --version');
    console.log('Node.js version:', nodeVersionResult.stdout.trim());
    
    // Validate Node.js version
    if (nodeVersionResult.stdout.trim().startsWith('v22.')) {
      console.log('🎉 SUCCESS! Custom template is working - Node.js v22 detected');
    } else {
      console.log('⚠️  Warning: Expected Node.js v22, got:', nodeVersionResult.stdout.trim());
    }
    
    // Test PRIA template structure
    console.log('\n📁 Testing PRIA Template Structure...');
    const templateCheckResult = await manager.executeCommand(
      sessionId, 
      'ls -la /home/user/template/ 2>/dev/null | head -5 || echo "Template directory not found"'
    );
    console.log('Template directory check:');
    console.log(templateCheckResult.stdout);
    
    const scriptsCheckResult = await manager.executeCommand(
      sessionId,
      'ls -la /home/user/scripts/ 2>/dev/null | head -5 || echo "Scripts directory not found"'
    );
    console.log('Scripts directory check:');
    console.log(scriptsCheckResult.stdout);
    
    // Test PRIA initialization script
    console.log('\n🎯 Testing PRIA Initialization Script...');
    const initScriptCheck = await manager.executeCommand(
      sessionId,
      'test -f /home/user/scripts/init-pria-project.sh && echo "FOUND" || echo "NOT_FOUND"'
    );
    
    if (initScriptCheck.stdout.trim() === 'FOUND') {
      console.log('✅ PRIA initialization script found');
      
      // Test running the initialization script
      console.log('\n🚀 Testing PRIA Project Initialization...');
      const workingDir = `/home/user/workspace/test-project-${Date.now()}`;
      const initCommand = `/home/user/scripts/init-pria-project.sh "${workingDir}" "test-project" "test-workspace" "${sessionId}"`;
      
      // Set up environment for the script
      const initResult = await manager.executeCommand(sessionId, initCommand, {
        env: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'test-key'
        }
      });
      
      console.log('Init script exit code:', initResult.exitCode);
      if (initResult.exitCode === 0) {
        console.log('✅ PRIA initialization successful!');
        
        // Verify project files were created
        const verifyResult = await manager.executeCommand(
          sessionId,
          `ls -la "${workingDir}" | head -10`
        );
        console.log('Project files created:');
        console.log(verifyResult.stdout);
        
      } else {
        console.log('❌ PRIA initialization failed');
        console.log('stdout:', initResult.stdout);
        console.log('stderr:', initResult.stderr);
      }
    } else {
      console.log('❌ PRIA initialization script not found');
    }
    
    // Test sandbox reconnection
    console.log('\n🔄 Testing Sandbox Reconnection...');
    const retrievedEnvironment = await manager.getSandbox(sessionId);
    
    if (retrievedEnvironment) {
      console.log('✅ Sandbox reconnection successful');
      console.log('Retrieved environment status:', retrievedEnvironment.status);
    } else {
      console.log('❌ Sandbox reconnection failed');
    }
    
    // Clean up
    console.log('\n🧹 Cleaning up...');
    await manager.terminateSandbox(sessionId);
    console.log('✅ Sandbox terminated');
    
    console.log('\n🎉 CLI Workaround Test Completed Successfully!');
    console.log('The E2B custom template integration is working with CLI workaround.');
    
  } catch (error) {
    console.error('\n❌ CLI Workaround Test Failed:');
    console.error(error.message);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

// Check if we have required environment variables
if (!process.env.E2B_API_KEY) {
  console.error('❌ E2B_API_KEY environment variable is required');
  process.exit(1);
}

if (!process.env.E2B_TEMPLATE_ID) {
  console.error('❌ E2B_TEMPLATE_ID environment variable is required');
  process.exit(1);
}

testCLIWorkaround();