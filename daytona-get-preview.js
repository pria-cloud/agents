#!/usr/bin/env node

const { Daytona } = require('@daytonaio/sdk');
require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

async function getPreviewInfo() {
    // Get API key and sandbox ID from command line or environment
    const apiKey = process.argv[2] || process.env.DAYTONA_API_KEY;
    const sandboxId = process.argv[3];
    
    if (!apiKey) {
        console.log('❌ DAYTONA_API_KEY environment variable or command line argument required');
        process.exit(1);
    }
    
    if (!sandboxId) {
        console.log('❌ Sandbox ID required as second argument');
        console.log('Usage: node daytona-get-preview.js <api_key> <sandbox_id>');
        process.exit(1);
    }
    
    try {
        console.log(`🔍 Getting preview info for sandbox: ${sandboxId}`);
        
        // Initialize Daytona SDK
        const daytona = new Daytona();
        
        // Get sandbox instance
        console.log('📡 Connecting to sandbox...');
        const sandbox = await daytona.findOne(sandboxId);
        
        // Get preview link for port 3000
        console.log('🌐 Getting preview URL for port 3000...');
        const previewInfo = await sandbox.getPreviewLink(3000);
        
        console.log('\n🎉 SUCCESS! Preview information retrieved:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🔗 Preview URL: ${previewInfo.url}`);
        console.log(`🔑 Auth Token: ${previewInfo.token}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        console.log('\n📋 Access Methods:');
        console.log(`🌐 Browser: ${previewInfo.url}`);
        console.log(`💻 cURL: curl -H "x-daytona-preview-token: ${previewInfo.token}" ${previewInfo.url}`);
        
        return {
            url: previewInfo.url,
            token: previewInfo.token
        };
        
    } catch (error) {
        console.error('❌ Error getting preview info:', error.message);
        
        if (error.message.includes('not found')) {
            console.log('\n💡 Possible solutions:');
            console.log('1. Check if the sandbox ID is correct');
            console.log('2. Ensure the sandbox is started in Daytona dashboard');
            console.log('3. Wait a few moments for the sandbox to fully initialize');
        }
        
        process.exit(1);
    }
}

// Run the function
getPreviewInfo().catch(console.error); 