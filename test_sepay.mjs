const data = {
  content: "BOOKHUB42",
  transferAmount: 5000,
};

async function runTest() {
  try {
    const res = await fetch('http://localhost:3000/api/payments/webhook/sepay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('BODY:', text);
  } catch (err) {
    console.error(err);
  }
}

runTest();
