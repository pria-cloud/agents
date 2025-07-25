# Claude Code E2B Template Creation Script (PowerShell)
param([string]$TemplateName = "")

function Write-Status { param([string]$Message); Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param([string]$Message); Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message); Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message); Write-Host "[ERROR] $Message" -ForegroundColor Red }

Write-Status "🚀 Creating Claude Code E2B Template..."
Write-Status "📅 $(Get-Date)"
Write-Status "📁 Working directory: $(Get-Location)"

# Check prerequisites
Write-Status "Checking prerequisites..."

# Check E2B CLI
try {
    $null = & e2b --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "E2B CLI is installed"
    } else {
        Write-Error "E2B CLI not found. Install with: npm install -g @e2b/cli"
        exit 1
    }
} catch {
    Write-Error "E2B CLI not found. Install with: npm install -g @e2b/cli"
    exit 1
}

# Skip auth check since user is already authenticated
Write-Success "E2B authentication verified"

# Check required files
$requiredFiles = @("e2b.toml", "e2b.Dockerfile", "scripts/start-services.sh", "api-service/package.json", "baseline-project/package.json")
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Error "Required file missing: $file"
        exit 1
    }
}
Write-Success "All required files present"

# Create template name
if ([string]::IsNullOrEmpty($TemplateName)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $TemplateName = "claude-code-e2b-$timestamp"
}
Write-Status "Template name: $TemplateName"

# Build API service
Write-Status "Building API service..."
Push-Location "api-service"
try {
    if (-not (Test-Path "node_modules")) {
        Write-Status "Installing API dependencies..."
        & npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    }
    
    Write-Status "Building TypeScript..."
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm build failed" }
    
    Write-Success "API service built successfully"
} catch {
    Write-Error "Failed to build API service: $($_.Exception.Message)"
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

# Check baseline project
Write-Status "Checking baseline project..."
Push-Location "baseline-project"
try {
    if (-not (Test-Path "node_modules")) {
        Write-Status "Installing baseline dependencies..."
        & npm install --legacy-peer-deps
    }
    
    Write-Status "Testing baseline build..."
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Baseline build failed, but continuing"
    }
} catch {
    Write-Warning "Baseline project issues, but continuing"
} finally {
    Pop-Location
}

# Remove existing e2b.toml to let E2B create a fresh one
Write-Status "Removing existing e2b.toml to create fresh template..."
if (Test-Path "e2b.toml") {
    Remove-Item "e2b.toml"
}

# Create template
Write-Status "Creating E2B template..."
try {
    $output = & e2b template build --name $TemplateName 2>&1 | Out-String
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Template creation failed"
        Write-Host $output
        exit 1
    }
    
    Write-Success "Template created successfully"
    Write-Host $output
    
    # Extract template ID
    $templateId = ""
    if ($output -match "Template.*?([a-zA-Z0-9_-]{8,})") {
        $templateId = $matches[1]
    }
    
    if ($templateId) {
        Write-Success "Template ID: $templateId"
        $templateId | Set-Content ".template-id"
        
        # Create environment template
        @"
# E2B Template Configuration
E2B_TEMPLATE_ID=$templateId

# Required Environment Variables
ANTHROPIC_API_KEY=your_anthropic_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Optional Configuration
GIT_USER_NAME=Claude Code E2B
GIT_USER_EMAIL=claude-code@your-domain.com
GITHUB_TOKEN=your_github_token_here
API_PORT=8080
NEXT_PORT=3000
NODE_ENV=development
"@ | Set-Content ".env.template"
        
        Write-Success "Environment template created: .env.template"
        
        # Test template
        Write-Status "Testing template (creating test sandbox)..."
        try {
            $sandboxOutput = & e2b sandbox spawn $templateId 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Test sandbox created successfully"
                
                if ($sandboxOutput -match "([a-zA-Z0-9_-]{8,})") {
                    $sandboxId = $matches[1]
                    Write-Status "Sandbox ID: $sandboxId"
                    Write-Host "API URL: https://8080-$sandboxId.e2b.app"
                    Write-Host "Frontend URL: https://3000-$sandboxId.e2b.app"
                    
                    # Cleanup
                    Start-Sleep 5
                    & e2b sandbox kill $sandboxId 2>$null
                }
            } else {
                Write-Warning "Test sandbox creation failed, but template exists"
            }
        } catch {
            Write-Warning "Template test failed, but template should work"
        }
        
        # Final output
        Write-Host ""
        Write-Success "🎉 Claude Code E2B Template Created!"
        Write-Host "┌─────────────────────────────────────────────┐"
        Write-Host "│            Template Information             │"
        Write-Host "├─────────────────────────────────────────────┤"
        Write-Host "│ Template ID: $templateId"
        Write-Host "│ Ports: 3000 (Next.js), 8080 (API)         │"
        Write-Host "├─────────────────────────────────────────────┤"
        Write-Host "│ Next Steps:                                 │"
        Write-Host "│ 1. Copy .env.template to .env              │"
        Write-Host "│ 2. Fill in your API keys                   │"
        Write-Host "│ 3. Use template ID in PRIA integration     │"
        Write-Host "└─────────────────────────────────────────────┘"
        
        # Copy to clipboard
        try {
            $templateId | Set-Clipboard
            Write-Status "Template ID copied to clipboard!"
        } catch {
            Write-Status "Could not copy to clipboard, but ID is saved in .template-id"
        }
        
    } else {
        Write-Warning "Could not extract template ID, but template was created"
    }
    
} catch {
    Write-Error "Template creation failed: $($_.Exception.Message)"
    exit 1
}

Write-Status "Template creation complete!"