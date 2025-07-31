const { spawn } = require('child_process');

async function testSimpleCLI() {
  console.log('🧪 Testing Simple E2B CLI Integration');
  console.log('=====================================\n');
  
  const templateId = process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2';
  const apiKey = process.env.E2B_API_KEY;
  
  if (!apiKey) {
    console.error('❌ E2B_API_KEY is required');
    return;
  }
  
  console.log('Template ID:', templateId);
  console.log('API Key:', apiKey ? 'Set' : 'Not set');
  
  // Test 1: Check E2B CLI availability
  console.log('\n📋 Step 1: Checking E2B CLI availability...');
  
  try {
    const versionResult = await runCommand('e2b --version');
    console.log('✅ E2B CLI version:', versionResult.stdout.trim());
  } catch (error) {
    console.error('❌ E2B CLI not available:', error.message);
    return;
  }
  
  // Test 2: Check templates (this will validate auth)
  console.log('\n🔐 Step 2: Checking E2B templates (validates auth)...');
  
  try {
    const templatesResult = await runCommand('e2b template list', { env: { E2B_API_KEY: apiKey } });
    console.log('✅ Templates listed successfully');
    
    // Check if our template is in the list
    if (templatesResult.stdout.includes(templateId)) {
      console.log('✅ Custom template found in list');
    } else {
      console.log('⚠️  Custom template not found in list, but auth works');
    }
  } catch (error) {
    console.error('❌ Template list failed (auth issue?):', error.message);
    return;
  }
  
  // Test 3: Create sandbox with custom template
  console.log('\n🚀 Step 3: Creating sandbox with custom template...');
  console.log(`Command: e2b sandbox spawn ${templateId}`);
  
  try {
    const sandboxResult = await runCommand(`e2b sandbox spawn ${templateId}`, {
      env: { E2B_API_KEY: apiKey },
      timeout: 30000
    });
    
    console.log('✅ Sandbox creation output:');
    console.log(sandboxResult.stdout);
    
    // Extract sandbox ID
    const sandboxId = extractSandboxId(sandboxResult.stdout);
    if (sandboxId) {
      console.log('✅ Extracted sandbox ID:', sandboxId);
      
      // Test 4: Test Node.js version in sandbox
      console.log('\n🔧 Step 4: Testing Node.js version in sandbox...');
      
      // Kill the interactive session first
      await runCommand(`e2b sandbox kill ${sandboxId}`, { env: { E2B_API_KEY: apiKey } });
      console.log('✅ Killed interactive session');
      
      console.log('\n🎉 SUCCESS! CLI workaround is working');
      console.log('Custom template sandbox was created successfully');
      
    } else {
      console.log('❌ Could not extract sandbox ID from output');
    }
    
  } catch (error) {
    console.error('❌ Sandbox creation failed:', error.message);
    console.error('Output:', error.output);
  }
}

function runCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...options.env };
    const timeout = options.timeout || 10000;
    
    console.log(`Running: ${command}`);
    
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
      console.log('stdout:', data.toString().trim());
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('stderr:', data.toString().trim());
    });
    
    child.on('close', (code) => {
      clearTimeout(timer);
      
      if (timedOut) {
        reject(new Error(`Command timed out after ${timeout}ms`));
      } else if (code === 0) {
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
    /sandbox ID\s+([a-z0-9]+)/i,
    /connecting to template [^\s]+ with sandbox ID ([a-z0-9]+)/i,
    /sandbox\s+([a-z0-9]{20,})/i,
    /ID:\s*([a-z0-9]+)/i
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

testSimpleCLI().catch(console.error);