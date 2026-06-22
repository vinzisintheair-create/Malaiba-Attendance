const XLSX = require('xlsx');

function checkJanuary() {
  const workbook = XLSX.readFile('monthly reporting template.xls');
  const sheet = workbook.Sheets['JANUARY'];
  if (!sheet) {
    console.error('JANUARY sheet not found');
    return;
  }
  
  // Print Row 5 cells for JANUARY
  console.log('--- JANUARY Row 5 cells ---');
  for (let c = 0; c < 47; c++) {
    const addr = XLSX.utils.encode_cell({ r: 5, c });
    const cell = sheet[addr];
    if (cell && cell.v !== undefined && cell.v !== '') {
      console.log(`${addr}: ${JSON.stringify(cell.v)}`);
    }
  }

  // Find any numbers or labels in JANUARY
  console.log('\n--- JANUARY labels in Row 2-4 ---');
  for (let r = 0; r <= 6; r++) {
    for (let c = 0; c < 47; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      if (cell && cell.v !== undefined && cell.v !== '') {
        console.log(`${addr}: ${JSON.stringify(cell.v)}`);
      }
    }
  }
}

checkJanuary();
