const https = require('https');
https.get('https://portfolio-alyzr-83921.web.app/api/portfolio/list', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('listPortfolios:', res.statusCode, data));
}).on('error', err => console.log('Error:', err.message));
