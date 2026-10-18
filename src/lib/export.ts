/** Export CSV (UTF-8 BOM pour Excel) et utilitaires d'impression */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): void {
  const sep = ';'
  const escape = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const content = [
    headers.map(escape).join(sep),
    ...rows.map((r) => r.map(escape).join(sep)),
  ].join('\r\n')

  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Ouvre la boîte d'impression (export PDF via le navigateur) */
export function printPdf(): void {
  window.print()
}

/** Téléversement générique d'un texte (modèle CSV…) */
export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([`\uFEFF${content}`], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
