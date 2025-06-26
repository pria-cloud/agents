const fetch = require('node-fetch');

async function sendRequest() {
  const url = 'http://localhost:9999/a2a/intent';
  const body = {
    intent: 'app.compose',
    userInput: 'I want to build a simple bug tracker application.',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error sending request:', error);
  }
}

sendRequest(); 