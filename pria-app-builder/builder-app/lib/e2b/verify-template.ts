/**
 * Template verification utility
 * Use this to test if our E2B custom template is working correctly
 */
import { Sandbox } from 'e2b'
import { E2B_TEMPLATE_CONFIG } from './template-config'

export async function verifyCustomTemplate() {
  console.log(`🔍 Verifying E2B custom template...`)
  console.log(`Template ID: ${E2B_TEMPLATE_CONFIG.TEMPLATE_ID}`)
  
  try {
    // Create a test sandbox
    const sandbox = await Sandbox.create({
      template: E2B_TEMPLATE_CONFIG.TEMPLATE_ID,
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: 60000 // 1 minute timeout for verification
    })
    
    console.log(`✅ Sandbox created successfully with ID: ${sandbox.id}`)
    
    // Check if our custom files exist
    const checks = [
      'ls -la /home/user/',
      'ls -la /home/user/workspace/ 2>/dev/null || echo "No workspace dir"',
      'which node',
      'node --version',
      'which npm',
      'npm --version'
    ]
    
    for (const command of checks) {
      try {
        const result = await sandbox.commands.run(command)
        console.log(`✅ ${command}:`, result.stdout.trim() || result.stderr.trim())
      } catch (error) {
        console.log(`❌ ${command}:`, error.message)
      }
    }
    
    // Close the test sandbox
    await sandbox.close()
    console.log(`🧹 Test sandbox closed`)
    
    return { success: true, templateId: E2B_TEMPLATE_CONFIG.TEMPLATE_ID }
  } catch (error) {
    console.error(`❌ Template verification failed:`, error.message)
    return { success: false, error: error.message }
  }
}

// Export a simple check function for API routes
export function getTemplateInfo() {
  return {
    templateId: E2B_TEMPLATE_CONFIG.TEMPLATE_ID,
    templateName: E2B_TEMPLATE_CONFIG.TEMPLATE_NAME,
    version: E2B_TEMPLATE_CONFIG.TEMPLATE_VERSION,
    isCustomTemplate: E2B_TEMPLATE_CONFIG.TEMPLATE_ID !== 'nodejs'
  }
}