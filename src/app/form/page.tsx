"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FormRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?tab=FORM&role=general");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-700 font-sans p-4">
      <div className="w-10 h-10 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin mb-4" />
      <h2 className="text-base font-bold text-slate-800">กำลังเปิดหน้ากรอกแบบฟอร์มส่งโครงงาน...</h2>
      <p className="text-xs text-slate-400 mt-1">ระบบกำลังเตรียมแบบฟอร์มสำหรับนักศึกษา</p>
    </div>
  );
}

