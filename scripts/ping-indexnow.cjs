/**
 * This script pings the Bing IndexNow API to notify it about website updates.
 * Documentation: https://www.bing.com/indexnow
 */

const https = require('https');

const host = 'litematica-render.vercel.app';
const key = '7df9a7b9f55e4eeb9e5e54c8d5a1a1f0';
const keyLocation = `https://${host}/${key}.txt`;
const urlList = [
    `https://${host}/`,
    // Add other important URLs here if needed
];

const data = JSON.stringify({
    host: host,
    key: key,
    keyLocation: keyLocation,
    urlList: urlList
});

const options = {
    hostname: 'www.bing.com',
    path: '/indexnow',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': data.length
    }
};

console.log(`Pinging Bing IndexNow for ${host}...`);

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => {
        body += d;
    });

    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('✅ IndexNow ping successful (200 OK)');
        } else if (res.statusCode === 202) {
            console.log('✅ IndexNow ping accepted (202 Accepted)');
        } else {
            console.error(`❌ IndexNow ping failed with status: ${res.statusCode}`);
            console.error('Response:', body);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Error sending IndexNow ping:', error);
});

req.write(data);
req.end();
