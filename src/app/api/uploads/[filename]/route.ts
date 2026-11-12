import { NextRequest, NextResponse } from "next/server";
import { getUploadedFile } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const buffer = getUploadedFile(filename);

    if (!buffer) {
      return NextResponse.json(
        { success: false, message: "ไม่พบไฟล์เอกสารนี้" },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "เกิดข้อผิดพลาดในการเปิดไฟล์" },
      { status: 500 }
    );
  }
}

