const XLSX = require('xlsx');

function checkStudentRowMerges() {
  const workbook = XLSX.readFile('monthly reporting template.xls');
  const sheet = workbook.Sheets['JUNE'];
  
  if (sheet['!merges']) {
    const studentMerges = sheet['!merges'].filter(m => m.s.r >= 7 && m.s.r <= 63);
    console.log(`Found ${studentMerges.length} merges in student rows:`);
    studentMerges.slice(0, 10).forEach((m, idx) => {
      console.log(`Merge ${idx}: ${XLSX.utils.encode_cell(m.s)} to ${XLSX.utils.encode_cell(m.e)}`);
    });
  }
}

checkStudentRowMerges();
