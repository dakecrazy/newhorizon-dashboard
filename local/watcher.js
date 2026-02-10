import chokidar from "chokidar";
import { pushData } from "./push.js";

chokidar.watch([
  "/Volumes/ACASIS_H1/cloudflare_template/sim_time_equity_data.csv",
  "/Volumes/ACASIS_H1/cloudflare_template/analysis.txt"
])
  .on("change", pushData);
