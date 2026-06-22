const puppeteer = require('puppeteer-core');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Start a simple HTTP server to serve the workspace files (avoiding file:/// protocol CORS errors)
function startServer() {
  const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';
    
    // Decode URI component to handle spaces (e.g. "monthly reporting template.xls")
    const filePath = path.join(__dirname, decodeURIComponent(urlPath));
    const ext = path.extname(filePath).toLowerCase();
    
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'text/javascript';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.xls') contentType = 'application/vnd.ms-excel';
    else if (ext === '.json') contentType = 'application/json';
    
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
  
  return new Promise((resolve) => {
    server.listen(8080, () => {
      console.log('Temporary web server running on http://localhost:8080');
      resolve(server);
    });
  });
}

async function run() {
  const server = await startServer();
  
  console.log('Launching browser to capture UI screenshots...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const brainDir = 'C:/Users/User/.gemini/antigravity-ide/brain/94688c6d-fbbc-45aa-bcc1-5d7ed71cb267';

    console.log('Opening app at: http://localhost:8080/index.html');
    await page.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await new Promise(resolve => setTimeout(resolve, 500));

    // 1. Capture Login Screen
    console.log('Capturing Login Screen...');
    await page.screenshot({ path: `${brainDir}/screenshot_login.png` });

    // 2. Perform Login on page context
    console.log('Performing login...');
    await page.evaluate(() => {
      document.getElementById('login-username').value = 'admin';
      document.getElementById('login-password').value = 'password';
      document.getElementById('login-form').dispatchEvent(new Event('submit'));
    });
    await new Promise(resolve => setTimeout(resolve, 1000)); // wait for transition

    // 3. Capture Dashboard Screen
    console.log('Capturing Dashboard Screen...');
    await page.screenshot({ path: `${brainDir}/screenshot_dashboard.png` });

    // 4. Capture Student Management Screen
    console.log('Navigating to Student Directory...');
    await page.evaluate(() => App.switchScreen('students'));
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: `${brainDir}/screenshot_students.png` });

    // 5. Capture Attendance Session Setup
    console.log('Navigating to Attendance Session Setup...');
    await page.evaluate(() => App.switchScreen('session'));
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: `${brainDir}/screenshot_session_setup.png` });

    // 6. Start Session and Capture Live Scanning Lobby
    console.log('Starting Live Session...');
    await page.evaluate(() => App.startAttendanceSession('2026-06-16'));
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ path: `${brainDir}/screenshot_session_lobby.png` });

    // 7. Simulate Card Tap & Capture Scan Success Screen Card
    console.log('Simulating Elena check-in...');
    await page.evaluate(() => App.handleRFIDScan('E2801108C5')); // Elena's card
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ path: `${brainDir}/screenshot_session_success.png` });

    // Reset success card to go back to lobby
    await page.evaluate(() => App.resetSuccessCard());
    await new Promise(resolve => setTimeout(resolve, 500));

    // 8. Capture Attendance Records Logs Screen
    console.log('Navigating to Attendance Records...');
    await page.evaluate(() => App.switchScreen('records'));
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: `${brainDir}/screenshot_records.png` });

    // 8.5 Generate and Capture Monthly Report View
    console.log('Opening Monthly Report Selector...');
    await page.evaluate(() => App.openMonthlyReportSelector());
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: `${brainDir}/screenshot_report_selector.png` });

    console.log('Generating Monthly Report for June 2026 (Grade 3 - Santan)...');
    await page.evaluate(async () => {
      // Since generateMonthlyReport is async, let's call it and wait for completion
      await App.generateMonthlyReport(5, '2026', 'Grade 3 - Santan', 'AM');
    });
    await new Promise(resolve => setTimeout(resolve, 1500)); // wait for file loading and rendering
    await page.screenshot({ path: `${brainDir}/screenshot_report_preview.png` });

    console.log('Closing Monthly Report Preview...');
    await page.evaluate(() => App.closeReportPreview());
    await new Promise(resolve => setTimeout(resolve, 500));

    // 9. Capture Settings Screen
    console.log('Navigating to Settings...');
    await page.evaluate(() => App.switchScreen('settings'));
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: `${brainDir}/screenshot_settings.png` });

    console.log('All screenshots captured successfully!');
  } catch (err) {
    console.error('Error taking screenshots:', err);
  } finally {
    await browser.close();
    server.close(() => {
      console.log('Temporary server closed.');
    });
  }
}

run();
