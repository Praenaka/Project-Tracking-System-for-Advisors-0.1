// ฟังก์ชันจัดการการส่งข้อความผ่าน LINE Messaging API
// รองรับทั้งการส่ง LINE จริง (เมื่อมี LINE_CHANNEL_ACCESS_TOKEN) และโหมดจำลอง (Simulator)

import fs from "fs";
import path from "path";

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

// ดึงค่าการตั้งค่า LINE จาก environment หรือไฟล์ .env.local โดยตรง
function getLineConfig() {
  let token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  let advisorLineId = process.env.LINE_ADVISOR_USER_ID;

  if (!token || !advisorLineId) {
    try {
      const envPath = path.join(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const raw = fs.readFileSync(envPath, "utf-8");
        const matchToken = raw.match(/LINE_CHANNEL_ACCESS_TOKEN="?([^"\n\r]+)"?/);
        const matchAdvisor = raw.match(/LINE_ADVISOR_USER_ID="?([^"\n\r]+)"?/);
        if (matchToken && !token) token = matchToken[1].trim();
        if (matchAdvisor && !advisorLineId) advisorLineId = matchAdvisor[1].trim();
      }
    } catch (e) {
      console.error("Read .env.local error:", e);
    }
  }
  return { token, advisorLineId };
}

interface SendAdvisorPayload {
  projectTitle: string;
  groupName: string;
  department: string;
  studentName: string;
  studentId: string;
  lineId: string;
  lineDisplayName?: string;
  pdfFileName: string;
  pdfFileUrl: string;
}

interface SendStudentPayload {
  studentLineId: string;
  projectTitle: string;
  noteText: string;
  advisorName?: string;
}

export async function sendLineToAdvisor(payload: SendAdvisorPayload): Promise<{
  success: boolean;
  mode: "REAL_LINE" | "SIMULATED";
  message: string;
  details?: any;
}> {
  const { token, advisorLineId } = getLineConfig();

  // ข้อความ Flex Message สวยงามที่จะส่งหาอาจารย์
  const flexMessage = {
    type: "flex",
    altText: `📬 มีการส่งโครงงานใหม่: ${payload.projectTitle}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#06C755",
        contents: [
          {
            type: "text",
            text: "📬 แจ้งเตือน: มีการส่งโครงการใหม่",
            weight: "bold",
            color: "#FFFFFF",
            size: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: payload.projectTitle,
            weight: "bold",
            size: "md",
            wrap: true,
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: `• ชื่อกลุ่ม: ${payload.groupName}`,
                size: "sm",
                color: "#555555",
              },
              {
                type: "text",
                text: `• สาขา: ${payload.department}`,
                size: "sm",
                color: "#555555",
              },
              {
                type: "text",
                text: `• ผู้จัดทำ: ${payload.studentName} (${payload.studentId})`,
                size: "sm",
                color: "#555555",
              },
              {
                type: "text",
                text: `• LINE นักศึกษา: ${payload.lineDisplayName ? `${payload.lineDisplayName} ` : ""}(${payload.lineId.startsWith("U") && payload.lineId.length > 20 ? "LIFF เชื่อมต่อสำเร็จ" : payload.lineId})`,
                size: "sm",
                color: "#1DB446",
                weight: "bold",
              },
              {
                type: "text",
                text: `• ไฟล์แนบ: ${payload.pdfFileName}`,
                size: "sm",
                color: "#666666",
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#06C755",
            action: {
              type: "uri",
              label: "🔍 เปิดหน้ารายงานเพื่อตรวจงาน",
              uri: `${getAppUrl()}/report`,
            },
          },
        ],
      },
    },
  };

  // ถ้ามีการเซ็ตค่า LINE Token จริงใน .env.local
  if (token && advisorLineId) {
    try {
      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: advisorLineId,
          messages: [flexMessage],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("LINE API Error:", errorText);
        return {
          success: false,
          mode: "REAL_LINE",
          message: `LINE API ส่งไม่สำเร็จ: ${errorText}`,
        };
      }

      return {
        success: true,
        mode: "REAL_LINE",
        message: `ส่งข้อความแจ้งเตือนเข้า LINE ของอาจารย์เรียบร้อยแล้ว`,
      };
    } catch (err: any) {
      console.error("LINE API Network Error:", err);
      return {
        success: false,
        mode: "REAL_LINE",
        message: err.message,
      };
    }
  }

  // โหมดจำลอง (Simulated Mode) เมื่อยังไม่ได้ใส่ Token จริง
  return {
    success: true,
    mode: "SIMULATED",
    message: `[จำลอง] ส่งแจ้งเตือนโครงการ "${payload.projectTitle}" เข้า LINE อาจารย์สำเร็จ (จำลองการทำงาน)`,
    details: flexMessage,
  };
}

export async function sendLineToStudent(payload: SendStudentPayload): Promise<{
  success: boolean;
  mode: "REAL_LINE" | "SIMULATED";
  message: string;
  details?: any;
}> {
  const { token } = getLineConfig();

  // ข้อความ Flex Message ส่งกลับหานักศึกษา
  const flexMessage = {
    type: "flex",
    altText: `📝 อาจารย์ได้ส่งโน้ตความคิดเห็นเกี่ยวกับโครงงาน: ${payload.projectTitle}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#2563EB",
        contents: [
          {
            type: "text",
            text: "📝 ข้อความตอบกลับจากอาจารย์ที่ปรึกษา",
            weight: "bold",
            color: "#FFFFFF",
            size: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: payload.projectTitle,
            weight: "bold",
            size: "sm",
            color: "#475569",
            wrap: true,
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#F1F5F9",
            paddingAll: "12px",
            cornerRadius: "8px",
            contents: [
              {
                type: "text",
                text: "💬 ความคิดเห็น / สิ่งที่ต้องปรับปรุง:",
                weight: "bold",
                size: "xs",
                color: "#1E293B",
              },
              {
                type: "text",
                text: payload.noteText,
                size: "sm",
                color: "#0F172A",
                margin: "sm",
                wrap: true,
              },
            ],
          },
          {
            type: "text",
            text: `ส่งถึง ID Line: ${payload.studentLineId}`,
            size: "xs",
            color: "#94A3B8",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#2563EB",
            action: {
              type: "uri",
              label: "📝 เปิดหน้าส่งงาน / ส่งฉบับแก้ไข",
              uri: `${getAppUrl()}/form`,
            },
          },
        ],
      },
    },
  };

  // ตรวจสอบว่า studentLineId เป็นรูปแบบ User ID ของ LINE หรือไม่ (ขึ้นต้นด้วย U...)
  const isLineUserId = payload.studentLineId.startsWith("U") && payload.studentLineId.length > 20;

  if (token && isLineUserId) {
    try {
      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: payload.studentLineId,
          messages: [flexMessage],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          mode: "REAL_LINE",
          message: `ไม่สามารถยิง LINE ไปยัง ID นี้ได้: ${errorText}`,
        };
      }

      return {
        success: true,
        mode: "REAL_LINE",
        message: `ส่งโน้ตเข้า LINE ของนักศึกษา (${payload.studentLineId}) เรียบร้อยแล้ว`,
      };
    } catch (err: any) {
      return {
        success: false,
        mode: "REAL_LINE",
        message: err.message,
      };
    }
  }

  // โหมดจำลอง (Simulated Mode)
  return {
    success: true,
    mode: "SIMULATED",
    message: `[จำลอง] ส่งโน้ตความคิดเห็นไปยัง ID Line "${payload.studentLineId}" สำเร็จเรียบร้อย`,
    details: flexMessage,
  };
}

