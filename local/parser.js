import fs from "fs";
import xlsx from "xlsx";

const EQUITY_CSV_PATH = "/Volumes/ACASIS_H1/cloudflare_template/sim_time_equity_data.csv";
const ANALYSIS_PATH = "/Volumes/ACASIS_H1/cloudflare_template/analysis.txt";

export function readEquity() {
  const wb = xlsx.readFile(EQUITY_CSV_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  return rows.map(row => ({
    time: row.sim_time,
    value: row.equity_value
  }));
}

export function readAnalysis() {
  return fs.readFileSync(ANALYSIS_PATH, "utf8");
}
