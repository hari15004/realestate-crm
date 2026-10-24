export async function downloadXlsx(
  filename: string,
  sheetName: string,
  columns: string[],
  rows: Record<string, unknown>[]
) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  sheet.columns = columns.map((c) => ({ header: c, key: c, width: 18 }))
  rows.forEach((r) => {
    const row: Record<string, string> = {}
    columns.forEach((c) => {
      const v = r[c]
      row[c] = v === null || v === undefined ? '' : String(v)
    })
    sheet.addRow(row)
  })
  sheet.getRow(1).font = { bold: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
