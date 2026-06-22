const fs = require('fs');

// We need to simulate localStorage or check the json file.
// Since database.js reads from localStorage, let's inspect the stored localStorage content.
// Wait! In Node.js, there is no localStorage. But run-tests.js and capture-screens.js run in a browser (Puppeteer) where localStorage is used!
// Wait! Puppeteer starts a clean browser session, so localStorage is initialized by App.init() when index.html loads!
// Let's write a script to launch Puppeteer and dump Database.getStudents(false) and Database.getActiveUser() and database sections.
const puppeteer = require('puppeteer-core');

async function dump() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.goto('file:///' + __dirname.replace(/\\/g, '/') + '/index.html');
  await new Promise(r => setTimeout(r, 1000));
  
  const data = await page.evaluate(() => {
    return {
      students: Database.getStudents(false),
      sections: Database.getSections(),
      activeUser: Database.getActiveUser()
    };
  });
  
  console.log('Total students:', data.students.length);
  console.log('Sections:', data.sections);
  console.log('First 5 students:', data.students.slice(0, 5));
  
  await browser.close();
}

dump();
