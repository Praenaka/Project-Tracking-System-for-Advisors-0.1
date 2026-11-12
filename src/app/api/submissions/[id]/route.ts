import { NextRequest, NextResponse } from "next/server";
import { SubmissionItem, ProjectStatus } from "@/lib/types";
import { sendLineToStudent } from "@/lib/line";
import { getSubmissions, saveSubmissions } from "@/lib/storage";

// อัปเดตสถานะโครงการ (PATCH)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, noteText } = body as { status?: ProjectStatus; noteText?: string };

    const list = getSubmissions();
    const targetIndex = list.findIndex((item) => item.id === id);

    if (targetIndex === -1) {
      return NextResponse.json(
        { success: false, message: "ไม่พบข้อมูลโครงงานนี้" },
        { status: 404 }
      );
    }

    const submission = list[targetIndex];

    if (status) {
      submission.status = status;
    }

    // ถ้ามีการแนบโน้ตมาพร้อมการเปลี่ยนสถานะ
    if (noteText && noteText.trim()) {
      const lineResult = await sendLineToStudent({
        studentLineId: submission.lineId,
        projectTitle: submission.projectTitle,
        noteText: noteText.trim(),
        advisorName: "อาจารย์ที่ปรึกษา (Admin)",
      });

      const newNote = {
        id: `NOTE-${Date.now()}`,
        author: "อาจารย์ที่ปรึกษา (Admin)",
        content: noteText.trim(),
        sentAt: new Date().toISOString(),
        sentToLineId: submission.lineId,
        deliveryStatus: (lineResult.mode === "REAL_LINE" ? "SENT" : "SIMULATED") as "SENT" | "SIMULATED",
      };

      if (!submission.notes) {
        submission.notes = [];
      }
      submission.notes.unshift(newNote);
    }

    list[targetIndex] = submission;
    saveSubmissions(list);

    return NextResponse.json({
      success: true,
      message: `อัปเดตสถานะโครงงานเป็น "${status}" เรียบร้อยแล้ว`,
      data: submission,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}

// ลบรายการโครงงาน (DELETE)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const list = getSubmissions();
    const targetIndex = list.findIndex((item) => item.id === id);

    if (targetIndex === -1) {
      return NextResponse.json(
        { success: false, message: "ไม่พบข้อมูลโครงงานที่ต้องการลบ" },
        { status: 404 }
      );
    }

    const removedItem = list.splice(targetIndex, 1)[0];
    saveSubmissions(list);

    return NextResponse.json({
      success: true,
      message: `ลบโครงงาน "${removedItem.projectTitle}" เรียบร้อยแล้ว`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "เกิดข้อผิดพลาดในการลบ" },
      { status: 500 }
    );
  }
}
