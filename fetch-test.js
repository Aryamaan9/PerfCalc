const https = require('https');

https.get('https://us-central1-portfolio-alyzr-83921.cloudfunctions.net/listPortfolios', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('listPortfolios:', res.statusCode, data));
}).on('error', err => console.log('Error:', err.message));
