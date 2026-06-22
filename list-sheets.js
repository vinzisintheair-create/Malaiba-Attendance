const XLSX = require('xlsx');
const workbook = XLSX.readFile('monthly reporting template.xls');
console.log('Sheet Names in workbook:', workbook.SheetNames);
