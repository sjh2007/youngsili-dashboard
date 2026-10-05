import * as XLSX from 'xlsx';
import { createExportWorkbook } from './exportWorkbook';
import { exportRows } from './exportData';
test('xlsx round trip keeps every user cell plain text including formula-looking input',()=>{
  const rows=exportRows([{id:'1',elderName:'어르신',content:'=HYPERLINK("https://example.invalid")',action:'+1+1'}]);
  const book=XLSX.read(createExportWorkbook(rows),{type:'array'});const sheet=book.Sheets[book.SheetNames[0]];
  expect(sheet.E2.v).toBe(rows[1][4]);expect(sheet.E2.t).toBe('s');expect(sheet.E2.f).toBeUndefined();
  expect(sheet.F2.t).toBe('s');expect(XLSX.utils.sheet_to_json(sheet,{header:1})).toEqual(rows);
});
