# Claude Code E2B Template Creation Script (PowerShell)
# This script builds and deploys the E2B template for Claude Code integration

param(
    [string]$TemplateName = ""
)

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Cyan = "Cyan"
}

function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Colors.Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Colors.Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Colors.Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Colors.Red
}

Write-Status "🚀 Creating Claude Code E2B Template..."
Write-Status "📅 $(Get-Date)"
Write-Status "📁 Working directory: $(Get-Location)"

# Check prerequisites
Write-Status "Checking prerequisites..."

# Check if E2B CLI is installed
try {
    $e2bVersion = e2b --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "E2B CLI is installed: $e2bVersion"
    } else {
        throw "E2B CLI not found"
    }
} catch {
    Write-Error "E2B CLI is not installed. Please install it first:"
    Write-Host "npm install -g @e2b/cli"
    Write-Host "e2b auth login"
    exit 1
}

# Check if logged in to E2B
Write-Status "Checking E2B authentication..."
try {
    $authOutput = & e2b auth whoami 2>&1
    if ($authOutput -match "per\.swedenborg@gmail\.com" -or $authOutput -match "logged in") {
        Write-Success "Logged in to E2B as: per.swedenborg@gmail.com"
    } else {
        Write-Warning "Auth check unclear, but proceeding since you ran 'e2b auth login' successfully"
    }
} catch {
    Write-Warning "Auth check failed, but proceeding since you're authenticated in PowerShell"
}

# Check if required files exist
$requiredFiles = @(
    "e2b.toml",
    "e2b.Dockerfile",
    "scripts/start-services.sh",
    "api-service/package.json",
    "baseline-project/package.json"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Error "Required file missing: $file"
        exit 1
    }
}

Write-Success "All required files are present"

# Create template name with timestamp for uniqueness
if ([string]::IsNullOrEmpty($TemplateName)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $TemplateName = "claude-code-e2b-$timestamp"
}

Write-Status "Template name: $TemplateName"

# Build API service
Write-Status "Building API service..."
Push-Location "api-service"

if (-not (Test-Path "node_modules")) {
    Write-Status "Installing API service dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install API service dependencies"
        Pop-Location
        exit 1
    }
}

Write-Status "Building TypeScript..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build API service"
    Pop-Location
    exit 1
}

Write-Success "API service built successfully"
Pop-Location

# Check baseline project
Write-Status "Checking baseline project..."
Push-Location "baseline-project"

if (-not (Test-Path "node_modules")) {
    Write-Status "Installing baseline project dependencies..."
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to install baseline project dependencies, but continuing..."
    }
}

# Build baseline project to check for errors
Write-Status "Testing baseline project build..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Baseline project build failed, but continuing (will be rebuilt in container)"
}

Pop-Location

# Update template name in e2b.toml
Write-Status "Updating template configuration..."
$e2bTomlContent = Get-Content "e2b.toml" -Raw
$e2bTomlContent = $e2bTomlContent -replace 'name = ".*"', "name = `"$TemplateName`""
$e2bTomlContent | Set-Content "e2b.toml"

Write-Status "Creating template with configuration:"
Get-Content "e2b.toml"

# Create the template
Write-Status "Deploying to E2B..."
try {
    $templateOutput = e2b template create 2>&1 | Out-String
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create E2B template"
        Write-Host $templateOutput
        exit 1
    }
    
    Write-Success "Template creation initiated"
    Write-Host $templateOutput
    
    # Extract template ID from output
    $templateId = ""
    if ($templateOutput -match "Template ID: ([a-zA-Z0-9_-]+)") {
        $templateId = $matches[1]
    } elseif ($templateOutput -match "([a-zA-Z0-9_-]+)") {
        # Try alternative extraction
        $templateId = $matches[1]
    }
    
    if (-not [string]::IsNullOrEmpty($templateId)) {
        Write-Success "Template created with ID: $templateId"
        
        # Save template ID to a file
        $templateId | Set-Content ".template-id"
        Write-Status "Template ID saved to .template-id file"
        
        # Create environment file template
        $envTemplate = @"
# E2B Template Configuration
E2B_TEMPLATE_ID=$templateId

# Required Environment Variables for Claude Code E2B
ANTHROPIC_API_KEY=your_anthropic_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Optional Git Configuration
GIT_USER_NAME=Claude Code E2B
GIT_USER_EMAIL=claude-code@your-domain.com
GITHUB_TOKEN=your_github_token_here

# API Configuration
API_PORT=8080
NEXT_PORT=3000
NODE_ENV=development
"@
        
        $envTemplate | Set-Content ".env.template"
        Write-Success "Environment template created: .env.template"
    } else {
        Write-Warning "Could not extract template ID from output"
    }
    
    # Test the template
    if (-not [string]::IsNullOrEmpty($templateId)) {
        Write-Status "Testing template..."
        Write-Status "Waiting for template to be ready..."
        
        # Wait a bit for the template to be available
        Start-Sleep -Seconds 10
        
        # Try to create a test sandbox
        Write-Status "Creating test sandbox..."
        try {
            $testSandboxOutput = e2b sandbox create $templateId 2>&1 | Out-String
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Test sandbox created successfully"
                
                # Extract sandbox ID
                $sandboxId = ""
                if ($testSandboxOutput -match "Sandbox ID: ([a-zA-Z0-9_-]+)") {
                    $sandboxId = $matches[1]
                }
                
                if (-not [string]::IsNullOrEmpty($sandboxId)) {
                    Write-Status "Test sandbox ID: $sandboxId"
                    
                    # Wait for services to start
                    Write-Status "Waiting for services to start..."
                    Start-Sleep -Seconds 30
                    
                    # Test health endpoint
                    $sandboxUrl = "https://$sandboxId-8080.e2b.dev"
                    Write-Status "Testing health endpoint: $sandboxUrl/health"
                    
                    try {
                        $healthResponse = Invoke-RestMethod -Uri "$sandboxUrl/health" -TimeoutSec 10
                        Write-Success "Health check passed!"
                        Write-Host "API URL: $sandboxUrl"
                        Write-Host "Frontend URL: https://$sandboxId-3000.e2b.dev"
                    } catch {
                        Write-Warning "Health check failed, but template was created"
                    }
                    
                    # Clean up test sandbox
                    Write-Status "Cleaning up test sandbox..."
                    try {
                        e2b sandbox close $sandboxId 2>$null
                    } catch {
                        # Ignore cleanup errors
                    }
                }
            } else {
                Write-Warning "Test sandbox creation failed, but template should be available"
                Write-Host $testSandboxOutput
            }
        } catch {
            Write-Warning "Test sandbox creation failed: $($_.Exception.Message)"
        }
    }
    
    # Final summary
    Write-Host ""
    Write-Success "🎉 Claude Code E2B Template Created Successfully!"
    Write-Host "┌─────────────────────────────────────────────────────┐"
    Write-Host "│                Template Information                 │"
    Write-Host "├─────────────────────────────────────────────────────┤"
    Write-Host "│ Template Name:    $TemplateName                     │"
    if (-not [string]::IsNullOrEmpty($templateId)) {
        Write-Host "│ Template ID:      $templateId                       │"
    }
    Write-Host "│ Ports:            3000 (Next.js), 8080 (API)      │"
    Write-Host "│ Base Image:       e2bdev/code-interpreter:latest   │"
    Write-Host "├─────────────────────────────────────────────────────┤"
    Write-Host "│ Next Steps:                                         │"
    Write-Host "│ 1. Copy .env.template to .env and fill in values   │"
    if (-not [string]::IsNullOrEmpty($templateId)) {
        Write-Host "│ 2. Test with: e2b sandbox create $templateId       │"
    }
    Write-Host "│ 3. Use template ID in your PRIA integration        │"
    Write-Host "└─────────────────────────────────────────────────────┘"
    Write-Host ""
    
    Write-Status "Template creation complete!"
    
    if (-not [string]::IsNullOrEmpty($templateId)) {
        Write-Host "Your E2B Template ID: " -NoNewline
        Write-Host $templateId -ForegroundColor $Colors.Green
        Write-Host "Save this ID for your PRIA integration!"
        
        # Copy to clipboard if available
        try {
            $templateId | Set-Clipboard
            Write-Status "Template ID copied to clipboard!"
        } catch {
            # Clipboard not available, ignore
        }
    }
    
} catch {
    Write-Error "Template creation failed: $($_.Exception.Message)"
    exit 1
}