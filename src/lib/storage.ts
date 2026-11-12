import fs from "fs";
import path from "path";
import os from "os";
import { SubmissionItem } from "./types";

const LOCAL_DATA_PATH = path.join(process.cwd(), "data", "submissions.json");
const TMP_DATA_PATH = path.join(os.tmpdir(), "submissions.json");

function isVercel() {
  // Vercel sets VERCEL=1 but also sets VERCEL_URL and VERCEL_REGION in all envs
  return !!(
    process.env.VERCEL ||
    process.env.VERCEL_URL ||
    process.env.VERCEL_REGION ||
    process.env.NEXT_PUBLIC_APP_URL?.includes("vercel.app")
  );
}

export function ensureStorageDirs() {
  // สร้าง /tmp/uploads เสมอ (ใช้งานได้ทั้งบน Vercel และ Local)
  try {
    const tmpUploads = path.join(os.tmpdir(), "uploads");
    if (!fs.existsSync(tmpUploads)) {
      fs.mkdirSync(tmpUploads, { recursive: true });
    }
  } catch {}

  // หากเป็น Local Dev ให้สร้างโฟลเดอร์ในโปรเจกต์ด้วย
  if (!isVercel()) {
    try {
      const publicUploads = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(publicUploads)) {
        fs.mkdirSync(publicUploads, { recursive: true });
      }
      const rootUploads = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(rootUploads)) {
        fs.mkdirSync(rootUploads, { recursive: true });
      }
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch {}
  }
}

export function getSubmissions(): SubmissionItem[] {
  ensureStorageDirs();

  // บน Vercel ให้ลองอ่านจาก /tmp ก่อน (ข้อมูลที่มีการอัปเดตใหม่)
  if (isVercel()) {
    try {
      if (fs.existsSync(TMP_DATA_PATH)) {
        const raw = fs.readFileSync(TMP_DATA_PATH, "utf-8");
        return JSON.parse(raw);
      }
    } catch {}
  }

  // อ่านจากไฟล์ข้อมูลตั้งต้นของโปรเจกต์
  try {
    if (fs.existsSync(LOCAL_DATA_PATH)) {
      const raw = fs.readFileSync(LOCAL_DATA_PATH, "utf-8");
      const list = JSON.parse(raw);
      // ถ้าอยู่บน Vercel ให้คัดลอกลง /tmp เพื่อรองรับการเขียนทับในรอบถัดไป
      if (isVercel()) {
        try {
          fs.writeFileSync(TMP_DATA_PATH, raw, "utf-8");
        } catch {}
      }
      return list;
    }
  } catch (err) {
    console.error("Read submissions error:", err);
  }

  return [];
}

export function saveSubmissions(list: SubmissionItem[]): boolean {
  ensureStorageDirs();

  if (isVercel()) {
    try {
      fs.writeFileSync(TMP_DATA_PATH, JSON.stringify(list, null, 2), "utf-8");
      return true;
    } catch (err) {
      console.error("Save submissions to /tmp error:", err);
      return false;
    }
  }

  try {
    fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify(list, null, 2), "utf-8");
    return true;
  } catch (err) {
    // กรณีติด permission fallback ลง /tmp
    try {
      fs.writeFileSync(TMP_DATA_PATH, JSON.stringify(list, null, 2), "utf-8");
      return true;
    } catch {}
    console.error("Save submissions error:", err);
    return false;
  }
}

export async function saveUploadedFile(file: File): Promise<{ fileName: string; fileUrl: string }> {
  ensureStorageDirs();
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const savedFileName = `${timestamp}_${sanitizedFileName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // URL ชี้ไปที่ API endpoint เสมอ (ทั้ง Vercel และ Local)
  const fileUrl = `/api/uploads/${savedFileName}`;

  // 1. บันทึกลง /tmp/uploads เสมอ — เป็น directory เดียวที่เขียนได้บน Vercel
  const tmpFilePath = path.join(os.tmpdir(), "uploads", savedFileName);
  try {
    const tmpDir = path.join(os.tmpdir(), "uploads");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(tmpFilePath, buffer);
    console.log("File saved to tmp:", tmpFilePath);
  } catch (err) {
    console.error("Failed to write to /tmp/uploads:", err);
    throw new Error("ไม่สามารถบันทึกไฟล์ได้: " + (err as Error).message);
  }

  // 2. ถ้าไม่ใช่ Vercel (Local Dev) ให้บันทึกลง public/uploads ด้วย
  if (!isVercel()) {
    try {
      const publicFilePath = path.join(process.cwd(), "public", "uploads", savedFileName);
      fs.writeFileSync(publicFilePath, buffer);
    } catch {}
  }

  return { fileName: file.name, fileUrl };
}

export function getUploadedFile(filename: string): Buffer | null {
  // 1. ตรวจสอบใน /tmp/uploads
  try {
    const tmpPath = path.join(os.tmpdir(), "uploads", filename);
    if (fs.existsSync(tmpPath)) {
      return fs.readFileSync(tmpPath);
    }
  } catch {}

  // 2. ตรวจสอบใน public/uploads
  try {
    const publicPath = path.join(process.cwd(), "public", "uploads", filename);
    if (fs.existsSync(publicPath)) {
      return fs.readFileSync(publicPath);
    }
  } catch {}

  // 3. ตรวจสอบใน root uploads
  try {
    const rootPath = path.join(process.cwd(), "uploads", filename);
    if (fs.existsSync(rootPath)) {
      return fs.readFileSync(rootPath);
    }
  } catch {}

  return null;
}

