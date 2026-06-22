const puppeteer = require('puppeteer-core');
const path = require('path');

async function run() {
  console.log('Launching browser to execute database engine tests...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    const testFilePath = 'file:///' + path.join(__dirname, 'test.html').replace(/\\/g, '/');
    console.log(`Opening test suite: ${testFilePath}`);
    
    await page.goto(testFilePath, { waitUntil: 'load' });
    
    // Wait for the summary text to update from 'Running unit test suites...'
    console.log('Waiting for test execution...');
    await page.waitForFunction(
      () => {
        const el = document.getElementById('test-summary');
        return el && !el.textContent.includes('Running');
      },
      { timeout: 10000 }
    );

    const summaryText = await page.evaluate(() => document.getElementById('test-summary').textContent.trim());
    console.log('\n--- Test Result Summary ---');
    console.log(summaryText);
    console.log('---------------------------\n');

    // Dump individual test case results
    const results = await page.evaluate(() => {
      const cases = document.querySelectorAll('.test-case');
      return Array.from(cases).map(c => {
        const name = c.querySelector('.test-name').textContent.trim();
        const desc = c.querySelector('.test-desc').textContent.trim();
        const status = c.querySelector('.test-status').textContent.trim();
        const err = c.querySelector('.test-info div') ? c.querySelector('.test-info div').textContent.trim() : '';
        return { name, desc, status, err };
      });
    });

    let hasFailure = false;
    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✓' : '✗';
      console.log(`${icon} [${r.status}] ${r.name} - ${r.desc}`);
      if (r.err) {
        console.log(`   ${r.err}`);
        hasFailure = true;
      }
    });

    if (hasFailure || summaryText.includes('FAILURE')) {
      process.exit(1);
    } else {
      console.log('\nAll offline attendance engine test suites passed!');
      process.exit(0);
    }

  } catch (err) {
    console.error('Error executing test runner:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
