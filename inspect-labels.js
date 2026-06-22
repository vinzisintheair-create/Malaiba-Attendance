const XLSX = require('xlsx');

function findSummaryLabels(sheetName) {
  const workbook = XLSX.readFile('monthly reporting template.xls');
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  
  console.log(`\n=== Summary Labels in ${sheetName} ===`);
  const labelsToFind = [
    'Enrolment as of',
    'Late enrolment',
    'Registered Learners',
    'Percentage of Enrolment',
    'Average Daily Attendance',
    'Percentage of Attendance',
    'absent for 5 consecutive days',
    'NLS',
    'Transferred out',
    'Transferred in',
    'No. of Days of Classes',
    'Month :'
  ];

  for (let r = 50; r <= range.e.r; r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      if (cell && cell.v) {
        const valStr = String(cell.v);
        labelsToFind.forEach(label => {
          if (valStr.includes(label)) {
            console.log(`Label [${label}]: found at ${addr} (Row ${r}, Col ${c}) = ${JSON.stringify(cell.v)}`);
          }
        });
      }
    }
  }
}

findSummaryLabels('JUNE');
findSummaryLabels('MARCH');
