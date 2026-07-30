export function parseStatusFiles(output) {
  if (!output) {
    return []
  }
  const records = output.split('\0').filter(Boolean)
  const files = []
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    const status = record.slice(0, 2)
    files.push(record.slice(3))
    if (status.includes('R') || status.includes('C')) {
      index += 1
      if (records[index]) {
        files.push(records[index])
      }
    }
  }
  return files
}
