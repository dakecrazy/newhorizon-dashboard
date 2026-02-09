import chokidar from "chokidar";
import { pushData } from "./push.js";

chokidar.watch(["equity.xlsx", "analysis.txt"])
  .on("change", pushData);
