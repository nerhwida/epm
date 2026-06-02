import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const dateArg = process.argv[2];
if (!dateArg) {
  console.error("사용법: node export-by-date.mjs <발령일자>");
  console.error("예시:   node export-by-date.mjs 2013.3.1");
  console.error("        node export-by-date.mjs \"2013. 3. 1.\"");
  process.exit(1);
}

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/epm";
await mongoose.connect(uri);

const col = mongoose.connection.db.collection("appointments");

// 발령일자 부분 일치 검색 (공백 유무 모두 허용)
const docs = await col.find({
  appointment_date: { $regex: dateArg.replace(/\s+/g, "\\s*"), $options: "i" },
}).toArray();

if (!docs.length) {
  console.log(`발령일자 "${dateArg}"에 해당하는 데이터가 없습니다.`);
  await mongoose.disconnect();
  process.exit(0);
}

// 파일명: parsed-YYYYMMDD.json 형태로 생성
const safeDate = dateArg.replace(/[\s.\/\\:*?"<>|]/g, "").replace(/\s+/g, "");
const fileName = `parsed-${safeDate}.json`;
fs.writeFileSync(fileName, JSON.stringify(docs, null, 2), "utf-8");

console.log(`${docs.length}건 → ${fileName}`);
await mongoose.disconnect();
