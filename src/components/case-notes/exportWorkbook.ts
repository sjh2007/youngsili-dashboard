import * as XLSX from 'xlsx';

export function createExportWorkbook(rows: string[][]): ArrayBuffer {
  if (rows.length > 5001 || rows.some(row => row.length !== 10)) throw new Error('엑셀 파일 크기가 올바르지 않습니다.');
  const sheet = XLSX.utils.aoa_to_sheet(rows.map(row => row.map(value => ({t:'s',v:String(value ?? '')}))));
  sheet['!cols'] = [20,12,12,10,60,35,10,12,15,22].map(wch => ({wch}));
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,sheet,'상담방문일지');
  return XLSX.write(book,{bookType:'xlsx',type:'array'});
}
