const http = require('https');
const fs = require('fs');
const FormData = require('form-data');

async function test() {
  const form = new FormData();
  form.append('portfolioId', 'test1234');
  form.append('trades', Buffer.from('symbol,date,qty\nAAPL,2023-01-01,10'), {
    filename: 'trades.csv',
    contentType: 'text/csv'
  });

  const req = http.request('https://us-central1-portfolio-alyzr-83921.cloudfunctions.net/savePortfolio', {
    method: 'POST',
    headers: form.getHeaders()
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('save response:', res.statusCode, data));
  });
  
  form.pipe(req);
}

test();
