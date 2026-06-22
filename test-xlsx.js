const XLSX = require('xlsx');
const fs = require('fs');

function testReadWrite() {
  console.log('Reading template...');
  const data = fs.readFileSync('monthly reporting template.xls');
  const workbook = XLSX.read(data, { type: 'buffer' });
  console.log('Sheets:', workbook.SheetNames);
  
  const sheet = workbook.Sheets['JUNE'];
  const cellAddress = 'AM4'; // Section name cell
  console.log('Current value at AM4:', sheet[cellAddress]);
  
  // Modify cell
  sheet[cellAddress] = { t: 's', v: 'TEST SECTION' };
  console.log('Modified value at AM4:', sheet[cellAddress]);
  
  console.log('Writing file...');
  XLSX.writeFile(workbook, 'test_output.xls');
  console.log('Output file written successfully!');
}

try {
  testReadWrite();
} catch (e) {
  console.error('Error:', e);
}
