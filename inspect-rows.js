const XLSX = require('xlsx');

function inspectRows23To65() {
  const workbook = XLSX.readFile('monthly reporting template.xls');
  const sheets = ['JUNE', 'MARCH'];
  
  sheets.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    console.log(`\n================= SHEET: ${sheetName} =================`);
    for (let r = 23; r <= 65; r++) {
      const rowCells = [];
      for (let c = 0; c <= 46; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        rowCells.push(cell ? cell.v : '');
      }
      // Log index and cells 0 to 4 (A to E)
      console.log(`Row ${r} (Excel ${r+1}): A=${JSON.stringify(rowCells[0])} | B=${JSON.stringify(rowCells[1])} | C=${JSON.stringify(rowCells[2])} | AM=${JSON.stringify(rowCells[38])} | AO=${JSON.stringify(rowCells[40])}`);
    }
  });
}

inspectRows23To65();
