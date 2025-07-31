/**
 * Deep exploration of E2B SDK to find alternative ways to use custom templates
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

async function exploreSDK() {
  console.log('🔍 Deep E2B SDK exploration\n');
  
  const templateId = process.env.E2B_TEMPLATE_ID;
  console.log('Custom Template ID:', templateId);
  
  try {
    // Explore Sandbox class properties and methods
    console.log('\n📊 Sandbox Class Analysis:');
    console.log('Static properties:', Object.getOwnPropertyNames(Sandbox));
    console.log('Static property descriptors:');
    
    Object.getOwnPropertyNames(Sandbox).forEach(prop => {
      const descriptor = Object.getOwnPropertyDescriptor(Sandbox, prop);
      if (descriptor && typeof descriptor.value === 'function') {
        console.log(`  ${prop}(): function`);
      } else if (descriptor) {
        console.log(`  ${prop}:`, typeof descriptor.value);
      }
    });
    
    // Test different creation patterns
    console.log('\n🧪 Testing different creation patterns:');
    
    // Pattern 1: Basic create
    console.log('\n1. Basic create with custom template:');
    try {
      const sandbox1 = await Sandbox.create({ template: templateId });
      console.log('  ✅ Created:', sandbox1.sandboxId);
      
      // Check metadata
      console.log('  📊 Sandbox metadata:');
      console.log('    - ID:', sandbox1.sandboxId);
      console.log('    - Template (actual):', sandbox1.template || 'unknown');
      
      // Check properties
      const sandboxProps = Object.getOwnPropertyNames(sandbox1);
      console.log('  📊 Sandbox instance properties:', sandboxProps);
      
      // Check prototype methods
      const sandboxMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(sandbox1));
      console.log('  📊 Sandbox instance methods:', sandboxMethods);
      
      await sandbox1.kill();
      
    } catch (error) {
      console.log('  ❌ Failed:', error.message);
    }
    
    // Pattern 2: Try with different option formats
    console.log('\n2. Alternative option formats:');
    
    const alternativeOptions = [
      { templateId: templateId },
      { templateID: templateId },
      { customTemplate: templateId },
      { template: templateId, templateId: templateId },
      { template: templateId, metadata: { templateId: templateId } }
    ];
    
    for (let i = 0; i < alternativeOptions.length; i++) {
      const options = alternativeOptions[i];
      console.log(`  Testing option ${i + 1}:`, JSON.stringify(options));
      
      try {
        const sandbox = await Sandbox.create(options);
        const nodeResult = await sandbox.commands.run('node --version');
        console.log(`    ✅ Created: ${sandbox.sandboxId}, Node: ${nodeResult.stdout.trim()}`);
        await sandbox.kill();
      } catch (error) {
        console.log(`    ❌ Failed: ${error.message}`);
      }
    }
    
    // Pattern 3: Check default template behavior
    console.log('\n3. Default template analysis:');
    console.log('  Default template:', Sandbox.defaultTemplate);
    
    // Pattern 4: Try to find any template-related configuration
    console.log('\n4. Environmental template configuration:');
    console.log('  E2B_API_KEY:', process.env.E2B_API_KEY ? 'present' : 'missing');
    console.log('  E2B_TEMPLATE_ID:', process.env.E2B_TEMPLATE_ID);
    console.log('  E2B_DEFAULT_TEMPLATE:', process.env.E2B_DEFAULT_TEMPLATE || 'not set');
    
    // Pattern 5: Try creating with no template specified
    console.log('\n5. No template specified:');
    try {
      const sandbox = await Sandbox.create({});
      const nodeResult = await sandbox.commands.run('node --version');
      console.log(`  ✅ Default template: Node ${nodeResult.stdout.trim()}`);
      await sandbox.kill();
    } catch (error) {
      console.log(`  ❌ Failed: ${error.message}`);
    }
    
    // Pattern 6: Verify our template exists by trying obvious invalid ones
    console.log('\n6. Template validation test:');
    const testTemplates = [
      'definitely-invalid-template-123',
      'nodejs',
      'python',
      templateId
    ];
    
    for (const testTemplate of testTemplates) {
      try {
        const sandbox = await Sandbox.create({ template: testTemplate });
        const nodeResult = await sandbox.commands.run('node --version');
        console.log(`  ✅ ${testTemplate}: Node ${nodeResult.stdout.trim()}`);
        await sandbox.kill();
      } catch (error) {
        console.log(`  ❌ ${testTemplate}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('💥 Exploration failed:', error.message);
  }
}

exploreSDK()
  .then(() => {
    console.log('\n✅ SDK exploration completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Explorer error:', error);
    process.exit(1);
  });