const http = require('http');

const data = JSON.stringify({
  content: "BOOKHUB15",
  transferAmount: 5000,
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/payments/webhook/sepay',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
