"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReportRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?tab=REPORT&role=admin");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-700 font-sans p-4">
      <div className="w-10 h-10 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin mb-4" />
      <h2 className="text-base font-bold text-slate-800">กำลังเปิดหน้ารายงานสำหรับอาจารย์ที่ปรึกษา...</h2>
      <p className="text-xs text-slate-400 mt-1">ระบบกำลังเข้าสู่ระบบและนำท่านไปยังหน้ารายการโครงงาน</p>
    </div>
  );
}

