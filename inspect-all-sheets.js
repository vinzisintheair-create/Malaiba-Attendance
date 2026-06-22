const XLSX = require('xlsx');

function inspectAllSheets() {
  const workbook = XLSX.readFile('monthly reporting template.xls');
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    const dates = [];
    const days = [];
    const colList = [];
    for (let c = 5; c <= 37; c++) {
      const r5addr = XLSX.utils.encode_cell({ r: 5, c });
      const r6addr = XLSX.utils.encode_cell({ r: 6, c });
      const c5 = sheet[r5addr];
      const c6 = sheet[r6addr];
      
      const dateVal = c5 ? c5.v : '';
      const dayVal = c6 ? c6.v : '';
      
      // Let's record the col letter and value
      const colLetter = XLSX.utils.encode_col(c);
      dates.push(`${colLetter}:${dateVal}`);
      days.push(`${colLetter}:${dayVal}`);
    }
    console.log(`\n=== Sheet: ${sheetName} ===`);
    console.log('Dates:', dates.filter(x => !x.endsWith(':') && !x.endsWith(':""')).join(', '));
    console.log('Days: ', days.filter(x => !x.endsWith(':') && !x.endsWith(':""')).join(', '));
  });
}

inspectAllSheets();
