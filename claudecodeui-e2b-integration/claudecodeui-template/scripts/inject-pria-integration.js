#!/usr/bin/env node
/**
 * Inject PRIA integration script into claudecodeui HTML files
 */

const fs = require('fs');
const path = require('path');

const CLAUDECODEUI_PATH = '/home/user/claudecodeui';
const INTEGRATION_SCRIPT_PATH = '/home/user/scripts/pria-integration.js';

async function injectIntegrationScript() {
  try {
    // Read the integration script
    const integrationScript = fs.readFileSync(INTEGRATION_SCRIPT_PATH, 'utf8');
    
    // Find HTML files to inject into
    const htmlFiles = [
      path.join(CLAUDECODEUI_PATH, 'index.html'),
      path.join(CLAUDECODEUI_PATH, 'public/index.html'),
      path.join(CLAUDECODEUI_PATH, 'dist/index.html')
    ];
    
    let injected = false;
    
    for (const htmlFile of htmlFiles) {
      if (fs.existsSync(htmlFile)) {
        let htmlContent = fs.readFileSync(htmlFile, 'utf8');
        
        // Check if already injected
        if (htmlContent.includes('PRIA Integration for claudecodeui')) {
          console.log(`PRIA integration already injected in: ${htmlFile}`);
          continue;
        }
        
        // Inject script before closing body tag
        const scriptTag = `
<!-- PRIA Integration Script -->
<script>
${integrationScript}
</script>
`;
        
        const bodyCloseIndex = htmlContent.lastIndexOf('</body>');
        if (bodyCloseIndex !== -1) {
          const beforeBody = htmlContent.substring(0, bodyCloseIndex);
          const afterBody = htmlContent.substring(bodyCloseIndex);
          
          htmlContent = beforeBody + scriptTag + afterBody;
          
          fs.writeFileSync(htmlFile, htmlContent);
          console.log(`✓ PRIA integration injected into: ${htmlFile}`);
          injected = true;
        } else {
          // If no </body> tag, append to end
          htmlContent += scriptTag;
          fs.writeFileSync(htmlFile, htmlContent);
          console.log(`✓ PRIA integration appended to: ${htmlFile}`);
          injected = true;
        }
      }
    }
    
    if (!injected) {
      console.log('No HTML files found to inject PRIA integration');
    }
    
    // Also copy the script to public directory for direct access
    const publicScriptPath = path.join(CLAUDECODEUI_PATH, 'public/pria-integration.js');
    if (fs.existsSync(path.dirname(publicScriptPath))) {
      fs.copyFileSync(INTEGRATION_SCRIPT_PATH, publicScriptPath);
      console.log(`✓ PRIA integration script copied to: ${publicScriptPath}`);
    }
    
  } catch (error) {
    console.error('Error injecting PRIA integration:', error);
    process.exit(1);
  }
}

// Create the script injection command for later use
function createInjectionCommand() {
  const command = `
# Inject PRIA integration after build
cd /home/user/claudecodeui
if [ -f "dist/index.html" ]; then
  node /home/user/scripts/inject-pria-integration.js
fi
`;
  
  fs.writeFileSync('/home/user/scripts/post-build-inject.sh', command);
  fs.chmodSync('/home/user/scripts/post-build-inject.sh', '755');
  console.log('✓ Created post-build injection script');
}

// Run the injection
injectIntegrationScript();
createInjectionCommand();