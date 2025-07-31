/**
 * Test Simplified PRIA E2B System
 * Validates the production-ready simplified sandbox manager works correctly
 */

const { E2BSandboxManager } = require('./lib/e2b/sandbox-manager');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (match) {
          const key = match[1];
          const value = match[2].replace(/^["']|["']$/g, '');
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnvFile();

async function testSimplifiedSystem() {
  console.log('🧪 Testing Simplified PRIA E2B System\n');
  
  const templateId = process.env.E2B_TEMPLATE_ID;
  const apiKey = process.env.E2B_API_KEY;
  
  console.log('Template ID:', templateId);
  console.log('API Key:', apiKey ? 'present' : 'missing');
  
  if (!apiKey) {
    console.error('❌ E2B_API_KEY is required');
    return;
  }
  
  const testResults = {
    timestamp: new Date().toISOString(),
    templateId,
    tests: [],
    summary: {
      passed: 0,
      failed: 0,
      total: 0
    }
  };
  
  try {
    // Test 1: Initialize Sandbox Manager
    console.log('📦 Test 1: Initialize Sandbox Manager');
    const manager = new E2BSandboxManager({
      template: templateId,
      apiKey: apiKey,
      timeoutMs: 300000
    });
    
    testResults.tests.push({
      name: 'Initialize Sandbox Manager',
      status: 'passed',
      message: 'Manager initialized successfully'
    });
    testResults.summary.passed++;
    console.log('✅ Sandbox manager initialized successfully\n');
    
    // Test 2: Create Sandbox with Custom Template
    console.log('📦 Test 2: Create Sandbox with Custom Template');
    const sessionId = `test-${Date.now()}`;
    const metadata = {
      workspaceId: 'test-workspace',
      projectName: 'test-project'
    };
    
    console.log(`Creating sandbox for session: ${sessionId}`);
    const environment = await manager.createSandbox(sessionId, metadata);
    
    if (environment && environment.sandbox) {
      console.log('✅ Sandbox created successfully');
      console.log('📍 Sandbox ID:', environment.sandbox.sandboxId);
      
      testResults.tests.push({
        name: 'Create Sandbox',
        status: 'passed',
        sandboxId: environment.sandbox.sandboxId,
        message: 'Sandbox created successfully'
      });
      testResults.summary.passed++;
      
      // Test 3: Verify Template Features
      console.log('\n📦 Test 3: Verify Template Features');
      
      try {
        // Check Node.js version
        const nodeResult = await environment.sandbox.commands.run('node --version');
        const nodeVersion = nodeResult.stdout.trim();
        console.log('🔧 Node.js version:', nodeVersion);
        
        // Check PRIA template files
        const priaCheck = await environment.sandbox.commands.run('ls -la /home/user/template/ 2>/dev/null | wc -l');
        const priaFileCount = parseInt(priaCheck.stdout.trim()) || 0;
        console.log('📁 PRIA template files:', priaFileCount);
        
        // Check scripts directory
        const scriptsCheck = await environment.sandbox.commands.run('ls -la /home/user/scripts/ 2>/dev/null | wc -l');
        const scriptsFileCount = parseInt(scriptsCheck.stdout.trim()) || 0;
        console.log('📜 Scripts files:', scriptsFileCount);
        
        const isCorrectNodeVersion = nodeVersion.startsWith('v22.');
        const hasPRIAFiles = priaFileCount > 5;
        const hasScripts = scriptsFileCount > 2;
        
        if (isCorrectNodeVersion && hasPRIAFiles && hasScripts) {
          console.log('✅ Template verification passed');
          testResults.tests.push({
            name: 'Verify Template Features',
            status: 'passed',
            nodeVersion,
            priaFiles: priaFileCount,
            scriptsFiles: scriptsFileCount,
            message: 'Custom template working correctly'
          });
          testResults.summary.passed++;
        } else {
          console.log('⚠️  Template verification issues detected');
          testResults.tests.push({
            name: 'Verify Template Features',
            status: 'failed',
            nodeVersion,
            priaFiles: priaFileCount,
            scriptsFiles: scriptsFileCount,
            message: 'Template features not working as expected'
          });
          testResults.summary.failed++;
        }
        
      } catch (error) {
        console.log('❌ Template verification failed:', error.message);
        testResults.tests.push({
          name: 'Verify Template Features',
          status: 'failed',
          error: error.message,
          message: 'Template verification error'
        });
        testResults.summary.failed++;
      }
      
      // Test 4: Test Command Execution
      console.log('\n📦 Test 4: Test Command Execution');
      
      try {
        const testCommand = 'echo "PRIA test successful" && pwd && whoami';
        const cmdResult = await manager.executeCommand(sessionId, testCommand);
        
        console.log('📋 Command output:', cmdResult.stdout.trim());
        console.log('⏱️  Execution time:', cmdResult.duration, 'ms');
        
        if (cmdResult.exitCode === 0 && cmdResult.stdout.includes('PRIA test successful')) {
          console.log('✅ Command execution passed');
          testResults.tests.push({
            name: 'Test Command Execution',
            status: 'passed',
            duration: cmdResult.duration,
            message: 'Command execution working correctly'
          });
          testResults.summary.passed++;
        } else {
          console.log('❌ Command execution failed');
          testResults.tests.push({
            name: 'Test Command Execution',
            status: 'failed',
            exitCode: cmdResult.exitCode,
            error: cmdResult.stderr,
            message: 'Command execution not working'
          });
          testResults.summary.failed++;
        }
        
      } catch (error) {
        console.log('❌ Command execution error:', error.message);
        testResults.tests.push({
          name: 'Test Command Execution',
          status: 'failed',
          error: error.message,
          message: 'Command execution error'
        });
        testResults.summary.failed++;
      }
      
      // Test 5: Cleanup
      console.log('\n📦 Test 5: Cleanup');
      
      try {
        await manager.terminateSandbox(sessionId);
        console.log('✅ Sandbox terminated successfully');
        
        testResults.tests.push({
          name: 'Cleanup',
          status: 'passed',
          message: 'Sandbox terminated successfully'
        });
        testResults.summary.passed++;
        
      } catch (error) {
        console.log('⚠️  Cleanup warning:', error.message);
        testResults.tests.push({
          name: 'Cleanup',
          status: 'warning',
          error: error.message,
          message: 'Cleanup completed with warnings'
        });
        testResults.summary.passed++;
      }
      
    } else {
      console.log('❌ Sandbox creation failed');
      testResults.tests.push({
        name: 'Create Sandbox',
        status: 'failed',
        message: 'Sandbox creation returned null/undefined'
      });
      testResults.summary.failed++;
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    testResults.tests.push({
      name: 'System Test',
      status: 'failed',
      error: error.message,
      message: 'System test failed with error'
    });
    testResults.summary.failed++;
  }
  
  // Calculate totals and show summary
  testResults.summary.total = testResults.summary.passed + testResults.summary.failed;
  const successRate = ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1);
  
  console.log('\n📊 Test Summary:');
  console.log('================');
  console.log(`Total Tests: ${testResults.summary.total}`);
  console.log(`Passed: ${testResults.summary.passed}`);
  console.log(`Failed: ${testResults.summary.failed}`);
  console.log(`Success Rate: ${successRate}%`);
  
  if (testResults.summary.failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Simplified PRIA system is working correctly!');
  } else {
    console.log('⚠️  Some tests failed. Check the detailed results below.');
  }
  
  console.log('\n📄 Detailed Results:');
  console.log(JSON.stringify(testResults, null, 2));
  
  return testResults;
}

testSimplifiedSystem()
  .then(results => {
    const success = results.summary.failed === 0;
    console.log(`\n✅ Testing completed. Success: ${success}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test runner error:', error);
    process.exit(1);
  });