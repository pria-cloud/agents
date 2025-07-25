#!/bin/bash

# Claude Code E2B Template Creation Script
# This script builds and deploys the E2B template for Claude Code integration

set -e

echo "🚀 Creating Claude Code E2B Template..."
echo "📅 $(date)"
echo "📁 Working directory: $(pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
print_status "Checking prerequisites..."

# Check if E2B CLI is installed
if ! command -v e2b &> /dev/null; then
    print_error "E2B CLI is not installed. Please install it first:"
    echo "npm install -g @e2b/cli"
    echo "e2b auth login"
    exit 1
fi

print_success "E2B CLI is installed"

# Check if logged in to E2B
if ! e2b auth whoami &> /dev/null; then
    print_error "Not logged in to E2B. Please login first:"
    echo "e2b auth login"
    exit 1
fi

print_success "Logged in to E2B"

# Check if required files exist
required_files=(
    "e2b.toml"
    "e2b.Dockerfile"
    "scripts/start-services.sh"
    "api-service/package.json"
    "baseline-project/package.json"
)

for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        print_error "Required file missing: $file"
        exit 1
    fi
done

print_success "All required files are present"

# Create template name with timestamp for uniqueness
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TEMPLATE_NAME="claude-code-e2b-${TIMESTAMP}"

print_status "Template name: $TEMPLATE_NAME"

# Build API service
print_status "Building API service..."
cd api-service

if [[ ! -d "node_modules" ]]; then
    print_status "Installing API service dependencies..."
    npm install
fi

print_status "Building TypeScript..."
npm run build

if [[ $? -ne 0 ]]; then
    print_error "Failed to build API service"
    exit 1
fi

print_success "API service built successfully"
cd ..

# Check baseline project
print_status "Checking baseline project..."
cd baseline-project

if [[ ! -d "node_modules" ]]; then
    print_status "Installing baseline project dependencies..."
    npm install --legacy-peer-deps
fi

# Build baseline project to check for errors
print_status "Testing baseline project build..."
npm run build

if [[ $? -ne 0 ]]; then
    print_warning "Baseline project build failed, but continuing (will be rebuilt in container)"
fi

cd ..

# Make scripts executable
print_status "Making scripts executable..."
chmod +x scripts/*.sh

# Create the E2B template
print_status "Creating E2B template..."

# Update template name in e2b.toml
sed -i.bak "s/name = \".*\"/name = \"$TEMPLATE_NAME\"/" e2b.toml

echo "Creating template with configuration:"
cat e2b.toml

# Create the template
print_status "Deploying to E2B..."
TEMPLATE_OUTPUT=$(e2b template create)

if [[ $? -ne 0 ]]; then
    print_error "Failed to create E2B template"
    exit 1
fi

print_success "Template creation initiated"
echo "$TEMPLATE_OUTPUT"

# Extract template ID from output
TEMPLATE_ID=$(echo "$TEMPLATE_OUTPUT" | grep -o "Template ID: [a-zA-Z0-9_-]*" | cut -d' ' -f3)

if [[ -z "$TEMPLATE_ID" ]]; then
    # Try alternative extraction method
    TEMPLATE_ID=$(echo "$TEMPLATE_OUTPUT" | grep -o "[a-zA-Z0-9_-]*" | tail -1)
fi

if [[ -n "$TEMPLATE_ID" ]]; then
    print_success "Template created with ID: $TEMPLATE_ID"
    
    # Save template ID to a file
    echo "$TEMPLATE_ID" > .template-id
    print_status "Template ID saved to .template-id file"
    
    # Create environment file template
    cat > .env.template << EOF
# E2B Template Configuration
E2B_TEMPLATE_ID=$TEMPLATE_ID

# Required Environment Variables for Claude Code E2B
ANTHROPIC_API_KEY=your_anthropic_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Optional Git Configuration
GIT_USER_NAME="Claude Code E2B"
GIT_USER_EMAIL="claude-code@your-domain.com"
GITHUB_TOKEN=your_github_token_here

# API Configuration
API_PORT=8080
NEXT_PORT=3000
NODE_ENV=development
EOF
    
    print_success "Environment template created: .env.template"
else
    print_warning "Could not extract template ID from output"
fi

# Test the template
print_status "Testing template..."
print_status "Waiting for template to be ready..."

# Wait a bit for the template to be available
sleep 10

# Try to create a test sandbox
print_status "Creating test sandbox..."
TEST_SANDBOX_OUTPUT=$(e2b sandbox create "$TEMPLATE_ID" 2>&1)

if [[ $? -eq 0 ]]; then
    print_success "Test sandbox created successfully"
    
    # Extract sandbox ID
    SANDBOX_ID=$(echo "$TEST_SANDBOX_OUTPUT" | grep -o "Sandbox ID: [a-zA-Z0-9_-]*" | cut -d' ' -f3)
    
    if [[ -n "$SANDBOX_ID" ]]; then
        print_status "Test sandbox ID: $SANDBOX_ID"
        
        # Wait for services to start
        print_status "Waiting for services to start..."
        sleep 30
        
        # Test health endpoint
        SANDBOX_URL="https://${SANDBOX_ID}-8080.e2b.dev"
        print_status "Testing health endpoint: $SANDBOX_URL/health"
        
        HEALTH_RESPONSE=$(curl -s -f "$SANDBOX_URL/health" 2>/dev/null || echo "failed")
        
        if [[ "$HEALTH_RESPONSE" != "failed" ]]; then
            print_success "Health check passed!"
            echo "API URL: $SANDBOX_URL"
            echo "Frontend URL: https://${SANDBOX_ID}-3000.e2b.dev"
        else
            print_warning "Health check failed, but template was created"
        fi
        
        # Clean up test sandbox
        print_status "Cleaning up test sandbox..."
        e2b sandbox close "$SANDBOX_ID" &> /dev/null || true
    fi
else
    print_warning "Test sandbox creation failed, but template should be available"
    echo "$TEST_SANDBOX_OUTPUT"
fi

# Final summary
echo ""
print_success "🎉 Claude Code E2B Template Created Successfully!"
echo "┌─────────────────────────────────────────────────────┐"
echo "│                Template Information                 │"
echo "├─────────────────────────────────────────────────────┤"
echo "│ Template Name:    $TEMPLATE_NAME        │"
if [[ -n "$TEMPLATE_ID" ]]; then
echo "│ Template ID:      $TEMPLATE_ID                     │"
fi
echo "│ Ports:            3000 (Next.js), 8080 (API)      │"
echo "│ Base Image:       e2bdev/code-interpreter:latest   │"
echo "├─────────────────────────────────────────────────────┤"
echo "│ Next Steps:                                         │"
echo "│ 1. Copy .env.template to .env and fill in values   │"
echo "│ 2. Test with: e2b sandbox create $TEMPLATE_ID      │"
echo "│ 3. Use template ID in your PRIA integration        │"
echo "└─────────────────────────────────────────────────────┘"
echo ""

# Restore original e2b.toml
mv e2b.toml.bak e2b.toml

print_status "Template creation complete!"

if [[ -n "$TEMPLATE_ID" ]]; then
    echo "Your E2B Template ID: $TEMPLATE_ID"
    echo "Save this ID for your PRIA integration!"
fi