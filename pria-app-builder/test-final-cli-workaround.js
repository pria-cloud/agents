/**
 * Final E2B CLI Workaround Test
 * Tests the complete CLI integration that bypasses E2B SDK template issues
 */

const { spawn } = require('child_process');

async function testFinalCLIWorkaround() {
  console.log('🎯 Final E2B CLI Workaround Test');
  console.log('=================================\n');
  
  const templateId = process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2';
  const apiKey = process.env.E2B_API_KEY;
  
  if (!apiKey) {
    console.error('❌ E2B_API_KEY is required');
    return;
  }
  
  const results = {
    templateId,
    timestamp: new Date().toISOString(),
    steps: [],
    success: false
  };
  
  try {
    // Step 1: Verify template exists
    console.log('📋 Step 1: Verifying custom template exists...');
    results.steps.push({ step: 1, name: 'Verify Template', status: 'running' });
    
    const templatesResult = await runCommand('e2b template list', { env: { E2B_API_KEY: apiKey } });
    
    if (templatesResult.stdout.includes(templateId)) {
      console.log('✅ Custom template found in templates list');
      results.steps[0].status = 'completed';
      results.templateFound = true;
    } else {
      console.log('❌ Custom template not found');
      results.steps[0].status = 'failed';
      results.templateFound = false;
      return results;
    }
    
    // Step 2: Create sandbox using CLI workaround
    console.log('\n🚀 Step 2: Creating sandbox with CLI workaround...');
    results.steps.push({ step: 2, name: 'Create Sandbox', status: 'running' });
    
    const sandboxResult = await runCommand(`e2b sandbox spawn ${templateId}`, {
      env: { E2B_API_KEY: apiKey },
      timeout: 30000,
      allowTerminalError: true // Expected due to setRawMode issue
    });
    
    // Extract sandbox ID from output
    const sandboxId = extractSandboxId(sandboxResult.stdout);
    
    if (sandboxId) {
      console.log('✅ Sandbox created successfully!');
      console.log('📍 Sandbox ID:', sandboxId);
      results.sandboxId = sandboxId;
      results.steps[1].status = 'completed';
      results.sandboxCreated = true;
    } else {
      console.log('❌ Could not extract sandbox ID');
      results.steps[1].status = 'failed';
      results.steps[1].error = 'No sandbox ID found in output';
      return results;
    }
    
    // Step 3: Test sandbox using E2B SDK reconnection
    console.log('\n🔗 Step 3: Testing SDK reconnection to CLI-created sandbox...');
    results.steps.push({ step: 3, name: 'SDK Reconnection', status: 'running' });
    
    try {
      // Use E2B SDK to reconnect (this should work)
      const { Sandbox } = require('e2b');
      const sandbox = await Sandbox.reconnect(sandboxId);
      
      console.log('✅ SDK reconnection successful!');
      
      // Test basic command execution
      const nodeVersionResult = await sandbox.commands.run('node --version');
      const nodeVersion = nodeVersionResult.stdout.trim();
      
      console.log('🔧 Node.js version:', nodeVersion);
      
      // Validate custom template features
      if (nodeVersion.startsWith('v22.')) {
        console.log('✅ Correct Node.js version (v22) - custom template working!');
        results.correctNodeVersion = true;
      } else {
        console.log('⚠️  Unexpected Node.js version:', nodeVersion);
        results.correctNodeVersion = false;
      }
      
      // Test PRIA template structure
      const templateCheck = await sandbox.commands.run('ls -la /home/user/template/ 2>/dev/null | wc -l');
      const templateFileCount = parseInt(templateCheck.stdout.trim()) || 0;
      
      const scriptsCheck = await sandbox.commands.run('ls -la /home/user/scripts/ 2>/dev/null | wc -l');
      const scriptsFileCount = parseInt(scriptsCheck.stdout.trim()) || 0;
      
      console.log('📁 Template files count:', templateFileCount);
      console.log('📜 Scripts files count:', scriptsFileCount);
      
      results.templateFiles = templateFileCount;
      results.scriptsFiles = scriptsFileCount;
      results.hasTemplateStructure = templateFileCount > 2 && scriptsFileCount > 2;
      
      if (results.hasTemplateStructure) {
        console.log('✅ PRIA template structure found!');
      } else {
        console.log('⚠️  PRIA template structure not detected');
      }
      
      // Clean up
      await sandbox.kill();
      console.log('🧹 Sandbox terminated');
      
      results.steps[2].status = 'completed';
      results.sdkReconnection = true;
      
    } catch (error) {
      console.log('❌ SDK reconnection failed:', error.message);
      results.steps[2].status = 'failed';
      results.steps[2].error = error.message;
      results.sdkReconnection = false;
    }
    
    // Step 4: Overall assessment
    console.log('\n📊 Step 4: Overall assessment...');
    results.steps.push({ step: 4, name: 'Assessment', status: 'running' });
    
    const allStepsCompleted = results.steps.slice(0, 3).every(step => step.status === 'completed');
    const workaroundWorking = results.templateFound && results.sandboxCreated && results.sdkReconnection;
    const customTemplateWorking = results.correctNodeVersion && results.hasTemplateStructure;
    
    results.assessment = {
      allStepsCompleted,
      workaroundWorking,
      customTemplateWorking,
      overallSuccess: workaroundWorking && customTemplateWorking
    };
    
    if (results.assessment.overallSuccess) {
      console.log('🎉 SUCCESS! CLI workaround is fully functional');
      console.log('✅ Custom template sandbox creation works via CLI');
      console.log('✅ SDK can reconnect and operate on CLI-created sandboxes');
      console.log('✅ Custom template features (Node.js v22, PRIA files) are working');
      results.success = true;
    } else {
      console.log('⚠️  PARTIAL SUCCESS - Some issues detected:');
      if (!workaroundWorking) console.log('  - CLI workaround has issues');
      if (!customTemplateWorking) console.log('  - Custom template not working properly');
    }
    
    results.steps[3].status = 'completed';
    
    console.log('\n📋 Summary:');
    console.log(`Template Found: ${results.templateFound ? '✅' : '❌'}`);
    console.log(`Sandbox Created: ${results.sandboxCreated ? '✅' : '❌'}`);
    console.log(`SDK Reconnection: ${results.sdkReconnection ? '✅' : '❌'}`);
    console.log(`Correct Node Version: ${results.correctNodeVersion ? '✅' : '❌'}`);
    console.log(`PRIA Structure: ${results.hasTemplateStructure ? '✅' : '❌'}`);
    console.log(`Overall Success: ${results.success ? '🎉 YES' : '❌ NO'}`);
    
    return results;
    
  } catch (error) {
    console.error('\n💥 Test failed with error:', error.message);
    results.error = error.message;
    return results;
  }
}

function runCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...options.env };
    const timeout = options.timeout || 15000;
    const allowTerminalError = options.allowTerminalError || false;
    
    console.log(`  Running: ${command}`);
    
    const child = spawn('cmd', ['/c', command], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env
    });
    
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeout);
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      // Don't spam console with all output
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      clearTimeout(timer);
      
      if (timedOut) {
        reject(new Error(`Command timed out after ${timeout}ms`));
      } else if (code === 0) {
        resolve({ stdout, stderr, code });
      } else if (allowTerminalError && extractSandboxId(stdout)) {
        // Special case: E2B spawn command may fail due to terminal issues but still create sandbox
        console.log('  ℹ️  Command had terminal error but sandbox was created');
        resolve({ stdout, stderr, code });
      } else {
        const error = new Error(`Command failed with exit code ${code}`);
        error.output = stdout + stderr;
        reject(error);
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function extractSandboxId(output) {
  const patterns = [
    /connecting to template [^\s]+ with sandbox ID ([a-z0-9]+)/i,
    /sandbox ID\s+([a-z0-9]+)/i,
    /sandbox\s+([a-z0-9]{15,})/i
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match && match[1]) {
      const sandboxId = match[1].trim();
      if (sandboxId.length >= 15 && /^[a-z0-9]+$/.test(sandboxId)) {
        return sandboxId;
      }
    }
  }

  return null;
}

// Run the test
testFinalCLIWorkaround()
  .then(results => {
    console.log('\n📄 Test Results:', JSON.stringify(results, null, 2));
    process.exit(results.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });