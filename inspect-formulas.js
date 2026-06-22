const XLSX = require('xlsx');

function checkAnyFormulas() {
  const workbook = XLSX.readFile('monthly reporting template.xls');
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    let formulaCount = 0;
    
    for (let r = 0; r <= range.e.r; r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        if (cell && cell.f) {
          formulaCount++;
          if (formulaCount <= 5) {
            console.log(`[${sheetName}] Found formula at ${addr}: ${cell.f} (value: ${cell.v})`);
          }
        }
      }
    }
    console.log(`[${sheetName}] Total formulas: ${formulaCount}`);
  });
}

checkAnyFormulas();
