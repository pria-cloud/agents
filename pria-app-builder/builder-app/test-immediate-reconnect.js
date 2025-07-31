/**
 * Test immediate E2B SDK reconnection to understand timing issues
 */

const { Sandbox } = require('e2b');
const { spawn } = require('child_process');
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

async function testImmediateReconnect() {
  console.log('🧪 Testing immediate SDK reconnection patterns\n');
  
  const templateId = process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2';
  console.log('Template ID:', templateId);
  console.log('API Key:', process.env.E2B_API_KEY ? 'present' : 'missing');
  
  try {
    // Test 1: Create sandbox using SDK directly (should fail with custom template)
    console.log('\n📦 Test 1: Direct SDK creation with custom template...');
    try {
      const sdkSandbox = await Sandbox.create({ template: templateId });
      console.log('✅ SDK creation succeeded');
      console.log('📍 SDK Sandbox ID:', sdkSandbox.sandboxId);
      
      // Test the sandbox
      const nodeResult = await sdkSandbox.commands.run('node --version');
      console.log('🔧 Node version:', nodeResult.stdout.trim());
      
      await sdkSandbox.kill();
      console.log('🧹 SDK sandbox terminated');
      
    } catch (error) {
      console.log('❌ SDK creation failed:', error.message);
    }
    
    // Test 2: Create with base template to verify SDK works
    console.log('\n📦 Test 2: SDK creation with base template...');
    try {
      const baseSandbox = await Sandbox.create({ template: 'nodejs' });
      console.log('✅ Base template creation succeeded');
      console.log('📍 Base Sandbox ID:', baseSandbox.sandboxId);
      
      const nodeResult = await baseSandbox.commands.run('node --version');
      console.log('🔧 Node version:', nodeResult.stdout.trim());
      
      await baseSandbox.kill();
      console.log('🧹 Base sandbox terminated');
      
    } catch (error) {
      console.log('❌ Base template creation failed:', error.message);
    }
    
    // Test 3: Explore available templates via SDK
    console.log('\n📦 Test 3: Check SDK template availability...');
    try {
      // Try to see what happens when we list templates via SDK methods
      console.log('Sandbox static methods:', Object.getOwnPropertyNames(Sandbox));
      console.log('Checking if SDK has template listing capability...');
      
      // Try creating with an invalid template to see error message
      try {
        await Sandbox.create({ template: 'invalid-template-id-123' });
      } catch (error) {
        console.log('❌ Invalid template error:', error.message);
        console.log('This helps us understand SDK template validation');
      }
      
    } catch (error) {
      console.log('❌ SDK template exploration failed:', error.message);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testImmediateReconnect()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test runner error:', error);
    process.exit(1);
  });