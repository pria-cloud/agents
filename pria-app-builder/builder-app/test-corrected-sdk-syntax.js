/**
 * Test Corrected E2B SDK Syntax
 * Based on Context7 research - template should be first parameter, not in options object
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

async function testCorrectedSDKSyntax() {
  console.log('🧪 Testing Corrected E2B SDK Syntax\n');
  
  const templateId = process.env.E2B_TEMPLATE_ID;
  console.log('Template ID:', templateId);
  console.log('API Key:', process.env.E2B_API_KEY ? 'present' : 'missing');
  
  const results = {
    oldSyntaxResult: null,
    newSyntaxResult: null,
    comparison: null
  };
  
  try {
    // Test 1: OLD syntax (template in options object)
    console.log('\n📦 Test 1: OLD Syntax - Sandbox.create({ template: "id" })');
    try {
      const oldSandbox = await Sandbox.create({ template: templateId });
      const oldNodeResult = await oldSandbox.commands.run('node --version');
      const oldNodeVersion = oldNodeResult.stdout.trim();
      
      console.log('✅ OLD syntax succeeded');
      console.log('📍 Sandbox ID:', oldSandbox.sandboxId);
      console.log('🔧 Node version:', oldNodeVersion);
      
      results.oldSyntaxResult = {
        success: true,
        sandboxId: oldSandbox.sandboxId,
        nodeVersion: oldNodeVersion
      };
      
      await oldSandbox.kill();
      console.log('🧹 OLD syntax sandbox terminated');
      
    } catch (error) {
      console.log('❌ OLD syntax failed:', error.message);
      results.oldSyntaxResult = {
        success: false,
        error: error.message
      };
    }
    
    // Test 2: NEW syntax (template as first parameter)
    console.log('\n📦 Test 2: NEW Syntax - Sandbox.create("template-id", options)');
    try {
      const newSandbox = await Sandbox.create(templateId, {});
      const newNodeResult = await newSandbox.commands.run('node --version');
      const newNodeVersion = newNodeResult.stdout.trim();
      
      console.log('✅ NEW syntax succeeded');
      console.log('📍 Sandbox ID:', newSandbox.sandboxId);
      console.log('🔧 Node version:', newNodeVersion);
      
      results.newSyntaxResult = {
        success: true,
        sandboxId: newSandbox.sandboxId,
        nodeVersion: newNodeVersion
      };
      
      await newSandbox.kill();
      console.log('🧹 NEW syntax sandbox terminated');
      
    } catch (error) {
      console.log('❌ NEW syntax failed:', error.message);
      results.newSyntaxResult = {
        success: false,
        error: error.message
      };
    }
    
    // Test 3: Compare results
    console.log('\n📊 Comparison Analysis:');
    
    if (results.oldSyntaxResult?.success && results.newSyntaxResult?.success) {
      const oldNode = results.oldSyntaxResult.nodeVersion;
      const newNode = results.newSyntaxResult.nodeVersion;
      
      console.log(`OLD syntax Node.js: ${oldNode}`);
      console.log(`NEW syntax Node.js: ${newNode}`);
      
      if (oldNode === newNode) {
        console.log('⚠️  Both syntaxes produce identical results - no difference detected');
        results.comparison = 'identical';
      } else {
        console.log('🎯 SYNTAX DIFFERENCE DETECTED!');
        if (newNode.startsWith('v22.')) {
          console.log('🎉 NEW syntax correctly uses custom template with Node.js v22!');
          results.comparison = 'new_syntax_better';
        } else if (oldNode.startsWith('v22.')) {
          console.log('🎉 OLD syntax correctly uses custom template with Node.js v22!');
          results.comparison = 'old_syntax_better';
        } else {
          console.log('⚠️  Neither syntax uses custom template correctly');
          results.comparison = 'both_failed';
        }
      }
    } else if (results.newSyntaxResult?.success && !results.oldSyntaxResult?.success) {
      console.log('🎯 NEW syntax works, OLD syntax fails - use NEW syntax!');
      results.comparison = 'new_syntax_only';
    } else if (results.oldSyntaxResult?.success && !results.newSyntaxResult?.success) {
      console.log('🎯 OLD syntax works, NEW syntax fails - keep OLD syntax!');
      results.comparison = 'old_syntax_only';
    } else {
      console.log('❌ Both syntaxes failed');
      results.comparison = 'both_failed';
    }
    
    // Test 4: Try alternative parameters for NEW syntax
    console.log('\n📦 Test 3: NEW Syntax with explicit options');
    try {
      const newSandbox2 = await Sandbox.create(templateId, {
        metadata: { source: 'corrected-syntax-test' },
        timeout: 300000
      });
      
      const nodeResult = await newSandbox2.commands.run('node --version');
      const nodeVersion = nodeResult.stdout.trim();
      
      console.log('✅ NEW syntax with options succeeded');
      console.log('📍 Sandbox ID:', newSandbox2.sandboxId);
      console.log('🔧 Node version:', nodeVersion);
      
      // Test for PRIA template files
      const priaCheck = await newSandbox2.commands.run('ls -la /home/user/template/ 2>/dev/null | wc -l');
      const priaFileCount = parseInt(priaCheck.stdout.trim()) || 0;
      
      console.log('📁 PRIA template files:', priaFileCount > 2 ? `${priaFileCount} found` : 'not detected');
      
      if (nodeVersion.startsWith('v22.') && priaFileCount > 2) {
        console.log('🎉 SUCCESS: Custom template working correctly with NEW syntax!');
      }
      
      await newSandbox2.kill();
      
    } catch (error) {
      console.log('❌ NEW syntax with options failed:', error.message);
    }
    
    console.log('\n✅ SDK syntax testing completed');
    console.log('\n📄 Results Summary:', JSON.stringify(results, null, 2));
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testCorrectedSDKSyntax()
  .then(() => {
    console.log('\n✅ Testing completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test runner error:', error);
    process.exit(1);
  });