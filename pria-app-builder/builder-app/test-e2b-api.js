const { Sandbox } = require('e2b');

async function testE2BAPI() {
  console.log('Testing E2B SDK API...');
  
  // Check what methods are available
  console.log('Sandbox constructor properties:', Object.getOwnPropertyNames(Sandbox));
  console.log('Sandbox prototype methods:', Object.getOwnPropertyNames(Sandbox.prototype));
  
  // Try creating a simple sandbox to see the API
  try {
    const sandbox = await Sandbox.create({ template: 'nodejs' });
    console.log('Sandbox created:', sandbox.sandboxId);
    console.log('Sandbox methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(sandbox)));
    
    // Try to find reconnect method
    if (typeof sandbox.constructor.reconnect === 'function') {
      console.log('✅ Sandbox.reconnect is available');
    } else if (typeof Sandbox.connect === 'function') {
      console.log('✅ Sandbox.connect is available');
    } else {
      console.log('❌ No reconnect/connect method found');
    }
    
    await sandbox.kill();
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testE2BAPI();