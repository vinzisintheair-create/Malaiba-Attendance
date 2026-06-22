const puppeteer = require('puppeteer-core');

async function checkConsole() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  
  console.log('Loading page...');
  await page.goto('file:///' + __dirname.replace(/\\/g, '/') + '/index.html');
  await new Promise(r => setTimeout(r, 2000));
  
  const results = await page.evaluate(() => {
    return {
      studentsLen: Database.getStudents(false).length,
      allStudentsLen: Database.getStudents(true).length,
      users: Database.getUsers(),
      activeUser: Database.getActiveUser()
    };
  });
  
  console.log('Results in browser:', results);
  await browser.close();
}

checkConsole();
