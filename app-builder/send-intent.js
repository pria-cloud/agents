const http = require('http');
const fs = require('fs');
const path = require('path');

const CONVERSATION_STATE_FILE = path.join(__dirname, 'conversation.json');

// Get user input from command line arguments
let userInput = process.argv.slice(2).join(' ').trim();
let isConfirmed = false;

// Check for --confirm flag
if (userInput.includes('--confirm')) {
  isConfirmed = true;
  userInput = userInput.replace('--confirm', '').trim();
}

if (!userInput) {
  console.error('Error: Please provide your message as a command-line argument.');
  console.log('Example: node send-intent.js "I want to build a blog"');
  console.log('To reset the conversation, run: node send-intent.js --reset');
  process.exit(1);
}

// Special command to reset the conversation state
if (userInput === '--reset') {
  if (fs.existsSync(CONVERSATION_STATE_FILE)) {
    fs.unlinkSync(CONVERSATION_STATE_FILE);
    console.log('Conversation state has been reset.');
  } else {
    console.log('No active conversation to reset.');
  }
  process.exit(0);
}

// Load previous state if it exists, otherwise initialize for a new conversation
let conversationState = {};
if (fs.existsSync(CONVERSATION_STATE_FILE)) {
  try {
    const stateFileContent = fs.readFileSync(CONVERSATION_STATE_FILE, 'utf8');
    // It might be an empty file if a reset just happened or it's the very first run
    if (stateFileContent) {
        conversationState = JSON.parse(stateFileContent);
    }
  } catch (e) {
    console.error('Error reading conversation state file. Resetting state.', e);
    // In case of corruption, delete the file to start fresh next time
    fs.unlinkSync(CONVERSATION_STATE_FILE);
  }
}

// Construct the payload for the agent
const payload = {
  intent: 'app.compose',
  trace_id: 'trace-e2e-test-01',
  jwt: 'e2e-test-jwt',
  payload: {
    userInput: userInput,
    appSpec: conversationState.updatedAppSpec ? { ...conversationState.updatedAppSpec, isConfirmed } : null,
    conversationId: conversationState.conversationId || null,
    // These are needed for the test setup
    workspace_id: 'ws-e2e-test',
    request_id: `req-e2e-test-${Date.now()}`
  }
};
const payloadString = JSON.stringify(payload);

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
    console.log('No more data in response.');

    // Save the new state for the next turn
    if (res.statusCode === 200) {
        try {
            const responseJson = JSON.parse(responseBody);
            if (responseJson.updatedAppSpec || responseJson.conversationId) {
                fs.writeFileSync(CONVERSATION_STATE_FILE, JSON.stringify(responseJson, null, 2));
                console.log('\nConversation state saved.');
            }
        } catch(e) {
            console.error('\nCould not parse response JSON or save conversation state.', e);
        }
    }
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

// Write data to request body
req.write(payloadString);
req.end(); 