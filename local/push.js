import dotenv from "dotenv";
import { readEquity, readAnalysis } from "./parser.js";

dotenv.config({ path: "local/.env" });

export async function pushData() {
  const res = await fetch(`${process.env.WORKER_URL}/update`, {
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

  const text = await res.text();
  if (!res.ok) {
    console.error("Push failed:", res.status, text);
    return;
  }

  console.log("Push ok:", res.status, text);
}

await pushData();
