import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { SubmissionItem } from "@/lib/types";
import { sendLineToAdvisor } from "@/lib/line";

const DATA_FILE_PATH = path.join(process.cwd(), "data", "submissions.json");
const PUBLIC_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const ROOT_UPLOADS_DIR = path.join(process.cwd(), "uploads");

function ensureDirs() {
  if (!fs.existsSync(path.dirname(DATA_FILE_PATH))) {
    fs.mkdirSync(path.dirname(DATA_FILE_PATH), { recursive: true });
  }
  if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) {
    fs.mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(ROOT_UPLOADS_DIR)) {
    fs.mkdirSync(ROOT_UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE_PATH)) {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify([], null, 2), "utf-8");
  }
}

function getSubmissions(): SubmissionItem[] {
  ensureDirs();
  try {
    const raw = fs.readFileSync(DATA_FILE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSubmissions(list: SubmissionItem[]) {
  ensureDirs();
  fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(list, null, 2), "utf-8");
}

export async function GET() {
  const items = getSubmissions();
  return NextResponse.json({ success: true, data: items });
}

export async function POST(req: NextRequest) {
  try {
    ensureDirs();
    const formData = await req.formData();

    const projectTitle = (formData.get("projectTitle") as string) || "ไม่ระบุชื่อโครงงาน";
    const groupName = (formData.get("groupName") as string) || "ไม่ระบุชื่อกลุ่ม";
    const department = (formData.get("department") as string) || "ไม่ระบุสาขา";
    const studentName = (formData.get("studentName") as string) || "ไม่ระบุชื่อ";
    const studentId = (formData.get("studentId") as string) || "ไม่ระบุรหัส";
    const lineId = (formData.get("lineId") as string) || "";
    const file = formData.get("pdfFile") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: "กรุณาแนบไฟล์ PDF" }, { status: 400 });
    }

    // สร้างชื่อไฟล์ที่ปลอดภัยและไม่ซ้ำ
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const savedFileName = `${timestamp}_${sanitizedFileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // บันทึกลง public/uploads (เพื่อให้เปิดดูผ่าน URL ได้)
    const publicFilePath = path.join(PUBLIC_UPLOADS_DIR, savedFileName);
    fs.writeFileSync(publicFilePath, buffer);

    // บันทึกลง root/uploads ตามที่โจทย์ระบุ
    const rootFilePath = path.join(ROOT_UPLOADS_DIR, savedFileName);
    fs.writeFileSync(rootFilePath, buffer);

    const newSubmission: SubmissionItem = {
      id: `SUB-${timestamp}`,
      projectTitle,
      groupName,
      department,
      studentName,
      studentId,
      lineId,
      pdfFileName: file.name,
      pdfFileUrl: `/uploads/${savedFileName}`,
      submittedAt: new Date().toISOString(),
      status: "PENDING",
      notes: [],
    };

    const currentList = getSubmissions();
    currentList.unshift(newSubmission);
    saveSubmissions(currentList);

    // ส่งการแจ้งเตือนไปยัง LINE อาจารย์
    const lineResult = await sendLineToAdvisor({
      projectTitle,
      groupName,
      department,
      studentName,
      studentId,
      lineId,
      pdfFileName: file.name,
      pdfFileUrl: `/uploads/${savedFileName}`,
    });

    return NextResponse.json({
      success: true,
      message: "บันทึกข้อมูลโครงงานเรียบร้อยแล้ว",
      data: newSubmission,
      lineResult,
    });
  } catch (error: any) {
    console.error("Submission API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล" },
      { status: 500 }
    );
  }
}

