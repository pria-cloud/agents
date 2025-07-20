#!/usr/bin/env node

// Disable SSL certificate verification for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { Daytona } = require('@daytonaio/sdk');
require('dotenv').config();

async function getPreviewLink() {
    const sandboxId = 'ace2b1d2-30b2-4f0b-b0c0-704a00116c95';
    const apiKey = 'dtn_48917f47a7ccd44c830b8a291e336938309a328b1748c77a3fdde9872bf0b45b';
    
    try {
        console.log(`🔍 Getting preview info for sandbox: ${sandboxId}`);
        
        // Set environment variables
        process.env.DAYTONA_API_KEY = apiKey;
        process.env.DAYTONA_API_URL = 'https://api.daytona.io';
        process.env.DAYTONA_TARGET = 'us';
        
        // Initialize Daytona SDK
        const daytona = new Daytona();
        
        // Get the sandbox
        console.log('📡 Connecting to sandbox...');
        const sandbox = await daytona.findOne(sandboxId);
        
        // Get preview link for port 3000 - using the exact code you specified
        console.log('🌐 Getting preview URL for port 3000...');
        const previewInfo = await sandbox.getPreviewLink(3000);

        console.log(`Preview link url: ${previewInfo.url}`);
        console.log(`Preview link token: ${previewInfo.token}`);
        
        console.log('\n🎉 SUCCESS! Your scaffold application is ready!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🔗 Preview URL: ${previewInfo.url}`);
        console.log(`🔑 Auth Token: ${previewInfo.token}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        console.log(`\n📋 Access Methods:`);
        console.log(`🌐 Browser: ${previewInfo.url}`);
        console.log(`💻 cURL: curl -H "x-daytona-preview-token: ${previewInfo.token}" ${previewInfo.url}`);
        
    } catch (error) {
        console.error('❌ Error getting preview info:', error.message);
        console.error('Full error:', error);
    }
}

// Run the function
getPreviewLink().catch(console.error); 