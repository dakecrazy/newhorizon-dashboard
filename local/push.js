import fetch from "node-fetch";
import { readEquity, readAnalysis } from "./parser.js";
import "dotenv/config";

export async function pushData() {
  await fetch(`${process.env.WORKER_URL}/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-update-key": process.env.UPDATE_KEY
    },
    body: JSON.stringify({
      equity: readEquity(),
      analysis: readAnalysis()
    })
  });
}
