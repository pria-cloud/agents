#!/usr/bin/env node
/**
 * Daytona Scaffold Deployment Script (Node.js)
 * Creates a Daytona sandbox from the scaffold application
 */

const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function installDaytonaSDK() {
    try {
        // Check if SDK is already installed
        require('@daytonaio/sdk');
        return true;
    } catch (error) {
        console.log('📦 Installing Daytona SDK...');
        try {
            await execAsync('npm install @daytonaio/sdk');
            return true;
        } catch (installError) {
            console.error('❌ Failed to install Daytona SDK:', installError.message);
            return false;
        }
    }
}

async function deployScaffoldToDaytona(apiKey, repoUrl) {
    try {
        // Import Daytona SDK
        const { Daytona } = require('@daytonaio/sdk');
        
        // Set API key
        process.env.DAYTONA_API_KEY = apiKey;
        
        const daytona = new Daytona();
        
        console.log('🚀 Creating Daytona sandbox for scaffold application...');
        
        // Create sandbox from git repository
        const sandbox = await daytona.create({
            repository: repoUrl,
            branch: 'main', // or your default branch
            autoStopInterval: 0, // Keep running indefinitely
            resources: {
                cpu: 2,    // 2 CPU cores
                memory: 4, // 4GB RAM
                disk: 8,   // 8GB disk
            },
            labels: {
                project: 'scaffold-app',
                type: 'nextjs-development',
                'api-enabled': 'true'
            }
        });
        
        console.log('✅ Sandbox created successfully!');
        console.log(`📋 Sandbox ID: ${sandbox.id}`);
        console.log('🌐 Sandbox URL: Will be available once started');
        
        // Get sandbox details
        const rootDir = await sandbox.getUserRootDir();
        console.log(`📁 Root directory: ${rootDir}`);
        
        console.log('\n🔧 Installing dependencies...');
        // Install dependencies
        try {
            const installResult = await sandbox.process.run('npm install');
            if (installResult.exitCode === 0) {
                console.log('✅ Dependencies installed successfully');
            } else {
                console.log(`❌ Failed to install dependencies: ${installResult.stderr}`);
            }
        } catch (error) {
            console.log(`❌ Error installing dependencies: ${error.message}`);
        }
        
        console.log('\n🏗️ Building application...');
        // Build the application
        try {
            const buildResult = await sandbox.process.run('npm run build');
            if (buildResult.exitCode === 0) {
                console.log('✅ Application built successfully');
            } else {
                console.log(`❌ Build failed: ${buildResult.stderr}`);
            }
        } catch (error) {
            console.log(`❌ Error building application: ${error.message}`);
        }
        
        console.log('\n🚀 Starting development server...');
        // Start the development server
        try {
            await sandbox.process.run('npm run dev', { background: true });
            console.log('✅ Development server started');
        } catch (error) {
            console.log(`❌ Error starting dev server: ${error.message}`);
        }
        
        console.log('\n🎉 Scaffold application deployed to Daytona!');
        console.log('🔗 Access your application through Daytona\'s preview URL');
        console.log(`🛠️ Sandbox ID: ${sandbox.id}`);
        
        return sandbox;
        
    } catch (error) {
        console.error('❌ Error deploying to Daytona:', error.message);
        return null;
    }
}

async function createFromCurrentDirectory(apiKey) {
    // Check if current directory is a git repository
    if (!fs.existsSync('.git')) {
        console.log('❌ Current directory is not a git repository');
        console.log('💡 Please run this from your scaffold repository root, or provide a git URL');
        return null;
    }
    
    // Get the remote origin URL
    try {
        const { stdout } = await execAsync('git remote get-url origin');
        const repoUrl = stdout.trim();
        console.log(`📁 Detected repository: ${repoUrl}`);
        return await deployScaffoldToDaytona(apiKey, repoUrl);
    } catch (error) {
        console.log('❌ Could not get git remote URL:', error.message);
        return null;
    }
}

async function main() {
    const API_KEY = 'dtn_9a351cb5107703f573434ff12e6571768fd8ad963188b40c8ec65cf0f173be63';
    
    console.log('🌟 Daytona Scaffold Deployment');
    console.log('=' .repeat(40));
    
    // Install SDK if needed
    const sdkInstalled = await installDaytonaSDK();
    if (!sdkInstalled) {
        console.log('❌ Could not install Daytona SDK. Please install manually: npm install @daytonaio/sdk');
        process.exit(1);
    }
    
    let sandbox;
    
    if (process.argv.length > 2) {
        // Git repository URL provided
        const repoUrl = process.argv[2];
        sandbox = await deployScaffoldToDaytona(API_KEY, repoUrl);
    } else {
        // Try to deploy from current directory
        sandbox = await createFromCurrentDirectory(API_KEY);
    }
    
    if (sandbox) {
        console.log('\n📋 Next steps:');
        console.log('1. Access Daytona dashboard to view your sandbox');
        console.log(`2. Use sandbox ID '${sandbox.id}' for further operations`);
        console.log('3. Connect to the development server via Daytona\'s preview');
        console.log('4. Use the APIs we built for hot-swapping files and GitHub imports');
    } else {
        console.log('❌ Deployment failed. Please check the errors above.');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
} 