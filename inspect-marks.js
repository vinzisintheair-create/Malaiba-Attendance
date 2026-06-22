const XLSX = require('xlsx');

function checkAttendanceMarks() {
  const workbook = XLSX.readFile('monthly reporting template.xls');
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    // Find male & female rows
    let maleTotalRow = -1;
    let femaleTotalRow = -1;
    for (let r = 0; r <= range.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: 2 });
      const cell = sheet[addr];
      if (cell && cell.v) {
        const val = String(cell.v);
        if (val.includes('MALE | TOTAL')) maleTotalRow = r;
        if (val.includes('FEMALE | TOTAL')) femaleTotalRow = r;
      }
    }
    
    const marksFound = new Set();
    const searchRows = [];
    // Male rows: 7 to maleTotalRow - 1
    for (let r = 7; r < maleTotalRow; r++) searchRows.push(r);
    // Female rows: maleTotalRow + 1 to femaleTotalRow - 1
    for (let r = maleTotalRow + 1; r < femaleTotalRow; r++) searchRows.push(r);
    
    searchRows.forEach(r => {
      for (let c = 5; c <= 37; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        if (cell && cell.v !== undefined && cell.v !== '') {
          marksFound.add(String(cell.v));
        }
      }
    });
    
    console.log(`[${sheetName}] Marks found in student attendance cells:`, Array.from(marksFound));
  });
}

checkAttendanceMarks();
