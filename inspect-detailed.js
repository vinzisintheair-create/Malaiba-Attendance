const XLSX = require('xlsx');

function inspectDetailed() {
  const workbook = XLSX.readFile('monthly reporting template.xls');
  const sheet = workbook.Sheets['JUNE'];
  
  console.log('=== original JUNE Sheet Layout ===');
  for (let r = 0; r <= 80; r++) {
    const colA = sheet[XLSX.utils.encode_cell({ r, c: 0 })]?.v || '';
    const colC = sheet[XLSX.utils.encode_cell({ r, c: 2 })]?.v || '';
    
    if (colA !== '' || colC !== '') {
      console.log(`Row ${(r + 1).toString().padStart(2)} (0-based index ${r.toString().padStart(2)}): Col A (No.) = ${JSON.stringify(colA)}, Col C (Name) = ${JSON.stringify(colC)}`);
    }
  }
}

inspectDetailed();
