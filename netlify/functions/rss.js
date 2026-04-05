// Netlify serverless function — fetches Wix RSS feed server-side (no CORS issues)
const https = require('https');

exports.handler = async function(event, context) {
  const RSS_URL = 'https://www.galamigold.net/blog-feed.xml';

  const xml = await new Promise((resolve, reject) => {
    https.get(RSS_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300', // cache 5 mins
    },
    body: xml,
  };
};
