const XLSX = require('xlsx');

function checkLegendHigher() {
  const workbook = XLSX.readFile('monthly reporting template.xls');
  const sheet = workbook.Sheets['MARCH'];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  
  console.log('--- MARCH Legend check (Rows 70-80) ---');
  for (let r = 70; r <= 80; r++) {
    const rowCells = [];
    for (let c = 0; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      if (cell && cell.v) {
        rowCells.push(`${XLSX.utils.encode_col(c)}${r+1}: ${JSON.stringify(cell.v)}`);
      }
    }
    if (rowCells.length > 0) {
      console.log(`Row ${r}:`, rowCells.slice(0, 5).join(' | '));
    }
  }
}

checkLegendHigher();
