const puppeteer = require('puppeteer-core');

async function checkStudentsDetails() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.goto('file:///' + __dirname.replace(/\\/g, '/') + '/index.html');
  await new Promise(r => setTimeout(r, 2000));
  
  const students = await page.evaluate(() => Database.getStudents(true));
  console.log('Students in database:', students);
  await browser.close();
}

checkStudentsDetails();
