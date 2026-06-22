const XLSX = require('xlsx');

function inspectMerges() {
  const workbook = XLSX.readFile('monthly reporting template.xls');
  const sheetName = 'JUNE';
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.error(`Sheet ${sheetName} not found!`);
    return;
  }
  
  console.log('--- Merges in JUNE ---');
  if (sheet['!merges']) {
    sheet['!merges'].forEach((m, idx) => {
      const startCell = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
      const endCell = XLSX.utils.encode_cell({ r: m.e.r, c: m.e.c });
      // Only log merges that occur in rows 0 to 6
      if (m.s.r <= 6) {
        console.log(`Merge ${idx}: ${startCell} to ${endCell}`);
      }
    });
  }

  console.log('\n--- Day Column Cells (Row 5 & 6, Cols 5 to 37) ---');
  for (let c = 5; c <= 37; c++) {
    const r5addr = XLSX.utils.encode_cell({ r: 5, c });
    const r6addr = XLSX.utils.encode_cell({ r: 6, c });
    const c5 = sheet[r5addr];
    const c6 = sheet[r6addr];
    console.log(`Col ${c} (${XLSX.utils.encode_col(c)}): Row 5=${c5 ? JSON.stringify(c5.v) : 'empty'}, Row 6=${c6 ? JSON.stringify(c6.v) : 'empty'}`);
  }
}

inspectMerges();
