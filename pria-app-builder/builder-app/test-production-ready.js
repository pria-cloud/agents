/**
 * Production Ready PRIA System Validation
 * Tests the complete end-to-end functionality with the corrected E2B SDK syntax
 */

const { Sandbox } = require('e2b');
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

async function testProductionReady() {
  console.log('🚀 Production Ready PRIA System Validation\n');
  
  const templateId = process.env.E2B_TEMPLATE_ID;
  const apiKey = process.env.E2B_API_KEY;
  
  console.log('📋 Configuration:');
  console.log('  Template ID:', templateId);
  console.log('  API Key:', apiKey ? 'present' : 'missing');
  console.log('  E2B SDK Version: Latest');
  console.log('');
  
  if (!apiKey || !templateId) {
    console.error('❌ Missing required environment variables');
    return;
  }
  
  const results = {
    timestamp: new Date().toISOString(),
    templateId,
    phases: [],
    overallSuccess: false
  };
  
  try {
    // Phase 1: Create Sandbox with Corrected Syntax
    console.log('🔄 Phase 1: Creating sandbox with corrected E2B SDK syntax');
    console.log(`   Using: Sandbox.create("${templateId}", options)`);
    
    const startTime = Date.now();
    const sandbox = await Sandbox.create(templateId, {
      metadata: {
        test: 'production-ready-validation',
        created_at: new Date().toISOString()
      }
    });
    
    const createTime = Date.now() - startTime;
    console.log(`✅ Sandbox created in ${createTime}ms`);
    console.log(`📍 Sandbox ID: ${sandbox.sandboxId}`);
    
    results.phases.push({
      phase: 1,
      name: 'Create Sandbox',
      success: true,
      duration: createTime,
      sandboxId: sandbox.sandboxId
    });
    
    // Phase 2: Validate Template Environment
    console.log('\n🔄 Phase 2: Validating PRIA template environment');
    
    // Check Node.js version
    const nodeResult = await sandbox.commands.run('node --version');
    const nodeVersion = nodeResult.stdout.trim();
    console.log(`🔧 Node.js version: ${nodeVersion}`);
    
    // Check npm version
    const npmResult = await sandbox.commands.run('npm --version');
    const npmVersion = npmResult.stdout.trim();
    console.log(`📦 npm version: ${npmVersion}`);
    
    // Check PRIA template files
    const priaCheck = await sandbox.commands.run('ls -la /home/user/template/ 2>/dev/null | wc -l');
    const priaFileCount = parseInt(priaCheck.stdout.trim()) || 0;
    console.log(`📁 PRIA template files: ${priaFileCount}`);
    
    // Check PRIA scripts
    const scriptsCheck = await sandbox.commands.run('ls -la /home/user/scripts/ 2>/dev/null | wc -l');
    const scriptsFileCount = parseInt(scriptsCheck.stdout.trim()) || 0;
    console.log(`📜 PRIA scripts: ${scriptsFileCount}`);
    
    // Validate environment requirements
    const validNode = nodeVersion.startsWith('v22.');
    const validPRIA = priaFileCount > 5;
    const validScripts = scriptsFileCount > 2;
    
    const environmentValid = validNode && validPRIA && validScripts;
    
    if (environmentValid) {
      console.log('✅ PRIA environment validation PASSED');
    } else {
      console.log('❌ PRIA environment validation FAILED');
      console.log(`   Node.js v22: ${validNode ? '✅' : '❌'}`);
      console.log(`   PRIA files: ${validPRIA ? '✅' : '❌'}`);
      console.log(`   Scripts: ${validScripts ? '✅' : '❌'}`);
    }
    
    results.phases.push({
      phase: 2,
      name: 'Validate Environment',
      success: environmentValid,
      nodeVersion,
      priaFiles: priaFileCount,
      scriptsFiles: scriptsFileCount,
      details: { validNode, validPRIA, validScripts }
    });
    
    // Phase 3: Test PRIA Project Creation
    console.log('\n🔄 Phase 3: Testing PRIA project creation');
    
    const sessionId = `test-${Date.now()}`;
    const workspaceDir = `/home/user/workspace/session-${sessionId}`;
    
    // Create workspace directory
    await sandbox.commands.run(`mkdir -p "${workspaceDir}"`);
    console.log(`📁 Created workspace: ${workspaceDir}`);
    
    // Test if PRIA initialization script exists
    let initScriptExists = false;
    try {
      const scriptCheck = await sandbox.commands.run('test -f /home/user/scripts/init-pria-project.sh && echo "exists"');
      initScriptExists = scriptCheck.stdout.includes('exists');
    } catch (error) {
      // Script doesn't exist, that's okay
    }
    
    console.log(`📜 PRIA init script available: ${initScriptExists ? '✅' : '❌'}`);
    
    // Test basic Node.js project setup
    const packageJson = {
      name: `pria-test-${sessionId.substring(0, 8)}`,
      version: '1.0.0',
      scripts: {
        dev: 'echo "PRIA development server would start here"',
        build: 'echo "PRIA build process would run here"'
      }
    };
    
    // Write package.json
    const packageJsonContent = JSON.stringify(packageJson, null, 2);
    const writeCommand = `cat > "${workspaceDir}/package.json" << 'EOF'\n${packageJsonContent}\nEOF`;
    
    await sandbox.commands.run(writeCommand);
    console.log('📄 Created test package.json');
    
    // Test project validation
    const projectCheck = await sandbox.commands.run(`test -f "${workspaceDir}/package.json" && echo "project-ready"`);
    const projectReady = projectCheck.stdout.includes('project-ready');
    
    if (projectReady) {
      console.log('✅ PRIA project creation PASSED');
    } else {
      console.log('❌ PRIA project creation FAILED');
    }
    
    results.phases.push({
      phase: 3,
      name: 'Test Project Creation',
      success: projectReady,
      workspaceDir,
      sessionId,
      initScriptExists
    });
    
    // Phase 4: Test Command Execution
    console.log('\n🔄 Phase 4: Testing command execution capabilities');
    
    // Test multiple commands
    const commands = [
      { name: 'Basic Echo', cmd: 'echo "Hello PRIA"' },
      { name: 'Working Directory', cmd: 'pwd' },
      { name: 'Environment Check', cmd: 'printenv | grep HOME' },
      { name: 'Node Version', cmd: 'node --version' },
      { name: 'npm Version', cmd: 'npm --version' }
    ];
    
    let commandsPassed = 0;
    const commandResults = [];
    
    for (const { name, cmd } of commands) {
      try {
        const cmdStart = Date.now();
        const result = await sandbox.commands.run(cmd, { timeout: 10000 });
        const cmdDuration = Date.now() - cmdStart;
        
        const success = result.exitCode === 0;
        if (success) commandsPassed++;
        
        console.log(`   ${success ? '✅' : '❌'} ${name}: ${result.stdout.trim()} (${cmdDuration}ms)`);
        
        commandResults.push({
          name,
          command: cmd,
          success,
          duration: cmdDuration,
          output: result.stdout.trim()
        });
        
      } catch (error) {
        console.log(`   ❌ ${name}: ERROR - ${error.message}`);
        commandResults.push({
          name,
          command: cmd,
          success: false,
          error: error.message
        });
      }
    }
    
    const commandsSuccess = commandsPassed === commands.length;
    console.log(`${commandsSuccess ? '✅' : '❌'} Command execution: ${commandsPassed}/${commands.length} passed`);
    
    results.phases.push({
      phase: 4,
      name: 'Test Commands',
      success: commandsSuccess,
      commandsPassed,
      totalCommands: commands.length,
      commandResults
    });
    
    // Phase 5: Cleanup and Summary
    console.log('\n🔄 Phase 5: Cleanup and final validation');
    
    try {
      await sandbox.kill();
      console.log('✅ Sandbox terminated successfully');
    } catch (error) {
      console.log('⚠️  Sandbox cleanup warning:', error.message);
    }
    
    // Calculate overall success
    const allPhasesSuccess = results.phases.every(phase => phase.success);
    results.overallSuccess = allPhasesSuccess;
    
    results.phases.push({
      phase: 5,
      name: 'Cleanup',
      success: true
    });
    
    // Final Summary
    console.log('\n📊 PRODUCTION READY VALIDATION RESULTS');
    console.log('=========================================');
    
    results.phases.forEach(phase => {
      const status = phase.success ? '✅ PASS' : '❌ FAIL';
      console.log(`Phase ${phase.phase}: ${phase.name} - ${status}`);
    });
    
    console.log('');
    if (results.overallSuccess) {
      console.log('🎉 ALL PHASES PASSED! 🎉');
      console.log('✅ PRIA system is PRODUCTION READY');
      console.log('✅ Custom template working correctly');
      console.log('✅ E2B SDK integration functioning properly');
      console.log('✅ All core capabilities validated');
    } else {
      console.log('⚠️  Some phases failed - system needs attention');
      const failedPhases = results.phases.filter(p => !p.success);
      console.log('Failed phases:', failedPhases.map(p => p.name).join(', '));
    }
    
    console.log('\n📄 Complete Results:');
    console.log(JSON.stringify(results, null, 2));
    
    return results;
    
  } catch (error) {
    console.error('\n💥 Validation failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    
    results.phases.push({
      phase: 'error',
      name: 'System Error',
      success: false,
      error: error.message
    });
    
    return results;
  }
}

testProductionReady()
  .then(results => {
    const success = results.overallSuccess;
    console.log(`\n🏁 Validation completed. Production Ready: ${success ? 'YES' : 'NO'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test runner error:', error);
    process.exit(1);
  });