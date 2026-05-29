import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export async function connectDb(uri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
}

export async function ensureDefaultUsers() {
  const { User } = await import("./models/User.js");
  const count = await User.countDocuments();
  if (count > 0) return;

  const adminPw = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
  const userPw = process.env.DEFAULT_USER_PASSWORD || "user123";

  const hash = (pw) => bcrypt.hash(pw, 10);
  await User.insertMany([
    { username: "admin", password: await hash(adminPw), role: "admin" },
    { username: "user", password: await hash(userPw), role: "user" },
  ]);

  const warn = (id, pw, envKey) =>
    pw === (envKey === "DEFAULT_ADMIN_PASSWORD" ? "admin123" : "user123")
      ? `${id} / ${pw} [경고: 기본값 — .env의 ${envKey}로 변경 권장]`
      : `${id} / (설정값)`;

  console.log("기본 계정 생성:");
  console.log(" ", warn("admin", adminPw, "DEFAULT_ADMIN_PASSWORD"));
  console.log(" ", warn("user", userPw, "DEFAULT_USER_PASSWORD"));
}
