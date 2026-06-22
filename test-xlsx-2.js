const XLSX = require('xlsx');
const fs = require('fs');

function testReadWrite2() {
  console.log('Reading template...');
  const data = fs.readFileSync('monthly reporting template.xls');
  const workbook = XLSX.read(data, { type: 'buffer' });
  console.log('Sheets:', workbook.SheetNames);
  
  // Try clearing properties that might trigger metadata serialization errors
  delete workbook.Props;
  delete workbook.Custprops;
  workbook.Props = {};
  workbook.Custprops = {};
  
  const sheet = workbook.Sheets['JUNE'];
  const cellAddress = 'AM4';
  sheet[cellAddress] = { t: 's', v: 'TEST SECTION' };
  
  console.log('Writing file as test_output.xls...');
  try {
    XLSX.writeFile(workbook, 'test_output.xls', { bookType: 'biff8' });
    console.log('BIFF8 write successful!');
  } catch (e) {
    console.error('BIFF8 write failed:', e.message);
  }

  console.log('Writing file as test_output_xlsx.xlsx...');
  try {
    XLSX.writeFile(workbook, 'test_output_xlsx.xlsx', { bookType: 'xlsx' });
    console.log('XLSX write successful!');
  } catch (e) {
    console.error('XLSX write failed:', e.message);
  }
}

try {
  testReadWrite2();
} catch (e) {
  console.error('Outer error:', e);
}
