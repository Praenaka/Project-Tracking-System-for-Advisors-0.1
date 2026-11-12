import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ENV_LOCAL_PATH = path.join(process.cwd(), ".env.local");

export async function GET() {
  let token = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
  let advisorId = process.env.LINE_ADVISOR_USER_ID || "";
  let liffId = process.env.NEXT_PUBLIC_LIFF_ID || "";

  if ((!token || !advisorId || !liffId) && fs.existsSync(ENV_LOCAL_PATH)) {
    try {
      const raw = fs.readFileSync(ENV_LOCAL_PATH, "utf-8");
      const matchToken = raw.match(/LINE_CHANNEL_ACCESS_TOKEN="?([^"\n\r]+)"?/);
      const matchAdvisor = raw.match(/LINE_ADVISOR_USER_ID="?([^"\n\r]+)"?/);
      const matchLiff = raw.match(/NEXT_PUBLIC_LIFF_ID="?([^"\n\r]+)"?/);
      if (matchToken && !token) token = matchToken[1].trim();
      if (matchAdvisor && !advisorId) advisorId = matchAdvisor[1].trim();
      if (matchLiff && !liffId) liffId = matchLiff[1].trim();
    } catch {}
  }

  return NextResponse.json({
    isConfigured: !!(token && advisorId),
    hasToken: !!token,
    hasAdvisorId: !!advisorId,
    advisorIdMasked: advisorId ? `${advisorId.slice(0, 4)}...${advisorId.slice(-4)}` : "",
    liffId: liffId || "",
    hasLiffId: !!liffId,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { channelAccessToken, advisorLineId, liffId: newLiffId } = await req.json();

    // กรณีต้องการอัปเดตเฉพาะ LIFF ID อย่างเดียว
    if (newLiffId !== undefined && (!channelAccessToken?.trim() || !advisorLineId?.trim())) {
      let existingContent = "";
      if (fs.existsSync(ENV_LOCAL_PATH)) {
        existingContent = fs.readFileSync(ENV_LOCAL_PATH, "utf-8");
      }
      let newContent = existingContent;
      if (newContent.includes("NEXT_PUBLIC_LIFF_ID=")) {
        newContent = newContent.replace(/NEXT_PUBLIC_LIFF_ID="?[^"\n\r]*"?/, `NEXT_PUBLIC_LIFF_ID="${newLiffId.trim()}"`);
      } else {
        newContent += `\nNEXT_PUBLIC_LIFF_ID="${newLiffId.trim()}"\n`;
      }
      try {
        fs.writeFileSync(ENV_LOCAL_PATH, newContent, "utf-8");
      } catch {}
      const liffKey = "NEXT_PUBLIC_LIFF_ID";
      process.env[liffKey] = newLiffId.trim();
      return NextResponse.json({
        success: true,
        message: "บันทึกค่า LIFF ID เรียบร้อยแล้ว พร้อมใช้งาน",
        liffId: newLiffId.trim(),
      });
    }

    if (!channelAccessToken?.trim() || !advisorLineId?.trim()) {
      return NextResponse.json(
        { success: false, message: "กรุณาระบุทั้ง Channel Access Token และ Advisor LINE User ID" },
        { status: 400 }
      );
    }

    // 1. ทดสอบยิงข้อความจริงไปยัง LINE เพื่อตรวจสอบว่า Token และ User ID ถูกต้องหรือไม่
    const testMessage = {
      to: advisorLineId.trim(),
      messages: [
        {
          type: "flex",
          altText: "🎉 ทดสอบการเชื่อมต่อระบบติดตามโครงงานสำเร็จ!",
          contents: {
            type: "bubble",
            header: {
              type: "box",
              layout: "vertical",
              backgroundColor: "#06C755",
              contents: [
                {
                  type: "text",
                  text: "🎉 ยินดีด้วย! เชื่อมต่อ LINE สำเร็จ",
                  weight: "bold",
                  color: "#FFFFFF",
                  size: "md",
                },
              ],
            },
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "ระบบติดตามโครงงานของอาจารย์ที่ปรึกษา",
                  weight: "bold",
                  size: "sm",
                },
                {
                  type: "text",
                  text: "ขณะนี้ระบบเชื่อมต่อกับบัญชี LINE ของท่านเรียบร้อยแล้ว เมื่อนักศึกษาส่งงาน จะมีข้อความแจ้งเตือนเข้ามาที่นี่โดยอัตโนมัติครับ",
                  size: "xs",
                  color: "#555555",
                  wrap: true,
                  margin: "md",
                },
              ],
            },
          },
        },
      ],
    };

    const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken.trim()}`,
      },
      body: JSON.stringify(testMessage),
    });

    if (!lineRes.ok) {
      const errorText = await lineRes.text();
      return NextResponse.json(
        {
          success: false,
          message: `LINE ตรวจสอบไม่ผ่าน: ${errorText} (กรุณาเช็กว่า Token และ User ID ถูกต้อง)`,
        },
        { status: 400 }
      );
    }

    // 2. บันทึกลง .env.local (ถ้าสามารถเขียนได้)
    try {
      let existingContent = "";
      if (fs.existsSync(ENV_LOCAL_PATH)) {
        existingContent = fs.readFileSync(ENV_LOCAL_PATH, "utf-8");
      }
      
      const liffVal = (newLiffId !== undefined ? newLiffId : (process.env.NEXT_PUBLIC_LIFF_ID || "")).trim();
      const channelIdMatch = existingContent.match(/LINE_CHANNEL_ID="?([^"\n\r]+)"?/);
      const channelSecretMatch = existingContent.match(/LINE_CHANNEL_SECRET="?([^"\n\r]+)"?/);
      const appUrlMatch = existingContent.match(/NEXT_PUBLIC_APP_URL="?([^"\n\r]+)"?/);

      const channelId = channelIdMatch ? channelIdMatch[1] : (process.env.LINE_CHANNEL_ID || "");
      const channelSecret = channelSecretMatch ? channelSecretMatch[1] : (process.env.LINE_CHANNEL_SECRET || "");
      const appUrl = appUrlMatch ? appUrlMatch[1] : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

      const envContent = `LINE_CHANNEL_ID="${channelId}"\nLINE_CHANNEL_SECRET="${channelSecret}"\nLINE_CHANNEL_ACCESS_TOKEN="${channelAccessToken.trim()}"\nLINE_ADVISOR_USER_ID="${advisorLineId.trim()}"\nNEXT_PUBLIC_LIFF_ID="${liffVal}"\nNEXT_PUBLIC_APP_URL="${appUrl}"\n`;
      fs.writeFileSync(ENV_LOCAL_PATH, envContent, "utf-8");
    } catch (e) {
      console.log("Read-only environment, skipping local file write");
    }

    // อัปเดตตัวแปรใน runtime ทันที
    process.env.LINE_CHANNEL_ACCESS_TOKEN = channelAccessToken.trim();
    process.env.LINE_ADVISOR_USER_ID = advisorLineId.trim();
    if (newLiffId !== undefined) {
      const liffKey = "NEXT_PUBLIC_LIFF_ID";
      process.env[liffKey] = newLiffId.trim();
    }

    return NextResponse.json({
      success: true,
      message: "เชื่อมต่อสำเร็จ! ข้อความทดสอบได้ถูกส่งไปยังแอป LINE บนมือถือของคุณเรียบร้อยแล้ว",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "เกิดข้อผิดพลาดในการบันทึกค่า" },
      { status: 500 }
    );
  }
}

