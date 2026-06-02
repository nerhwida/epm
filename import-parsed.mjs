/*
사용 흐름:

개발 서버에서 내보내기:


# 발령일자로 추출 (다양한 형식 지원)
node export-by-date.mjs "2013. 3. 1."
node export-by-date.mjs 2013.3.1
→ parsed-2013.3.1..json 파일 생성

운영 서버에서 가져오기:


# 파일 복사 후
node import-parsed.mjs parsed-2013.3.1..json
여러 날짜를 한 번에 보내려면 파일을 여러 개 만들어 순서대로 실행하면 됩니다.
*/

import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const filePath = process.argv[2];
if (!filePath) {
  console.error("사용법: node import-parsed.mjs <파일경로>");
  console.error("예시:   node import-parsed.mjs parsed-2026-06-01.json");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`파일을 찾을 수 없습니다: ${filePath}`);
  process.exit(1);
}

const docs = JSON.parse(fs.readFileSync(filePath, "utf-8"));
if (!Array.isArray(docs) || !docs.length) {
  console.error("유효한 데이터가 없습니다.");
  process.exit(1);
}

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/epm";
await mongoose.connect(uri);

const col = mongoose.connection.db.collection("appointments");
const result = await col.insertMany(docs);
console.log(`완료: ${result.insertedCount}건 추가됨`);

await mongoose.disconnect();
