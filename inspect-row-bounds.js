const XLSX = require('xlsx');

function inspectAllRowBounds() {
  const workbook = XLSX.readFile('monthly reporting template.xls');
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    let maleTotalRow = -1;
    let femaleTotalRow = -1;
    let combinedTotalRow = -1;
    
    for (let r = 0; r <= range.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: 2 });
      const cell = sheet[addr];
      if (cell && cell.v) {
        const valStr = String(cell.v);
        if (valStr.includes('FEMALE | TOTAL')) {
          femaleTotalRow = r;
        } else if (valStr.includes('MALE | TOTAL')) {
          maleTotalRow = r;
        } else if (valStr.includes('Combined TOTAL') || valStr.includes('Combined total') || valStr.includes('COMBINED TOTAL')) {
          combinedTotalRow = r;
        }
      }
    }
    
    console.log(`Sheet: ${sheetName.padEnd(10)} | MaleTotalRow (Excel): ${(maleTotalRow+1).toString().padStart(2)} | FemaleTotalRow (Excel): ${(femaleTotalRow+1).toString().padStart(2)} | CombinedTotalRow (Excel): ${(combinedTotalRow+1).toString().padStart(2)}`);
  });
}

inspectAllRowBounds();
