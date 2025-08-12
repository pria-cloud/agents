/**
 * PRIA Integration for claudecodeui
 * Handles PostMessage communication with PRIA Admin iframe parent
 */

class PRIAIntegration {
  constructor() {
    this.initialized = false;
    this.parentOrigin = null;
    this.projectConfig = null;
    
    this.initPostMessageListeners();
    this.notifyParentReady();
  }
  
  initPostMessageListeners() {
    window.addEventListener('message', (event) => {
      // Security: Only accept messages from parent window
      if (event.source !== window.parent) return;
      
      // Store parent origin for future communications
      if (!this.parentOrigin) {
        this.parentOrigin = event.origin;
      }
      
      const { type, data } = event.data;
      
      console.log('Received message from parent:', { type, data });
      
      switch (type) {
        case 'INIT_PROJECT':
          this.initializeProject(data);
          break;
          
        case 'GITHUB_CREDENTIALS':
          this.updateGitHubCredentials(data);
          break;
          
        case 'THEME_CHANGE':
          this.updateTheme(data.theme);
          break;
          
        case 'TEST_MESSAGE':
          // Respond to connectivity test
          this.notifyParent('TEST_RESPONSE', 'pong');
          break;
      }
    });
  }
  
  notifyParentReady() {
    // Signal that iframe is ready
    this.notifyParent('IFRAME_READY', {
      timestamp: Date.now(),
      version: '1.0.0',
      url: window.location.href
    });
  }
  
  async initializeProject(config) {
    try {
      console.log('Initializing project with config:', config);
      this.projectConfig = config;
      
      let response;
      
      if (config.githubRepo) {
        // Initialize project from GitHub
        response = await fetch('/api/github/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: config.projectName,
            githubRepo: config.githubRepo,
            githubToken: config.githubToken,
            branch: config.branch || 'main'
          })
        });
      } else {
        // Create new project
        response = await fetch('/api/github/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: config.projectName,
            template: config.template || 'blank',
            workspaceId: config.workspaceId,
            sessionId: config.sessionId
          })
        });
      }
      
      const result = await response.json();
      
      if (result.success) {
        this.notifyParent('PROJECT_LOADED', {
          projectName: config.projectName,
          workspaceId: config.workspaceId,
          projectPath: result.projectPath
        });
        
        // Start monitoring for Claude session activity
        this.startClaudeSessionMonitoring();
        
        // Start periodic sync status updates
        this.startSyncStatusMonitoring();
        
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('Project initialization error:', error);
      this.notifyParent('ERROR', { 
        error: error.message,
        type: 'initialization_error'
      });
    }
  }
  
  updateGitHubCredentials(credentials) {
    console.log('Updating GitHub credentials');
    // Store credentials for future API calls
    this.githubToken = credentials.token;
  }
  
  updateTheme(theme) {
    console.log('Theme change requested:', theme);
    // Apply theme changes to claudecodeui if supported
    document.body.setAttribute('data-theme', theme);
  }
  
  startClaudeSessionMonitoring() {
    // Monitor console for Claude session events
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      originalConsoleLog(...args);
      
      // Check for Claude session events
      const message = args.join(' ');
      if (message.includes('Claude session') || message.includes('Claude Code')) {
        this.notifyParent('CLAUDE_SESSION_READY', {
          timestamp: Date.now(),
          message: message
        });
      }
    };
    
    // Monitor for file system changes (if available)
    this.monitorFileSystemChanges();
  }
  
  monitorFileSystemChanges() {
    // Use MutationObserver to watch for DOM changes that might indicate file operations
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Look for signs of file tree updates or code editor changes
          const addedNodes = Array.from(mutation.addedNodes);
          addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.textContent && node.textContent.includes('.js') || 
                  node.textContent.includes('.tsx') || 
                  node.textContent.includes('.ts')) {
                this.notifyParent('FILE_CREATED', { 
                  filePath: node.textContent,
                  timestamp: Date.now() 
                });
              }
            }
          });
        }
      });
    });
    
    // Start observing the document
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  startSyncStatusMonitoring() {
    if (!this.projectConfig?.projectName) return;
    
    // Check sync status every 30 seconds
    const checkSyncStatus = async () => {
      try {
        const response = await fetch(`/api/github/status/${this.projectConfig.projectName}`);
        const status = await response.json();
        
        if (status.success) {
          this.notifyParent('GITHUB_SYNC_STATUS', { 
            status: status.clean ? 'synced' : 'pending',
            changes: status.changes,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('Sync status check failed:', error);
      }
    };
    
    // Initial check
    checkSyncStatus();
    
    // Periodic checks
    this.syncStatusInterval = setInterval(checkSyncStatus, 30000);
  }
  
  notifyParent(type, data) {
    if (window.parent && window.parent !== window) {
      const message = { type, data };
      window.parent.postMessage(message, this.parentOrigin || '*');
      console.log('Sent message to parent:', message);
    }
  }
  
  // File system monitoring
  onFileCreated(filePath) {
    this.notifyParent('FILE_CREATED', { 
      filePath, 
      timestamp: Date.now() 
    });
  }
  
  onGitHubSyncStatus(status) {
    this.notifyParent('GITHUB_SYNC_STATUS', { 
      status, 
      timestamp: Date.now() 
    });
  }
  
  // Manual sync trigger
  async triggerSync() {
    if (!this.projectConfig?.projectName) return;
    
    try {
      const response = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: this.projectConfig.projectName
        })
      });
      
      const result = await response.json();
      
      this.notifyParent('SYNC_TRIGGERED', {
        success: result.success,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Manual sync failed:', error);
      this.notifyParent('ERROR', {
        error: error.message,
        type: 'sync_error'
      });
    }
  }
  
  // Test iframe communication
  async testCommunication() {
    const tests = {};
    
    // Test 1: Basic iframe loading
    tests.iframeLoading = document.readyState === 'complete';
    
    // Test 2: PostMessage bridge
    tests.postMessageBridge = new Promise(resolve => {
      this.notifyParent('TEST_MESSAGE', 'ping');
      
      const handler = (event) => {
        if (event.data.type === 'TEST_RESPONSE') {
          window.removeEventListener('message', handler);
          resolve(event.data.data === 'pong');
        }
      };
      
      window.addEventListener('message', handler);
      setTimeout(() => resolve(false), 5000);
    });
    
    // Test 3: API connectivity
    tests.apiConnectivity = new Promise(async (resolve) => {
      try {
        const response = await fetch('/api/github/status/test');
        const result = await response.json();
        resolve(result.success);
      } catch (error) {
        resolve(false);
      }
    });
    
    // Wait for all tests to complete
    const resolvedTests = {};
    for (const [testName, testPromise] of Object.entries(tests)) {
      try {
        resolvedTests[testName] = await testPromise;
      } catch (error) {
        resolvedTests[testName] = false;
      }
    }
    
    return resolvedTests;
  }
}

// Auto-run communication tests on load
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize PRIA integration
  window.priaIntegration = new PRIAIntegration();
  
  // Run connectivity tests
  setTimeout(async () => {
    const results = await window.priaIntegration.testCommunication();
    console.log('PRIA Communication Test Results:', results);
    
    // Notify parent of test results
    window.priaIntegration.notifyParent('COMMUNICATION_TEST_RESULTS', results);
  }, 2000);
});

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PRIAIntegration;
}