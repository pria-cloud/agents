#!/usr/bin/env node

const https = require('https');
const http = require('http');

const sandboxId = '51409ff3-a06b-4a7f-9b92-017fe466cbe3';
const port = '3000';

// Common runner patterns
const runners = [
    'h7890.daytona.work',
    'us.daytona.work',
    'eu.daytona.work',
    'ap.daytona.work',
    'daytona.work'
];

console.log(`🔍 Testing preview URLs for sandbox: ${sandboxId}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testUrl(url) {
    return new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.get(url, { timeout: 5000 }, (res) => {
            resolve({
                url,
                status: res.statusCode,
                accessible: res.statusCode < 400
            });
        });
        
        req.on('error', () => {
            resolve({
                url,
                status: 'ERROR',
                accessible: false
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({
                url,
                status: 'TIMEOUT',
                accessible: false
            });
        });
    });
}

async function testAllUrls() {
    console.log('🌐 Testing URLs...\n');
    
    for (const runner of runners) {
        const url = `https://${port}-sandbox-${sandboxId}.${runner}`;
        console.log(`Testing: ${url}`);
        
        const result = await testUrl(url);
        
        if (result.accessible) {
            console.log(`✅ ACCESSIBLE! Status: ${result.status}`);
            console.log(`🎉 Your preview URL: ${url}\n`);
            return url;
        } else {
            console.log(`❌ Not accessible (${result.status})\n`);
        }
    }
    
    console.log('🚨 No accessible URLs found. The sandbox may need to be started first.');
    console.log('\n💡 Next steps:');
    console.log('1. Go to Daytona dashboard');
    console.log('2. Start your sandbox if it\'s stopped');
    console.log('3. Check the preview/ports section for the exact URL');
    
    return null;
}

testAllUrls().catch(console.error); 