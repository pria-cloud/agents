// Test the E2B template configuration to ensure it's using the correct template ID
const { getE2BSandboxConfig } = require('./builder-app/lib/e2b/template-config.ts');

// This won't work directly since it's TypeScript, so let's test the environment variable
console.log('Environment Variables:');
console.log('E2B_API_KEY:', process.env.E2B_API_KEY ? 'Set' : 'Not set');
console.log('E2B_TEMPLATE_ID:', process.env.E2B_TEMPLATE_ID || 'Not set');

// Expected template ID from our custom template
const expectedTemplateId = 'go8un62yavi0der0vec2';
console.log('Expected template ID:', expectedTemplateId);

// Check if the environment variable matches
if (process.env.E2B_TEMPLATE_ID === expectedTemplateId) {
  console.log('✅ E2B_TEMPLATE_ID is correctly set to custom template');
} else {
  console.log('❌ E2B_TEMPLATE_ID is not set or incorrect');
  console.log('Current value:', process.env.E2B_TEMPLATE_ID);
  console.log('Expected value:', expectedTemplateId);
}