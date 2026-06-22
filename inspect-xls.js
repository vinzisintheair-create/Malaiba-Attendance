const XLSX = require('xlsx');

function inspect() {
  console.log('Loading monthly reporting template.xls...');
  const workbook = XLSX.readFile('monthly reporting template.xls');
  
  console.log('Sheet Names:', workbook.SheetNames);
  
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    console.log(`Range: ${sheet['!ref']} (Rows: ${range.e.r + 1}, Cols: ${range.e.c + 1})`);
    
    // Print first 45 rows and 20 columns
    for (let r = 0; r <= Math.min(range.e.r, 45); r++) {
      const rowCells = [];
      for (let c = 0; c <= Math.min(range.e.c, 20); c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellAddress];
        rowCells.push(cell ? cell.v : '');
      }
      // Print row if it has any content
      if (rowCells.some(v => v !== '')) {
        console.log(`Row ${r.toString().padStart(2, ' ')}:`, JSON.stringify(rowCells));
      }
    }
  });
}

try {
  inspect();
} catch (e) {
  console.error('Error during inspection:', e);
}
