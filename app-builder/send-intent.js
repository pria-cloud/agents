const http = require('http');
const fs = require('fs');
const path = require('path');

const CONVERSATION_STATE_FILE = path.join(__dirname, 'conversation.json');

// --- Argument Parsing ---
let userInput = process.argv.slice(2).join(' ').trim();
let shouldReset = false;
let isConfirmed = false;

// Check for --reset flag
if (userInput.includes('--reset')) {
  shouldReset = true;
  userInput = userInput.replace(/--reset/g, '').trim();
}

// Check for --confirm flag
if (userInput.includes('--confirm')) {
  isConfirmed = true;
  userInput = userInput.replace(/--confirm/g, '').trim();
}

// Handle reset action
if (shouldReset) {
  if (fs.existsSync(CONVERSATION_STATE_FILE)) {
    fs.unlinkSync(CONVERSATION_STATE_FILE);
    console.log('Conversation state has been reset.');
  } else {
    console.log('No active conversation to reset.');
  }
}

// Ensure there's user input to proceed
if (!userInput) {
  if (shouldReset) {
    // If only --reset was provided, it's not an error.
    process.exit(0);
  }
  console.error('Error: Please provide your message as a command-line argument.');
  console.log('Example: node send-intent.js "I want to build a blog"');
  process.exit(1);
}


// --- Conversation State ---
let conversationState = {};
if (fs.existsSync(CONVERSATION_STATE_FILE)) {
  try {
    const stateFileContent = fs.readFileSync(CONVERSATION_STATE_FILE, 'utf8');
    if (stateFileContent) {
        conversationState = JSON.parse(stateFileContent);
    }
  } catch (e) {
    console.error('Error reading conversation state file. Starting fresh.', e);
    fs.unlinkSync(CONVERSATION_STATE_FILE);
  }
}

// --- Payload Construction ---
// The agent expects these at the top level of the request body
const payload = {
  intent: 'app.compose',
  trace_id: 'trace-e2e-test-01',
  jwt: 'e2e-test-jwt',
  userInput: userInput,
  // The appSpec is nested within the saved state from the previous turn
  appSpec: conversationState.updatedAppSpec ? { ...conversationState.updatedAppSpec, isConfirmed } : null,
  conversationId: conversationState.conversationId || null,
  workspace_id: 'ws-e2e-test',
  request_id: `req-e2e-test-${Date.now()}`
};

const payloadString = JSON.stringify(payload);

// --- HTTP Request ---
const options = {
  hostname: 'localhost',
  port: 4001,
  path: '/intent',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadString),
  },
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  let responseBody = '';
  res.on('data', (chunk) => {
    responseBody += chunk;
  });
  res.on('end', () => {
    console.log('BODY:', responseBody);

    // Save the new state for the next turn
    if (res.statusCode === 200) {
        try {
            const responseJson = JSON.parse(responseBody);
            // The agent's response IS the new state object
            if (responseJson.updatedAppSpec) {
                fs.writeFileSync(CONVERSATION_STATE_FILE, JSON.stringify(responseJson, null, 2));
                console.log('\nConversation state saved.');
            }
        } catch(e) {
            console.error('\nCould not parse response JSON or save conversation state.', e);
        }
    } else {
        console.error(`\nRequest failed with status ${res.statusCode}. Conversation state not saved.`);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(payloadString);
req.end();