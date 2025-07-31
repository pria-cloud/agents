const { spawn } = require('child_process');
const path = require('path');

console.log('Starting PRIA App Builder E2E Tests...\n');

// Start the dev server
console.log('Starting development server...');
const devServer = spawn('npm', ['run', 'dev'], { 
  shell: true,
  stdio: 'pipe',
  cwd: __dirname
});

let serverReady = false;

devServer.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('Dev Server: ' + output);
  
  if (output.includes('Ready') || output.includes('started server on') || output.includes('Local:')) {
    serverReady = true;
    runTests();
  }
});

devServer.stderr.on('data', (data) => {
  console.error('Dev Server Error: ' + data.toString());
});

function runTests() {
  if (!serverReady) return;
  
  console.log('\n\nRunning E2E tests...\n');
  
  const testProcess = spawn('npx', ['playwright', 'test', 'tests/e2e/pria-comprehensive-e2e.test.ts', '--reporter=list'], {
    shell: true,
    stdio: 'inherit',
    cwd: __dirname
  });
  
  testProcess.on('close', (code) => {
    console.log(`\nTest process exited with code ${code}`);
    
    // Kill the dev server
    devServer.kill();
    process.exit(code);
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nStopping dev server...');
  devServer.kill();
  process.exit(0);
});

// Give the server some time to start if it doesn't emit ready signal
setTimeout(() => {
  if (!serverReady) {
    console.log('\nServer startup timeout - running tests anyway...');
    serverReady = true;
    runTests();
  }
}, 30000);