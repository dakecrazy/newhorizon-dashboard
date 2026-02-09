import fs from "fs";
import xlsx from "xlsx";

export function readEquity() {
  const wb = xlsx.readFile("equity.xlsx");
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet);
}

export function readAnalysis() {
  return fs.readFileSync("analysis.txt", "utf8");
}
