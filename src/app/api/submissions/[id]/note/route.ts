import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { SubmissionItem, NoteItem } from "@/lib/types";
import { sendLineToStudent } from "@/lib/line";

const DATA_FILE_PATH = path.join(process.cwd(), "data", "submissions.json");

function getSubmissions(): SubmissionItem[] {
  try {
    const raw = fs.readFileSync(DATA_FILE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSubmissions(list: SubmissionItem[]) {
  fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(list, null, 2), "utf-8");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const noteText = body.noteText || "";
    const newStatus = body.status;

    if (!noteText.trim()) {
      return NextResponse.json(
        { success: false, message: "กรุณาระบุข้อความโน้ต" },
        { status: 400 }
      );
    }

    const list = getSubmissions();
    const targetIndex = list.findIndex((item) => item.id === id);

    if (targetIndex === -1) {
      return NextResponse.json(
        { success: false, message: "ไม่พบข้อมูลโครงงานนี้" },
        { status: 404 }
      );
    }

    const submission = list[targetIndex];

    if (newStatus) {
      submission.status = newStatus;
    }

    // ส่งข้อความกลับเข้า LINE ของนักศึกษา
    const lineResult = await sendLineToStudent({
      studentLineId: submission.lineId,
      projectTitle: submission.projectTitle,
      noteText,
      advisorName: "อาจารย์ที่ปรึกษา (Admin)",
    });

    const newNote: NoteItem = {
      id: `NOTE-${Date.now()}`,
      author: "อาจารย์ที่ปรึกษา (Admin)",
      content: noteText,
      sentAt: new Date().toISOString(),
      sentToLineId: submission.lineId,
      deliveryStatus: lineResult.mode === "REAL_LINE" ? "SENT" : "SIMULATED",
    };

    if (!submission.notes) {
      submission.notes = [];
    }
    submission.notes.unshift(newNote);

    list[targetIndex] = submission;
    saveSubmissions(list);

    return NextResponse.json({
      success: true,
      message: "บันทึกและส่งโน้ตกลับไปยัง LINE นักศึกษาเรียบร้อยแล้ว",
      data: submission,
      lineResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}

