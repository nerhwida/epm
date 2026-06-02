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

  // 문자열 _id를 ObjectId로 변환 (JSON 직렬화 시 ObjectId가 문자열로 저장된 경우 복원)
  const { ObjectId } = mongoose.Types;
  const processed = docs.map((doc) => {
    if (typeof doc._id === "string" && /^[0-9a-f]{24}$/i.test(doc._id)) {
      return { ...doc, _id: ObjectId.createFromHexString(doc._id) };
    }
    return doc;
  });

  const col = mongoose.connection.db.collection(collectionName);
  await col.deleteMany({});
  await col.insertMany(processed);
  console.log(`  ${collectionName}: ${processed.length}건 복원`);
  total += docs.length;
}

console.log(`\n복원 완료 (총 ${total}건)`);
await mongoose.disconnect();
