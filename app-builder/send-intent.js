const http = require('http');
const fs = require('fs');

const payload = fs.readFileSync('payload.json', 'utf8');

const options = {
  hostname: 'localhost',
  port: 4001,
  path: '/intent',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
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
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.stack}`);
});

// Write data to request body
req.write(payload);
req.end(); 