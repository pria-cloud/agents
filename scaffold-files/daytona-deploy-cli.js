#!/usr/bin/env node
/**
 * Daytona CLI-based Deployment Script
 * Uses Daytona CLI instead of SDK to avoid dependency conflicts
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function checkDaytonaCLI() {
    try {
        const { stdout } = await execAsync('daytona version');
        console.log('✅ Daytona CLI found:', stdout.trim());
        return true;
    } catch (error) {
        console.log('❌ Daytona CLI not found. Installing...');
        return await installDaytonaCLI();
    }
}

async function installDaytonaCLI() {
    console.log('📦 Installing Daytona CLI...');
    
    try {
        // Try different installation methods based on platform
        if (process.platform === 'win32') {
            // Windows installation
            await execAsync('powershell -Command "& {iwr -useb https://download.daytona.io/install.ps1 | iex}"');
        } else {
            // Unix-based systems
            await execAsync('curl -Ls https://download.daytona.io/install.sh | bash');
        }
        
        console.log('✅ Daytona CLI installed successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to install Daytona CLI automatically');
        console.log('💡 Please install manually:');
        console.log('   Windows: https://docs.daytona.io/installation/windows');
        console.log('   macOS/Linux: curl -Ls https://download.daytona.io/install.sh | bash');
        return false;
    }
}

async function deployWithCLI(apiKey, repoUrl) {
    try {
        console.log('🚀 Setting up Daytona environment...');
        
        // Set API key
        process.env.DAYTONA_API_KEY = apiKey;
        
        console.log('🌐 Creating sandbox from repository...');
        
        // Create sandbox using CLI
        const createCommand = `daytona create "${repoUrl}" --cpu 2 --memory 4G --disk 8G --auto-stop 0`;
        const { stdout: createOutput } = await execAsync(createCommand);
        
        console.log('✅ Sandbox created successfully!');
        console.log(createOutput);
        
        // Extract sandbox ID from output (this may vary based on CLI output format)
        const sandboxIdMatch = createOutput.match(/Sandbox ID: ([a-zA-Z0-9-]+)/);
        const sandboxId = sandboxIdMatch ? sandboxIdMatch[1] : 'unknown';
        
        console.log('📋 Sandbox ID:', sandboxId);
        
        if (sandboxId !== 'unknown') {
            console.log('🔧 Setting up development environment...');
            
            // Connect to sandbox and run setup commands
            const setupCommands = [
                'npm install',
                'npm run build',
                'npm run dev &'  // Run in background
            ];
            
            for (const command of setupCommands) {
                console.log(`⚡ Running: ${command}`);
                try {
                    const execCommand = `daytona exec "${sandboxId}" -- ${command}`;
                    const { stdout } = await execAsync(execCommand);
                    console.log(stdout);
                } catch (cmdError) {
                    console.log(`⚠️ Command "${command}" had issues:`, cmdError.message);
                }
            }
        }
        
        console.log('\n🎉 Scaffold application deployed to Daytona!');
        console.log('🔗 Access your application through Daytona\'s preview URL');
        console.log(`🛠️ Sandbox ID: ${sandboxId}`);
        
        // List sandboxes to show current status
        console.log('\n📋 Current sandboxes:');
        const { stdout: listOutput } = await execAsync('daytona sandbox list');
        console.log(listOutput);
        
        return sandboxId;
        
    } catch (error) {
        console.error('❌ Error deploying with CLI:', error.message);
        return null;
    }
}

async function createFromCurrentDirectory(apiKey) {
    // Check if current directory or parent directories contain a git repository
    let gitRoot = process.cwd();
    let foundGit = false;
    
    // Check up to 5 parent directories
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(gitRoot, '.git'))) {
            foundGit = true;
            break;
        }
        const parent = path.dirname(gitRoot);
        if (parent === gitRoot) break; // Reached filesystem root
        gitRoot = parent;
    }
    
    if (!foundGit) {
        console.log('❌ Current directory is not a git repository');
        console.log('💡 Please run this from your scaffold repository root, or provide a git URL');
        return null;
    }
    
    console.log(`📁 Found git repository at: ${gitRoot}`);
    process.chdir(gitRoot); // Change to git root directory
    
    // Get the remote origin URL
    try {
        const { stdout } = await execAsync('git remote get-url origin');
        const repoUrl = stdout.trim();
        console.log(`📁 Detected repository: ${repoUrl}`);
        return await deployWithCLI(apiKey, repoUrl);
    } catch (error) {
        console.log('❌ Could not get git remote URL:', error.message);
        return null;
    }
}

async function main() {
    const API_KEY = process.env.DAYTONA_API_KEY || process.argv[2];
    
    if (!API_KEY) {
        console.error('❌ DAYTONA_API_KEY environment variable or command line argument required');
        console.error('Usage: node daytona-deploy-cli.js [your-api-key]');
        console.error('   OR: DAYTONA_API_KEY=your-key node daytona-deploy-cli.js');
        process.exit(1);
    }
    
    console.log('🌟 Daytona CLI-based Scaffold Deployment');
    console.log('=' .repeat(45));
    
    // Check if Daytona CLI is available
    const cliAvailable = await checkDaytonaCLI();
    if (!cliAvailable) {
        console.log('❌ Cannot proceed without Daytona CLI. Please install it manually.');
        process.exit(1);
    }
    
    let sandboxId;
    
    if (process.argv.length > 2) {
        // Git repository URL provided
        const repoUrl = process.argv[2];
        sandboxId = await deployWithCLI(API_KEY, repoUrl);
    } else {
        // Try to deploy from current directory
        sandboxId = await createFromCurrentDirectory(API_KEY);
    }
    
    if (sandboxId) {
        console.log('\n📋 Next steps:');
        console.log('1. Access Daytona dashboard to view your sandbox');
        console.log(`2. Use sandbox ID '${sandboxId}' for further operations`);
        console.log('3. Connect to the development server via Daytona\'s preview');
        console.log('4. Use the APIs we built for hot-swapping files and GitHub imports');
        console.log('\n🔧 Useful CLI commands:');
        console.log(`   daytona sandbox list`);
        console.log(`   daytona code "${sandboxId}"`);
        console.log(`   daytona exec "${sandboxId}" -- npm run dev`);
    } else {
        console.log('❌ Deployment failed. Please check the errors above.');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
} 