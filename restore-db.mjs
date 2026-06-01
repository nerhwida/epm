import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupDir = path.join(__dirname, "backup");

if (!fs.existsSync(backupDir)) {
  console.error("backup/ 폴더를 찾을 수 없습니다.");
  process.exit(1);
}

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/epm";
await mongoose.connect(uri);

const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".json"));
let total = 0;

for (const file of files) {
  const collectionName = path.basename(file, ".json");
  const docs = JSON.parse(fs.readFileSync(path.join(backupDir, file), "utf-8"));

  if (!docs.length) {
    console.log(`  ${collectionName}: 0건 (건너뜀)`);
    continue;
  }

  const col = mongoose.connection.db.collection(collectionName);
  await col.deleteMany({});
  await col.insertMany(docs);
  console.log(`  ${collectionName}: ${docs.length}건 복원`);
  total += docs.length;
}

console.log(`\n복원 완료 (총 ${total}건)`);
await mongoose.disconnect();
