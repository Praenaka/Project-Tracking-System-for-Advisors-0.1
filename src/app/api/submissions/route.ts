import { NextRequest, NextResponse } from "next/server";
import { SubmissionItem } from "@/lib/types";
import { sendLineToAdvisor } from "@/lib/line";
import { getSubmissions, saveSubmissions, saveUploadedFile } from "@/lib/storage";

export async function GET() {
  const items = getSubmissions();
  return NextResponse.json({ success: true, data: items });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const projectTitle = (formData.get("projectTitle") as string) || "ไม่ระบุชื่อโครงงาน";
    const groupName = (formData.get("groupName") as string) || "ไม่ระบุชื่อกลุ่ม";
    const department = (formData.get("department") as string) || "ไม่ระบุสาขา";
    const studentName = (formData.get("studentName") as string) || "ไม่ระบุชื่อ";
    const studentId = (formData.get("studentId") as string) || "ไม่ระบุรหัส";
    const lineId = (formData.get("lineId") as string) || "";
    const lineDisplayName = (formData.get("lineDisplayName") as string) || undefined;
    const linePictureUrl = (formData.get("linePictureUrl") as string) || undefined;
    const file = formData.get("pdfFile") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: "กรุณาแนบไฟล์ PDF" }, { status: 400 });
    }

    // จัดเก็บไฟล์แบบปลอดภัย (รองรับทั้ง Vercel Serverless และ Local)
    const { fileName, fileUrl } = await saveUploadedFile(file);

    const timestamp = Date.now();
    const newSubmission: SubmissionItem = {
      id: `SUB-${timestamp}`,
      projectTitle,
      groupName,
      department,
      studentName,
      studentId,
      lineId,
      lineDisplayName,
      linePictureUrl,
      pdfFileName: fileName,
      pdfFileUrl: fileUrl,
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
      lineDisplayName,
      pdfFileName: fileName,
      pdfFileUrl: fileUrl,
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
