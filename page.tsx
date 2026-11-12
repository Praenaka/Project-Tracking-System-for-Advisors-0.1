"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Send,
  CheckCircle2,
  Clock,
  Users,
  MessageSquare,
  Smartphone,
  Upload,
  ExternalLink,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  ArrowRight,
  LogOut,
  RefreshCw,
  FolderOpen,
  Info,
  Check,
  AlertCircle,
  Settings,
  Globe,
  Lock,
  Search,
  Download,
  Trash2,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Layers,
  Calendar,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { SubmissionItem, UserRole, ProjectStatus } from "@/lib/types";

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  isMock?: boolean;
}

export default function AppMain() {
  // สิทธิ์ผู้ใช้งาน: "admin" (อาจารย์), "general" (นักศึกษา), null (ยังไม่ล็อกอิน)
  const [currentUser, setCurrentUser] = useState<UserRole>("general");
  const [activeTab, setActiveTab] = useState<"FORM" | "REPORT" | "LINE_PREVIEW" | "SETTINGS">("FORM");

  // ข้อมูลโครงงานทั้งหมด (ดึงจาก data/submissions.json)
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ระบบค้นหาและตัวกรอง
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "TITLE">("NEWEST");

  // ข้อมูลฟอร์มกรอกงาน (นักศึกษา)
  const [formData, setFormData] = useState({
    projectTitle: "",
    groupName: "",
    department: "วิทยาการคอมพิวเตอร์",
    studentName: "",
    studentId: "",
    lineId: "",
    lineDisplayName: "",
    linePictureUrl: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // สถานะ LINE LIFF (LINE Front-end Framework)
  const [liffProfile, setLiffProfile] = useState<LiffProfile | null>(null);
  const [isLiffReady, setIsLiffReady] = useState<boolean>(false);
  const [isLiffLoading, setIsLiffLoading] = useState<boolean>(true);
  const [liffError, setLiffError] = useState<string | null>(null);

  // โมดอลเขียนโน้ตของอาจารย์
  const [activeModalItem, setActiveModalItem] = useState<SubmissionItem | null>(null);
  const [noteInput, setNoteInput] = useState<string>("");
  const [noteStatus, setNoteStatus] = useState<ProjectStatus>("NEEDS_REVISION");
  const [isSendingNote, setIsSendingNote] = useState<boolean>(false);

  // โมดอลยืนยันการลบ
  const [itemToDelete, setItemToDelete] = useState<SubmissionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // ระบบเช็กสถานะตนเองของนักศึกษา
  const [studentSearchKeyword, setStudentSearchKeyword] = useState<string>("");

  // การตั้งค่า LINE สำหรับใช้งานจริง
  const [lineSettings, setLineSettings] = useState({
    token: "",
    advisorId: "",
    liffId: "",
  });
  const [lineStatus, setLineStatus] = useState<{
    isConfigured: boolean;
    advisorIdMasked?: string;
    advisorId?: string;
    liffId?: string;
    hasLiffId?: boolean;
  }>({ isConfigured: false });
  const [isSavingLine, setIsSavingLine] = useState<boolean>(false);

  // ระบบแยกสิทธิ์ผู้ใช้งาน (Role Separation & Security)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>("");
  const [adminPinError, setAdminPinError] = useState<string | null>(null);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);

  // แจ้งเตือนสถานะสำเร็จ (Toast)
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // โหลดข้อมูลโครงงานจาก API
  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/submissions");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSubmissions(json.data);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // เริ่มต้นทำงาน LINE LIFF SDK
  const initLiff = async (targetLiffId?: string, configuredAdvisorId?: string) => {
    const liffIdToUse = targetLiffId || process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffIdToUse) {
      setIsLiffLoading(false);
      return;
    }

    try {
      setIsLiffLoading(true);
      // @ts-ignore
      const liff = typeof window !== "undefined" ? window.liff : null;
      if (!liff) {
        setIsLiffLoading(false);
        return;
      }

      await liff.init({ liffId: liffIdToUse });
      setIsLiffReady(true);

      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        const userProfile: LiffProfile = {
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          statusMessage: profile.statusMessage,
          isMock: false,
        };
        setLiffProfile(userProfile);

        // ตรวจสอบสิทธิ์อัตโนมัติจาก LINE User ID:
        // ถ้ารหัส LINE ตรงกับอาจารย์ที่ปรึกษา -> เปิดหน้ารายงานและให้สิทธิ์ Admin ทันที
        // ถ้ารหัส LINE เป็นของนักศึกษา -> ให้สิทธิ์ General และแสดงเฉพาะฟอร์มส่งงาน
        const targetAdvId = configuredAdvisorId || lineStatus.advisorId || "U41bd7b5a88f4dff8fd2ea69d9b34a873";
        const isAdvisor = profile.userId === targetAdvId;

        if (isAdvisor) {
          setCurrentUser("admin");
          setIsAdminAuthenticated(true);
          setActiveTab("REPORT");
          setToastMessage(`👨‍🏫 ยินดีต้อนรับ อาจารย์ ${profile.displayName} (เข้าสู่ระบบอาจารย์อัตโนมัติ)`);
        } else {
          setCurrentUser("general");
          setIsAdminAuthenticated(false);
          setActiveTab("FORM");
          setFormData((prev) => ({
            ...prev,
            lineId: profile.userId,
            studentName: prev.studentName ? prev.studentName : profile.displayName,
            lineDisplayName: profile.displayName,
            linePictureUrl: profile.pictureUrl || "",
          }));
          setToastMessage(`🎓 ยินดีต้อนรับ ${profile.displayName} (นักศึกษา)`);
        }
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err: any) {
      console.error("LIFF Init error:", err);
      setLiffError(err.message || "เกิดข้อผิดพลาดในการโหลด LIFF");
    } finally {
      setIsLiffLoading(false);
    }
  };

  // เช็กสถานะการตั้งค่า LINE
  const fetchLineStatus = async () => {
    try {
      const res = await fetch("/api/settings/line");
      const data = await res.json();
      setLineStatus(data);
      const advId = data.advisorId || "U41bd7b5a88f4dff8fd2ea69d9b34a873";
      if (data.liffId) {
        setLineSettings((prev) => ({ ...prev, liffId: data.liffId, advisorId: advId }));
        initLiff(data.liffId, advId);
      } else if (process.env.NEXT_PUBLIC_LIFF_ID) {
        initLiff(process.env.NEXT_PUBLIC_LIFF_ID, advId);
      } else {
        setIsLiffLoading(false);
      }
    } catch (err) {
      console.error("Fetch line status error:", err);
      setIsLiffLoading(false);
    }
  };

  const handleLiffLogin = () => {
    // @ts-ignore
    const liff = typeof window !== "undefined" ? window.liff : null;
    if (liff && isLiffReady) {
      liff.login();
    } else {
      alert("ยังไม่ได้ตั้งค่า LIFF ID หรือ LIFF กำลังโหลด กรุณาตรวจสอบในแท็บตั้งค่า LINE ครับ");
    }
  };

  const handleLiffLogout = () => {
    // @ts-ignore
    const liff = typeof window !== "undefined" ? window.liff : null;
    try {
      if (liff && liff.isLoggedIn()) {
        liff.logout();
      }
    } catch {}
    setLiffProfile(null);
    setFormData((prev) => ({
      ...prev,
      lineId: "",
      lineDisplayName: "",
      linePictureUrl: "",
    }));
    setToastMessage("ออกจากระบบ LINE เรียบร้อยแล้ว");
    setTimeout(() => setToastMessage(null), 3000);
  };

  // จำลองการเชื่อมต่อ LIFF สำหรับทดสอบบน Localhost
  const handleMockLiff = () => {
    const mockProfile: LiffProfile = {
      userId: "U_STUDENT_MOCK_123456789",
      displayName: "นายธนกฤต วิเศษ (LINE)",
      pictureUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=student_line",
      statusMessage: "นักศึกษา TU วท.บ.วิทยาการคอมพิวเตอร์",
      isMock: true,
    };
    setLiffProfile(mockProfile);
    setCurrentUser("general");
    setIsAdminAuthenticated(false);
    setActiveTab("FORM");
    setFormData((prev) => ({
      ...prev,
      lineId: mockProfile.userId,
      studentName: prev.studentName ? prev.studentName : "นายธนกฤต วิเศษ",
      lineDisplayName: mockProfile.displayName,
      linePictureUrl: mockProfile.pictureUrl || "",
    }));
    setToastMessage("📲 จำลองเชื่อมต่อ LINE (นักศึกษา) สำเร็จ");
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ฟังก์ชันยืนยันรหัสผ่านอาจารย์ (PIN)
  const handleAdminPinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPin = adminPinInput.trim();
    const validAdvisorId = lineStatus.advisorId || "U41bd7b5a88f4dff8fd2ea69d9b34a873";
    if (
      cleanPin === "1234" ||
      cleanPin === "tu1234" ||
      cleanPin === "tu2026" ||
      cleanPin.toLowerCase() === "admin" ||
      cleanPin === validAdvisorId
    ) {
      setIsAdminAuthenticated(true);
      setCurrentUser("admin");
      setActiveTab("REPORT");
      setShowAdminLoginModal(false);
      setAdminPinInput("");
      setAdminPinError(null);
      setToastMessage("เข้าสู่ระบบสำหรับอาจารย์ที่ปรึกษาสำเร็จ");
      setTimeout(() => setToastMessage(null), 3000);
    } else {
      setAdminPinError("รหัสผ่านไม่ถูกต้อง (รหัสเริ่มต้น: 1234)");
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setCurrentUser("general");
    setActiveTab("FORM");
    setToastMessage("ออกจากระบบอาจารย์แล้ว กลับสู่มุมมองนักศึกษา");
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    fetchSubmissions();
    fetchLineStatus();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      const roleParam = params.get("role");

      if (tabParam?.toUpperCase() === "REPORT" || roleParam === "admin") {
        setCurrentUser("admin");
        setActiveTab("REPORT");
      } else if (tabParam?.toUpperCase() === "FORM" || roleParam === "general") {
        setCurrentUser("general");
        setActiveTab("FORM");
      } else if (tabParam?.toUpperCase() === "SETTINGS") {
        setCurrentUser("admin");
        setActiveTab("SETTINGS");
      }
    }
  }, []);

  // เมื่อเปลี่ยนสิทธิ์ ให้ปรับแท็บอัตโนมัติ
  const handleSelectRole = (role: UserRole) => {
    if (role === "admin" && !isAdminAuthenticated) {
      setShowAdminLoginModal(true);
      return;
    }
    setCurrentUser(role);
    if (role === "admin") {
      setActiveTab("REPORT");
    } else if (role === "general") {
      setActiveTab("FORM");
    }
  };

  // สรุปสถิติ (KPIs)
  const stats = useMemo(() => {
    const total = submissions.length;
    const pending = submissions.filter((s) => s.status === "PENDING" || !s.status).length;
    const needsRevision = submissions.filter((s) => s.status === "NEEDS_REVISION").length;
    const approved = submissions.filter((s) => s.status === "APPROVED").length;
    return { total, pending, needsRevision, approved };
  }, [submissions]);

  // ดึงรายการสาขาวิชาทั้งหมดที่มี
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    submissions.forEach((s) => {
      if (s.department) set.add(s.department);
    });
    return Array.from(set);
  }, [submissions]);

  // รายการที่ผ่านการกรองและเรียงลำดับ
  const filteredSubmissions = useMemo(() => {
    return submissions
      .filter((item) => {
        const query = searchQuery.trim().toLowerCase();
        const matchSearch =
          !query ||
          item.projectTitle.toLowerCase().includes(query) ||
          item.groupName.toLowerCase().includes(query) ||
          item.studentName.toLowerCase().includes(query) ||
          item.studentId.includes(query) ||
          item.lineId.toLowerCase().includes(query);

        const currentStatus = item.status || "PENDING";
        const matchStatus = statusFilter === "ALL" || currentStatus === statusFilter;
        const matchDepartment = departmentFilter === "ALL" || item.department === departmentFilter;

        return matchSearch && matchStatus && matchDepartment;
      })
      .sort((a, b) => {
        if (sortBy === "NEWEST") {
          return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        }
        if (sortBy === "OLDEST") {
          return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
        }
        return a.projectTitle.localeCompare(b.projectTitle, "th");
      });
  }, [submissions, searchQuery, statusFilter, departmentFilter, sortBy]);

  // การแสดงผล Badge สถานะ
  const getStatusBadge = (status?: ProjectStatus) => {
    switch (status) {
      case "APPROVED":
        return {
          label: "ผ่านการอนุมัติ",
          className: "bg-emerald-100 text-emerald-800 border-emerald-300",
          icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />,
        };
      case "NEEDS_REVISION":
        return {
          label: "มีข้อเสนอแนะ/รอปรับปรุง",
          className: "bg-blue-100 text-blue-800 border-blue-300",
          icon: <AlertCircle className="w-3.5 h-3.5 text-blue-600" />,
        };
      case "REJECTED":
        return {
          label: "ไม่อนุมัติ",
          className: "bg-rose-100 text-rose-800 border-rose-300",
          icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
        };
      case "PENDING":
      default:
        return {
          label: "รอตรวจ",
          className: "bg-amber-100 text-amber-800 border-amber-300",
          icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
        };
    }
  };

  // จัดการการส่งฟอร์ม (นักศึกษา)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.projectTitle.trim()) {
      alert("กรุณากรอกชื่อโครงการ");
      return;
    }
    if (!formData.groupName.trim()) {
      alert("กรุณากรอกชื่อกลุ่ม");
      return;
    }
    if (!formData.studentName.trim()) {
      alert("กรุณากรอกชื่อผู้จัดทำ");
      return;
    }
    if (!formData.studentId.trim()) {
      alert("กรุณากรอกรหัสนักศึกษา");
      return;
    }
    if (!formData.lineId.trim()) {
      alert("กรุณากรอก ID Line สำหรับรับแจ้งเตือน");
      return;
    }
    if (!selectedFile) {
      alert("กรุณาเลือกไฟล์ PDF ของโครงการก่อนกดบันทึก");
      return;
    }

    setIsSubmitting(true);
    try {
      const body = new FormData();
      body.append("projectTitle", formData.projectTitle);
      body.append("groupName", formData.groupName);
      body.append("department", formData.department);
      body.append("studentName", formData.studentName);
      body.append("studentId", formData.studentId);
      body.append("lineId", formData.lineId);
      if (formData.lineDisplayName || liffProfile?.displayName) {
        body.append("lineDisplayName", formData.lineDisplayName || liffProfile?.displayName || "");
      }
      if (formData.linePictureUrl || liffProfile?.pictureUrl) {
        body.append("linePictureUrl", formData.linePictureUrl || liffProfile?.pictureUrl || "");
      }
      body.append("pdfFile", selectedFile);

      const res = await fetch("/api/submissions", {
        method: "POST",
        body,
      });
      const data = await res.json();

      if (data.success) {
        setToastMessage(`✅ บันทึกโครงงานและส่งแจ้งเตือนเข้า LINE อาจารย์เรียบร้อยแล้ว!`);
        setTimeout(() => setToastMessage(null), 6000);

        // บันทึกรหัสนักศึกษาไว้ให้ในช่องค้นหาติดตามผลทันที
        setStudentSearchKeyword(formData.studentId);

        // รีเซ็ตฟอร์ม (คงค่า LINE ของผู้ใช้ไว้หากล็อกอิน LIFF อยู่)
        setFormData({
          projectTitle: "",
          groupName: "",
          department: "วิทยาการคอมพิวเตอร์",
          studentName: liffProfile ? (liffProfile.isMock ? "นายธนกฤต วิเศษ" : liffProfile.displayName) : "",
          studentId: "",
          lineId: liffProfile ? liffProfile.userId : "",
          lineDisplayName: liffProfile ? liffProfile.displayName : "",
          linePictureUrl: liffProfile ? liffProfile.pictureUrl || "" : "",
        });
        setSelectedFile(null);

        // รีเฟรชรายการ
        await fetchSubmissions();
      } else {
        alert(data.message || "เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // เปลี่ยนสถานะโครงงานโดยตรง
  const handleUpdateStatus = async (id: string, newStatus: ProjectStatus) => {
    try {
      const res = await fetch(`/api/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`🔄 อัปเดตสถานะเป็น "${getStatusBadge(newStatus).label}" เรียบร้อยแล้ว`);
        setTimeout(() => setToastMessage(null), 4000);
        await fetchSubmissions();
      } else {
        alert(data.message || "อัปเดตสถานะไม่สำเร็จ");
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  // อาจารย์ส่งโน้ตกลับหานักศึกษา พร้อมเปลี่ยนสถานะ
  const handleSendNote = async () => {
    if (!activeModalItem) return;
    if (!noteInput.trim()) {
      alert("กรุณาพิมพ์ข้อความโน้ตก่อนกดส่ง");
      return;
    }

    setIsSendingNote(true);
    try {
      const res = await fetch(`/api/submissions/${activeModalItem.id}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteText: noteInput,
          status: noteStatus,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setToastMessage(`📱 ส่งโน้ตและอัปเดตสถานะโครงงานไปยัง LINE "${activeModalItem.lineId}" เรียบร้อยแล้ว!`);
        setTimeout(() => setToastMessage(null), 6000);
        setNoteInput("");
        setActiveModalItem(null);
        await fetchSubmissions();
      } else {
        alert(data.message || "ส่งโน้ตไม่สำเร็จ");
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setIsSendingNote(false);
    }
  };

  // ลบรายการโครงงาน
  const handleDeleteSubmission = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/submissions/${itemToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`🗑️ ลบโครงงาน "${itemToDelete.projectTitle}" เรียบร้อยแล้ว`);
        setTimeout(() => setToastMessage(null), 4000);
        setItemToDelete(null);
        await fetchSubmissions();
      } else {
        alert(data.message || "ลบโครงงานไม่สำเร็จ");
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // ส่งออกข้อมูลตารางเป็น Excel (CSV ที่รองรับภาษาไทย UTF-8 BOM)
  const handleExportCSV = () => {
    if (submissions.length === 0) {
      alert("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }

    const headers = [
      "รหัสการส่ง",
      "ชื่อโครงงาน",
      "ชื่อกลุ่ม",
      "สาขาวิชา",
      "ผู้จัดทำ",
      "รหัสนักศึกษา",
      "ID Line",
      "สถานะปัจจุบัน",
      "จำนวนโน้ตข้อเสนอแนะ",
      "วันที่ส่ง",
      "ชื่อไฟล์ PDF",
    ];

    const rows = submissions.map((item) => [
      item.id,
      `"${item.projectTitle.replace(/"/g, '""')}"`,
      `"${item.groupName.replace(/"/g, '""')}"`,
      `"${item.department.replace(/"/g, '""')}"`,
      `"${item.studentName.replace(/"/g, '""')}"`,
      `"${item.studentId}"`,
      `"${item.lineId}"`,
      `"${getStatusBadge(item.status).label}"`,
      item.notes ? item.notes.length : 0,
      new Date(item.submittedAt).toLocaleString("th-TH"),
      `"${item.pdfFileName}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TU_Project_Submissions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToastMessage("📥 ดาวน์โหลดไฟล์รายงาน CSV/Excel เรียบร้อยแล้ว");
    setTimeout(() => setToastMessage(null), 4000);
  };

  // บันทึกและทดสอบเชื่อมต่อ LINE จริง
  const handleSaveAndTestLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineSettings.token.trim() || !lineSettings.advisorId.trim()) {
      alert("กรุณากรอกทั้ง Token และ User ID ของอาจารย์ครับ");
      return;
    }

    setIsSavingLine(true);
    try {
      const res = await fetch("/api/settings/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelAccessToken: lineSettings.token,
          advisorLineId: lineSettings.advisorId,
          liffId: lineSettings.liffId,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setToastMessage(data.message);
        setTimeout(() => setToastMessage(null), 7000);
        await fetchLineStatus();
        if (lineSettings.liffId) {
          initLiff(lineSettings.liffId);
        }
      } else {
        alert(data.message || "เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบข้อมูล");
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setIsSavingLine(false);
    }
  };

  // บันทึกเฉพาะ LIFF ID
  const handleSaveLiffOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineSettings.liffId.trim()) {
      alert("กรุณากรอก LIFF ID");
      return;
    }

    setIsSavingLine(true);
    try {
      const res = await fetch("/api/settings/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liffId: lineSettings.liffId.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(data.message);
        setTimeout(() => setToastMessage(null), 6000);
        await fetchLineStatus();
        initLiff(lineSettings.liffId.trim());
      } else {
        alert(data.message || "บันทึก LIFF ID ไม่สำเร็จ");
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setIsSavingLine(false);
    }
  };

  // ค้นหาของนักศึกษาเพื่อติดตามสถานะ
  const studentTrackedItems = useMemo(() => {
    if (!studentSearchKeyword.trim()) return [];
    const kw = studentSearchKeyword.trim().toLowerCase();
    return submissions.filter(
      (s) =>
        s.studentId.includes(kw) ||
        s.groupName.toLowerCase().includes(kw) ||
        s.lineId.toLowerCase().includes(kw)
    );
  }, [submissions, studentSearchKeyword]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-500 animate-in fade-in slide-in-from-top-4">
          <Smartphone className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Main Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-extrabold shadow-md shadow-emerald-500/20 text-base">
              TU
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-none">
                  ระบบติดตามโครงงานและส่งงานผ่าน LINE
                </h1>
                {lineStatus.isConfigured ? (
                  <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    เชื่อมต่อ LINE แล้ว ({lineStatus.advisorIdMasked})
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    โหมดจำลอง (Simulator)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                มหาวิทยาลัยธรรมศาสตร์ • จัดเก็บไฟล์ใน uploads • จัดเก็บข้อมูล mock json • ส่งผ่าน LINE
              </p>
            </div>
          </div>

          {/* User Role Status / Controls */}
          {currentUser === "admin" && isAdminAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-blue-100 text-blue-800 px-3 py-1.5 rounded-xl border border-blue-200 flex items-center gap-1.5 shadow-xs">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                อาจารย์ที่ปรึกษา (Admin)
              </span>
              <button
                onClick={handleAdminLogout}
                title="ออกจากระบบอาจารย์"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 shadow-xs">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                โหมดนักศึกษา
              </span>
              <button
                onClick={() => setShowAdminLoginModal(true)}
                className="text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-xl border border-slate-200 transition flex items-center gap-1"
                title="สำหรับอาจารย์ที่ปรึกษาเข้าสู่ระบบ"
              >
                <Lock className="w-3 h-3 text-slate-500" />
                <span className="hidden sm:inline">สำหรับ</span>อาจารย์
              </button>
            </div>
          )}
        </div>

        {/* Sub-menu Tabs (แสดงเฉพาะอาจารย์ที่ผ่านการยืนยันสิทธิ์แล้วเท่านั้น! สำหรับนักศึกษาจะไม่แสดงแถบนี้) */}
        {currentUser === "admin" && isAdminAuthenticated && (
          <div className="bg-slate-50 border-t border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap gap-2 py-2">
              <button
                onClick={() => setActiveTab("REPORT")}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                  activeTab === "REPORT"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                หน้ารายงานสำหรับอาจารย์ ({submissions.length})
              </button>
              <button
                onClick={() => setActiveTab("FORM")}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                  activeTab === "FORM"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                ดูแบบฟอร์มส่งงาน (มุมมองนักศึกษา)
              </button>
              <button
                onClick={() => setActiveTab("LINE_PREVIEW")}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                  activeTab === "LINE_PREVIEW"
                    ? "bg-[#06C755] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                ตัวอย่างการแจ้งเตือนใน LINE
              </button>
              <button
                onClick={() => setActiveTab("SETTINGS")}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                  activeTab === "SETTINGS"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                ⚙️ คู่มือและวิธีใช้งานจริง (LINE API)
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

        {/* ============================================================== */}
        {/* 1. หน้า LOGIN (Mockup User: Admin & General)                   */}
        {/* ============================================================== */}
        {currentUser === null && (
          <div className="max-w-3xl mx-auto py-10 space-y-8 text-center">
            <div className="space-y-3">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
                1. หน้าเข้าสู่ระบบ (Mockup Login)
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                เข้าสู่ระบบเพื่อใช้งานระบบติดตามโครงงาน
              </h2>
              <p className="text-sm text-slate-500 max-w-lg mx-auto">
                เลือกว่าคุณต้องการเข้าใช้งานในบทบาทใด เพื่อทดสอบการทำงานของระบบ
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left pt-4">
              {/* General User Card */}
              <div
                onClick={() => handleSelectRole("general")}
                className="bg-white p-7 rounded-3xl border-2 border-slate-200 hover:border-emerald-500 hover:shadow-xl transition-all cursor-pointer group space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition">
                    General (นักศึกษา / ผู้จัดทำ)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    สำหรับนักศึกษากรอกแบบฟอร์มส่งโครงการ แนบไฟล์ PDF และส่งการแจ้งเตือนตรงไปยัง LINE ของอาจารย์ที่ปรึกษา
                  </p>
                </div>
                <div className="pt-2 flex items-center text-xs font-bold text-emerald-600 gap-1 group-hover:gap-2 transition-all">
                  เข้าสู่หน้ากรอกแบบฟอร์ม <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              {/* Admin User Card */}
              <div
                onClick={() => handleSelectRole("admin")}
                className="bg-white p-7 rounded-3xl border-2 border-slate-200 hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer group space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition">
                    Admin (อาจารย์ที่ปรึกษา)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    สำหรับอาจารย์เปิดดูรายงานโครงการทั้งหมด ตรวจสอบสถานะ เปิดอ่านไฟล์ PDF แต่ละกลุ่ม และพิมพ์โน้ตส่งกลับไปยัง LINE นักศึกษา
                  </p>
                </div>
                <div className="pt-2 flex items-center text-xs font-bold text-blue-600 gap-1 group-hover:gap-2 transition-all">
                  เข้าสู่หน้ารายงานสำหรับอาจารย์ <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. หน้ากรอกแบบฟอร์ม (Form Submission)                          */}
        {/* ============================================================== */}
        {currentUser !== null && activeTab === "FORM" && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">
                  2. แบบฟอร์มส่งโครงงาน (สำหรับนักศึกษา)
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 mt-2">
                  กรอกรายละเอียดโครงการและแนบไฟล์ PDF
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  เมื่อกดบันทึก ข้อมูลจะถูกจัดเก็บลง <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">data/submissions.json</code> ไฟล์จะถูกเซฟใน <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">uploads/</code> และส่งแจ้งเตือนเข้า LINE อาจารย์ทันที
                </p>
              </div>

              {/* LINE LIFF Profile & Quick Connect Card */}
              {liffProfile ? (
                <div className="bg-emerald-50/80 border border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    {liffProfile.pictureUrl ? (
                      <img
                        src={liffProfile.pictureUrl}
                        alt={liffProfile.displayName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-[#06C755] shadow-xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#06C755] text-white flex items-center justify-center font-bold text-base shadow-xs">
                        {liffProfile.displayName?.charAt(0) || "L"}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">
                          {liffProfile.displayName}
                        </h4>
                        <span className="inline-flex items-center gap-1 bg-[#06C755] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                          <CheckCircle2 className="w-3 h-3" /> LIFF เชื่อมต่อสำเร็จ
                        </span>
                        {liffProfile.isMock && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            โหมดทดสอบ
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-emerald-800 font-mono mt-0.5">
                        LINE User ID: <span className="font-bold">{liffProfile.userId}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        ✓ ระบบจะส่งการแจ้งเตือนและโน้ตความคิดเห็นจากอาจารย์เข้าแอป LINE บัญชีนี้โดยตรง
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={handleLiffLogout}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold transition shadow-xs"
                    >
                      สลับบัญชี LINE
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#06C755] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        📱 แนะนำ: เชื่อมต่อด้วย LINE (LIFF) เพื่อรับแจ้งเตือนอัตโนมัติ
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        เมื่อเปิดผ่าน LINE หรือเข้าสู่ระบบด้วย LINE ระบบจะดึงชื่อและ <strong>LINE User ID</strong> มากรอกในฟอร์มให้อัตโนมัติ 100% อาจารย์จะสามารถส่งโน้ตแจ้งเตือนเข้ามือถือของคุณได้จริง
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleLiffLogin}
                      className="px-3.5 py-2 bg-[#06C755] hover:bg-[#05a948] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      เข้าสู่ระบบด้วย LINE
                    </button>
                    <button
                      type="button"
                      onClick={handleMockLiff}
                      title="กดเพื่อจำลองข้อมูล LINE สำหรับทดสอบบน localhost ทันที"
                      className="px-3 py-2 bg-white hover:bg-slate-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      จำลอง LIFF (Demo)
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
                {/* 1. ชื่อโครงการ */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">
                    1. ชื่อโครงการ (Project Title) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.projectTitle}
                    onChange={(e) => setFormData({ ...formData, projectTitle: e.target.value })}
                    placeholder="เช่น ระบบตรวจจับความสุกของทุเรียนด้วยภาพถ่ายและการเรียนรู้เชิงลึก"
                    className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                  />
                </div>

                {/* 2. ชื่อกลุ่ม และ 3. สาขาวิชา */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">
                      2. ชื่อกลุ่ม <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.groupName}
                      onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                      placeholder="เช่น กลุ่ม DurianAI (กลุ่มที่ 4)"
                      className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">
                      3. สาขาวิชา <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="เช่น วิทยาการคอมพิวเตอร์ / IT"
                      className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                    />
                  </div>
                </div>

                {/* 4. ชื่อผู้จัดทำ และ 5. รหัสนักศึกษา */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">
                      4. ชื่อผู้จัดทำ (หัวหน้ากลุ่ม/ตัวแทน) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.studentName}
                      onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                      placeholder="เช่น นายธนกฤต วิเศษ"
                      className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">
                      5. รหัสนักศึกษา <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.studentId}
                      onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                      placeholder="เช่น 6509611234"
                      className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                    />
                  </div>
                </div>

                {/* 6. ID Line สำหรับรับแจ้งเตือน */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 block">
                      6. LINE User ID สำหรับรับการแจ้งเตือนผลตรวจ <span className="text-rose-500">*</span>
                    </label>
                    {liffProfile && (
                      <span className="text-[11px] text-[#06C755] font-bold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> ดึงรหัสจาก LINE LIFF อัตโนมัติ
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formData.lineId}
                      onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}
                      placeholder="เช่น U41bd7b5a88f4dff8fd2ea69d9b34a873 หรือรหัสบัญชี LINE"
                      className={`w-full p-3 rounded-xl border focus:outline-none focus:ring-2 font-mono text-xs ${
                        formData.lineId.startsWith("U") && formData.lineId.length > 20
                          ? "border-emerald-300 bg-emerald-50/40 text-emerald-900 focus:ring-emerald-500"
                          : "border-slate-300 bg-white text-slate-900 focus:ring-emerald-500"
                      }`}
                    />
                    {formData.lineId.startsWith("U") && formData.lineId.length > 20 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> รหัสส่ง LINE ได้จริง
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {formData.lineId.startsWith("U") && formData.lineId.length > 20
                      ? "✓ รูปแบบรหัสถูกต้อง (ขึ้นต้นด้วย U 33 หลัก) ระบบจะส่ง Push Message ข้อความโน้ตตรงเข้าแอป LINE มือถือนักศึกษาได้ทันที"
                      : "💡 ข้อความจะแจ้งเตือนเข้าแอป LINE บนมือถือได้จริงเมื่อรหัสเป็น User ID (ขึ้นต้นด้วย U) หรือกด 'เข้าสู่ระบบด้วย LINE' ด้านบน"}
                  </p>
                </div>

                {/* 7. อัปโหลดไฟล์ PDF */}
                <div className="space-y-1.5 pt-2">
                  <label className="font-bold text-slate-700 block">
                    7. อัปโหลดไฟล์ PDF โครงงาน <span className="text-rose-500">*</span>
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-emerald-500 transition bg-slate-50/50 relative">
                    <input
                      type="file"
                      accept=".pdf"
                      required
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    {selectedFile ? (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-emerald-700">
                          ไฟล์ที่เลือก: {selectedFile.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          ขนาด: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • คลิกเพื่อเปลี่ยนไฟล์
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-700">
                          คลิกหรือลากไฟล์ PDF มาวางที่นี่
                        </p>
                        <p className="text-[11px] text-slate-400">
                          เฉพาะไฟล์นามสกุล .pdf (บันทึกจัดเก็บใน root project)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        กำลังบันทึกและส่งแจ้งเตือนเข้า LINE...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        บันทึกข้อมูลและส่งแจ้งเตือนไปยัง LINE อาจารย์
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* ส่วนเช็กสถานะโครงงานสำหรับนักศึกษา */}
            <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-800">
                <Search className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold">
                  🔍 ตรวจสอบสถานะโครงงานของฉัน (สำหรับนักศึกษา)
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                พิมพ์รหัสนักศึกษา หรือชื่อกลุ่ม เพื่อตรวจดูสถานะการอนุมัติและอ่านโน้ตคำแนะนำจากอาจารย์ได้ทันที:
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={studentSearchKeyword}
                  onChange={(e) => setStudentSearchKeyword(e.target.value)}
                  placeholder="พิมพ์รหัสนักศึกษา เช่น 6509611234 หรือชื่อกลุ่ม..."
                  className="flex-1 p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {studentSearchKeyword && (
                  <button
                    onClick={() => setStudentSearchKeyword("")}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs text-slate-600 font-semibold"
                  >
                    ล้าง
                  </button>
                )}
              </div>

              {studentSearchKeyword.trim() && (
                <div className="space-y-3 pt-2">
                  {studentTrackedItems.length === 0 ? (
                    <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
                      ไม่พบโครงงานที่ตรงกับคำค้นหานี้ กรุณาตรวจสอบรหัสนักศึกษาหรือชื่อกลุ่มอีกครั้งครับ
                    </p>
                  ) : (
                    studentTrackedItems.map((item) => {
                      const badge = getStatusBadge(item.status);
                      return (
                        <div
                          key={item.id}
                          className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm">{item.projectTitle}</h4>
                              <p className="text-slate-500 text-[11px] mt-0.5">
                                กลุ่ม: {item.groupName} • ผู้ส่ง: {item.studentName} ({item.studentId})
                              </p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border ${badge.className}`}
                            >
                              {badge.icon}
                              {badge.label}
                            </span>
                          </div>

                          {/* โน้ตจากอาจารย์ */}
                          {item.notes && item.notes.length > 0 ? (
                            <div className="bg-white p-3 rounded-xl border border-blue-200 space-y-1.5">
                              <span className="font-bold text-blue-700 block text-[11px]">
                                💬 คำแนะนำล่าสุดจากอาจารย์:
                              </span>
                              <p className="text-slate-800 italic">&ldquo;{item.notes[0].content}&rdquo;</p>
                              <span className="text-[10px] text-slate-400 block">
                                ส่งเมื่อ: {new Date(item.notes[0].sentAt).toLocaleString("th-TH")}
                              </span>
                            </div>
                          ) : (
                            <p className="text-slate-400 text-[11px]">
                              ยังไม่มีโน้ตตอบกลับจากอาจารย์ (กำลังรอตรวจ)
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. หน้ารายงาน (Dashboard สำหรับอาจารย์พร้อมฟีเจอร์ยกระดับ)     */}
        {/* ============================================================== */}
        {/* กรณีพยายามเข้าหน้ารายงาน แต่อาจารย์ยังไม่ได้ยืนยันสิทธิ์ */}
        {activeTab === "REPORT" && !isAdminAuthenticated && (
          <div className="max-w-md mx-auto py-12 px-4">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900">
                  เข้าสู่ระบบสำหรับอาจารย์ที่ปรึกษา
                </h2>
                <p className="text-xs text-slate-500">
                  กรุณากรอกรหัสผ่านเพื่อเข้าดูรายงานและตรวจโครงงาน (รหัสผ่านเริ่มต้น: 1234)
                </p>
              </div>

              <form onSubmit={handleAdminPinSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    รหัสผ่านอาจารย์ (Admin PIN)
                  </label>
                  <input
                    type="password"
                    placeholder="กรอกรหัสผ่าน (เช่น 1234)"
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  {adminPinError && (
                    <p className="text-xs text-rose-500 font-semibold mt-1">
                      {adminPinError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition shadow-md shadow-blue-500/20"
                >
                  เข้าสู่ระบบอาจารย์
                </button>
              </form>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setCurrentUser("general");
                    setActiveTab("FORM");
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  ← กลับสู่หน้าส่งโครงงานสำหรับนักศึกษา
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "REPORT" && isAdminAuthenticated && (
          <div className="space-y-6">
            {/* Header & Export Button */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full uppercase">
                  3. หน้ารายงานโครงการทั้งหมด (Advisor Dashboard)
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                  ติดตามความคืบหน้าโครงงาน ({submissions.length} รายการ)
                </h2>
                <p className="text-xs text-slate-500">
                  ระบบเชื่อมต่อข้อมูลจาก <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">data/submissions.json</code> และ <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">uploads/</code> รองรับค้นหา กรอง เปลี่ยนสถานะ และส่งออก Excel
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  title="ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ Excel CSV"
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  ส่งออก Excel (CSV)
                </button>
                <button
                  onClick={fetchSubmissions}
                  disabled={isLoading}
                  className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  รีเฟรช
                </button>
              </div>
            </div>

            {/* KPI Statistics Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. ทั้งหมด */}
              <div
                onClick={() => setStatusFilter("ALL")}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-slate-900 text-white border-slate-900 shadow-md"
                    : "bg-white text-slate-800 border-slate-200 hover:border-slate-400 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold opacity-80">ทั้งหมด</span>
                  <Layers className="w-4 h-4 opacity-70" />
                </div>
                <div className="text-2xl font-black mt-2">{stats.total}</div>
                <div className="text-[11px] opacity-70 mt-0.5">โครงงานที่ส่งเข้ามา</div>
              </div>

              {/* 2. รอตรวจ */}
              <div
                onClick={() => setStatusFilter("PENDING")}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  statusFilter === "PENDING"
                    ? "bg-amber-500 text-white border-amber-600 shadow-md"
                    : "bg-white text-slate-800 border-amber-200 hover:border-amber-400 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700">รอตรวจ</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-amber-600 mt-2">{stats.pending}</div>
                <div className="text-[11px] text-amber-700/80 mt-0.5">ยังไม่ได้ให้ข้อเสนอแนะ</div>
              </div>

              {/* 3. มีข้อเสนอแนะ / ส่งกลับแก้ไข */}
              <div
                onClick={() => setStatusFilter("NEEDS_REVISION")}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  statusFilter === "NEEDS_REVISION"
                    ? "bg-blue-600 text-white border-blue-700 shadow-md"
                    : "bg-white text-slate-800 border-blue-200 hover:border-blue-400 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-700">มีข้อเสนอแนะ</span>
                  <AlertCircle className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-blue-600 mt-2">{stats.needsRevision}</div>
                <div className="text-[11px] text-blue-700/80 mt-0.5">ส่งคำแนะนำให้ นศ. แก้ไข</div>
              </div>

              {/* 4. ผ่านการอนุมัติ */}
              <div
                onClick={() => setStatusFilter("APPROVED")}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  statusFilter === "APPROVED"
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-md"
                    : "bg-white text-slate-800 border-emerald-200 hover:border-emerald-400 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700">ผ่านการอนุมัติ</span>
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-emerald-600 mt-2">{stats.approved}</div>
                <div className="text-[11px] text-emerald-700/80 mt-0.5">โครงงานผ่านการเห็นชอบ</div>
              </div>
            </div>

            {/* Toolbar: Search & Advanced Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between text-xs">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อโครงงาน, กลุ่ม, ผู้จัดทำ, รหัส นศ., ID LINE..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-slate-900"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium focus:outline-none"
                >
                  <option value="ALL">สถานะทั้งหมด</option>
                  <option value="PENDING">รอตรวจ</option>
                  <option value="NEEDS_REVISION">มีข้อเสนอแนะ/รอปรับปรุง</option>
                  <option value="APPROVED">ผ่านการอนุมัติ</option>
                  <option value="REJECTED">ไม่อนุมัติ</option>
                </select>
              </div>

              {/* Department Filter */}
              {departmentsList.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium focus:outline-none"
                  >
                    <option value="ALL">ทุกสาขาวิชา</option>
                    {departmentsList.map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sort By */}
              <div className="flex items-center gap-1.5">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium focus:outline-none"
                >
                  <option value="NEWEST">เรียงลำดับ: ล่าสุด</option>
                  <option value="OLDEST">เรียงลำดับ: เก่าสุด</option>
                  <option value="TITLE">เรียงตาม: ชื่อโครงงาน (ก-ฮ)</option>
                </select>
              </div>
            </div>

            {/* Submissions List / Table */}
            {filteredSubmissions.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
                <FolderOpen className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-700">ไม่พบโครงงานที่ตรงกับเงื่อนไข</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  ลองล้างคำค้นหา หรือเปลี่ยนตัวกรองสถานะดูอีกครั้งครับ
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setDepartmentFilter("ALL");
                  }}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">ชื่อโครงการ & กลุ่ม</th>
                        <th className="py-3.5 px-4">สาขาวิชา</th>
                        <th className="py-3.5 px-4">ผู้จัดทำ (รหัส นศ.)</th>
                        <th className="py-3.5 px-4">ID Line</th>
                        <th className="py-3.5 px-4">ไฟล์เอกสาร PDF</th>
                        <th className="py-3.5 px-4 text-center">สถานะโครงงาน</th>
                        <th className="py-3.5 px-4 text-center">โน้ตประวัติ</th>
                        <th className="py-3.5 px-4 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredSubmissions.map((item) => {
                        const noteCount = item.notes ? item.notes.length : 0;
                        const badge = getStatusBadge(item.status);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition">
                            {/* ชื่อโครงการ & กลุ่ม */}
                            <td className="py-4 px-4 max-w-xs">
                              <span className="font-bold text-slate-900 block text-sm line-clamp-1">
                                {item.projectTitle}
                              </span>
                              <span className="text-xs text-emerald-700 font-semibold mt-0.5 inline-block">
                                {item.groupName}
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                รหัส: {item.id} • {new Date(item.submittedAt).toLocaleDateString("th-TH")}
                              </span>
                            </td>

                            {/* สาขา */}
                            <td className="py-4 px-4 font-medium text-slate-600">
                              {item.department}
                            </td>

                            {/* ผู้จัดทำ */}
                            <td className="py-4 px-4">
                              <div className="font-semibold text-slate-800">{item.studentName}</div>
                              <div className="text-[11px] text-slate-400">{item.studentId}</div>
                            </td>

                            {/* ID Line */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                {item.linePictureUrl ? (
                                  <img
                                    src={item.linePictureUrl}
                                    alt="LINE"
                                    className="w-7 h-7 rounded-full object-cover border border-emerald-300 shrink-0"
                                  />
                                ) : (
                                  <span className="w-7 h-7 rounded-full bg-[#06C755]/10 text-[#06C755] flex items-center justify-center font-bold text-xs shrink-0">
                                    <Smartphone className="w-3.5 h-3.5" />
                                  </span>
                                )}
                                <div className="min-w-0">
                                  {item.lineDisplayName && (
                                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                                      <span className="truncate max-w-[120px]">{item.lineDisplayName}</span>
                                      {item.lineId.startsWith("U") && item.lineId.length > 20 && (
                                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0">
                                          LIFF
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <span
                                    title={item.lineId}
                                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded inline-block max-w-[130px] truncate ${
                                      item.lineId.startsWith("U") && item.lineId.length > 20
                                        ? "bg-emerald-50 text-emerald-800 font-semibold"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {item.lineId}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* ไฟล์ PDF */}
                            <td className="py-4 px-4">
                              <a
                                href={item.pdfFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs transition"
                              >
                                <FileText className="w-3.5 h-3.5 text-rose-500" />
                                เปิดดู PDF
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </a>
                            </td>

                            {/* ตัวเลือกเปลี่ยนสถานะแบบทันใจ */}
                            <td className="py-4 px-4 text-center">
                              <select
                                value={item.status || "PENDING"}
                                onChange={(e) => handleUpdateStatus(item.id, e.target.value as ProjectStatus)}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none ${badge.className}`}
                              >
                                <option value="PENDING">🟡 รอตรวจ</option>
                                <option value="NEEDS_REVISION">🔵 มีข้อเสนอแนะ</option>
                                <option value="APPROVED">🟢 ผ่านการอนุมัติ</option>
                                <option value="REJECTED">🔴 ไม่อนุมัติ</option>
                              </select>
                            </td>

                            {/* โน้ตประวัติ */}
                            <td className="py-4 px-4 text-center">
                              {noteCount > 0 ? (
                                <button
                                  onClick={() => {
                                    setActiveModalItem(item);
                                    setNoteStatus(item.status || "NEEDS_REVISION");
                                    setNoteInput("");
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 hover:bg-blue-200 transition"
                                >
                                  <Check className="w-3 h-3" /> มี {noteCount} โน้ต
                                </button>
                              ) : (
                                <span className="text-slate-400 text-xs">ยังไม่มีโน้ต</span>
                              )}
                            </td>

                            {/* ปุ่มการจัดการ */}
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setActiveModalItem(item);
                                    setNoteStatus(item.status || "NEEDS_REVISION");
                                    setNoteInput("");
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1 transition"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  โน้ต & ส่ง LINE
                                </button>
                                <button
                                  onClick={() => setItemToDelete(item)}
                                  title="ลบโครงงานนี้"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal: สำหรับพิมพ์โน้ตและกดส่งกลับเข้า LINE นักศึกษา พร้อมปรับสถานะ */}
            {activeModalItem && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase">
                        ส่งโน้ตตอบกลับ & ปรับสถานะผ่าน LINE
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-2">
                        {activeModalItem.projectTitle}
                      </h3>
                      <p className="text-xs text-slate-500">
                        กลุ่ม: {activeModalItem.groupName} • ผู้รับ: {activeModalItem.studentName}
                        {activeModalItem.lineDisplayName && ` (${activeModalItem.lineDisplayName})`}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded">
                          ID: {activeModalItem.lineId}
                        </span>
                        {activeModalItem.lineId.startsWith("U") && activeModalItem.lineId.length > 20 ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-[#06C755]" /> ส่งเข้า LINE มือถือนักศึกษาได้จริง
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            ⚠️ โหมดจำลอง (รหัสไม่ใช่ LINE User ID)
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveModalItem(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {/* กล่องประวัติโน้ตเดิม (ถ้ามี) */}
                  {activeModalItem.notes && activeModalItem.notes.length > 0 && (
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 max-h-36 overflow-y-auto">
                      <span className="text-[11px] font-bold text-slate-600 block">ประวัติโน้ตที่เคยส่งแล้ว:</span>
                      {activeModalItem.notes.map((n) => (
                        <div key={n.id} className="text-xs bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                          <p className="text-slate-800">{n.content}</p>
                          <span className="text-[10px] text-slate-400 block">
                            ส่งเมื่อ: {new Date(n.sentAt).toLocaleString("th-TH")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* เลือกสถานะโครงงานหลังตรวจ */}
                  <div className="space-y-1.5 text-xs">
                    <label className="font-bold text-slate-700 block">
                      ปรับสถานะโครงงานหลังตรวจ:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNoteStatus("NEEDS_REVISION")}
                        className={`p-2.5 rounded-xl border text-left font-bold flex items-center gap-2 transition ${
                          noteStatus === "NEEDS_REVISION"
                            ? "bg-blue-50 border-blue-500 text-blue-700"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        <AlertCircle className="w-4 h-4 text-blue-500" />
                        มีข้อเสนอแนะ / ส่งกลับแก้
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteStatus("APPROVED")}
                        className={`p-2.5 rounded-xl border text-left font-bold flex items-center gap-2 transition ${
                          noteStatus === "APPROVED"
                            ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ผ่านการอนุมัติ
                      </button>
                    </div>
                  </div>

                  {/* กล่องพิมพ์โน้ตใหม่ */}
                  <div className="space-y-2 text-xs">
                    <label className="font-bold text-slate-700 block">
                      พิมพ์ข้อความโน้ต / คำแนะนำของอาจารย์:
                    </label>
                    <textarea
                      rows={3}
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="เช่น เพิ่มการอ้างอิงเอกสารในบทที่ 2 และส่งฉบับปรับปรุงเข้ามาอีกครั้งครับ..."
                      className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                    />
                  </div>

                  {/* ปุ่มส่ง */}
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveModalItem(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={isSendingNote}
                      onClick={handleSendNote}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {isSendingNote ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> กำลังส่งเข้า LINE...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" /> บันทึก & ส่งกลับไปยัง LINE ({activeModalItem.lineId})
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal ยืนยันการลบ */}
            {itemToDelete && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="text-center space-y-1">
                    <h4 className="text-base font-bold text-slate-900">ยืนยันการลบโครงงาน?</h4>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      คุณต้องการลบโครงงาน &ldquo;{itemToDelete.projectTitle}&rdquo; ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setItemToDelete(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleDeleteSubmission}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      ยืนยันลบ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. LINE NOTIFICATION SIMULATOR PREVIEW                         */}
        {/* ============================================================== */}
        {currentUser === "admin" && isAdminAuthenticated && activeTab === "LINE_PREVIEW" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center max-w-lg mx-auto">
              <span className="text-xs font-bold text-[#06C755] bg-emerald-50 px-3 py-1 rounded-full uppercase">
                ตัวอย่างการแจ้งเตือนจริงใน LINE
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 mt-2">
                รูปแบบข้อความการ์ดที่ส่งผ่าน LINE Messaging API
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                ระบบจะส่งข้อความแจ้งเตือนอัตโนมัติ 2 ทิศทาง: เข้า LINE อาจารย์เมื่อมีการส่งงาน และส่งกลับเข้า LINE นักศึกษาเมื่ออาจารย์โน้ตตรวจงาน
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pt-2">
              {/* Card 1: Alert to Advisor */}
              <div className="bg-[#78909C] p-5 rounded-3xl shadow-lg space-y-3">
                <div className="flex items-center gap-2 text-white text-xs font-bold px-1">
                  <Smartphone className="w-4 h-4 text-emerald-300" />
                  ข้อความเด้งเข้า LINE อาจารย์ (เมื่อ นศ. กดบันทึก)
                </div>

                <div className="bg-white rounded-2xl overflow-hidden shadow-md text-slate-800 text-xs">
                  <div className="bg-[#06C755] p-3.5 text-white">
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase">
                      New Submission
                    </span>
                    <h4 className="text-sm font-bold mt-1">📬 แจ้งเตือน: มีการส่งโครงการใหม่</h4>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="font-bold text-slate-900 text-xs">
                      {submissions[0]?.projectTitle || "ระบบวิเคราะห์ความสุกของผลไม้ด้วยคอมพิวเตอร์วิทัศน์"}
                    </p>
                    <div className="text-slate-600 space-y-1 pt-1 border-t border-slate-100 text-[11px]">
                      <p>• <span className="font-semibold">กลุ่ม:</span> {submissions[0]?.groupName || "กลุ่ม DurianVision"}</p>
                      <p>• <span className="font-semibold">สาขา:</span> {submissions[0]?.department || "วิทยาการคอมพิวเตอร์"}</p>
                      <p>• <span className="font-semibold">ผู้จัดทำ:</span> {submissions[0]?.studentName || "นายธนกฤต วิเศษ"} ({submissions[0]?.studentId || "6509611234"})</p>
                      <p>• <span className="font-semibold text-emerald-700">ID Line:</span> {submissions[0]?.lineId || "thana_dev"}</p>
                      <p>• <span className="font-semibold">ไฟล์แนบ:</span> {submissions[0]?.pdfFileName || "Proposal_Durian.pdf"}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 border-t border-slate-100">
                    <button
                      onClick={() => setActiveTab("REPORT")}
                      className="w-full py-2 bg-[#06C755] text-white rounded-xl font-bold text-xs hover:bg-[#05a948] transition"
                    >
                      🔍 เปิดหน้ารายงานเพื่อตรวจงาน
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Note to Student */}
              <div className="bg-[#78909C] p-5 rounded-3xl shadow-lg space-y-3">
                <div className="flex items-center gap-2 text-white text-xs font-bold px-1">
                  <Smartphone className="w-4 h-4 text-blue-300" />
                  ข้อความเด้งกลับเข้า LINE นศ. (เมื่ออาจารย์กดส่งโน้ต)
                </div>

                <div className="bg-white rounded-2xl overflow-hidden shadow-md text-slate-800 text-xs">
                  <div className="bg-[#2563EB] p-3.5 text-white">
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase">
                      Advisor Note
                    </span>
                    <h4 className="text-sm font-bold mt-1">📝 ข้อความตอบกลับจากอาจารย์ที่ปรึกษา</h4>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="font-bold text-slate-900 text-xs">
                      {submissions[0]?.projectTitle || "ระบบวิเคราะห์ความสุกของผลไม้ด้วยคอมพิวเตอร์วิทัศน์"}
                    </p>
                    <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 text-slate-900 space-y-1">
                      <span className="font-bold block text-[11px] text-slate-700">
                        💬 ความคิดเห็น / สิ่งที่ต้องปรับปรุง:
                      </span>
                      <p className="text-xs text-slate-800 italic">
                        &ldquo;{submissions[0]?.notes?.[0]?.content || "หัวข้อน่าสนใจมาก ขอให้เพิ่มการทบทวนวรรณกรรมเกี่ยวกับสถาปัตยกรรม YOLOv8 ในบทที่ 2 ด้วยครับ"}&rdquo;
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      ส่งถึง ID Line: {submissions[0]?.lineId || "thana_dev"}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 border-t border-slate-100">
                    <div className="text-center text-[11px] font-semibold text-blue-600">
                      นักศึกษาเปิดอ่านและปรับปรุงตามคำแนะนำได้ทันที
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 5. SETTINGS & PRODUCTION GUIDE (ใช้งานจริง)                    */}
        {/* ============================================================== */}
        {currentUser === "admin" && isAdminAuthenticated && activeTab === "SETTINGS" && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="border-b border-slate-200 pb-4">
              <span className="text-xs font-bold text-slate-900 bg-slate-200 px-3 py-1 rounded-full uppercase">
                ⚙️ ตั้งค่าและนำระบบไปใช้งานจริง
              </span>
              <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                วิธีเชื่อมต่อ LINE จริง และนำเว็บไซต์ขึ้นออนไลน์
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                ระบบเชื่อมต่อกับบัญชี LINE Official Account ของคุณเรียบร้อยแล้ว หรือปรับเปลี่ยนค่า Token ได้ทันทีที่นี่
              </p>
            </div>

            {/* Status Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      lineStatus.isConfigured
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      1. สถานะ LINE Messaging API (แจ้งเตือนอาจารย์ & ส่งผลตรวจ)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lineStatus.isConfigured
                        ? `เชื่อมต่อกับ LINE อาจารย์เรียบร้อยแล้ว (${lineStatus.advisorIdMasked})`
                        : "ปัจจุบันอยู่ในโหมดจำลอง (ยังไม่ได้เชื่อมต่อ Token ของจริง)"}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    lineStatus.isConfigured
                      ? "bg-emerald-500 text-white"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {lineStatus.isConfigured ? "พร้อมใช้งานจริง" : "โหมดจำลอง"}
                </span>
              </div>

              {/* LIFF Status Sub-row */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      lineStatus.hasLiffId
                        ? "bg-emerald-100 text-[#06C755]"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      2. สถานะ LINE LIFF (ดึงข้อมูลนักศึกษา & LINE User ID อัตโนมัติ)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {lineStatus.hasLiffId ? (
                        <>
                          ลิงก์ LIFF ฟอร์มส่งงาน:{" "}
                          <a
                            href={`https://liff.line.me/${lineStatus.liffId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 font-bold underline font-mono"
                          >
                            https://liff.line.me/{lineStatus.liffId}
                          </a>
                        </>
                      ) : (
                        "ยังไม่ได้ระบุ LIFF ID (สามารถสร้างได้ฟรีใน LINE Developers Console)"
                      )}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    lineStatus.hasLiffId
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {lineStatus.hasLiffId ? "เปิดใช้งาน LIFF แล้ว" : "ยังไม่ได้ตั้งค่า"}
                </span>
              </div>
            </div>

            {/* Quick Connect Form */}
            <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Lock className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  อัปเดตการเชื่อมต่อ LINE Messaging API & LIFF
                </h3>
              </div>

              <form onSubmit={handleSaveAndTestLine} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">
                    1. Channel Access Token (จาก LINE Developers Console)
                  </label>
                  <input
                    type="password"
                    required
                    value={lineSettings.token}
                    onChange={(e) => setLineSettings({ ...lineSettings, token: e.target.value })}
                    placeholder="วางรหัส Token ยาวๆ ที่ได้จากหน้า Messaging API"
                    className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">
                    2. LINE User ID ของอาจารย์ (ขึ้นต้นด้วยตัว U... ความยาวประมาณ 33 ตัวอักษร)
                  </label>
                  <input
                    type="text"
                    required
                    value={lineSettings.advisorId}
                    onChange={(e) => setLineSettings({ ...lineSettings, advisorId: e.target.value })}
                    placeholder="เช่น U41bd7b5a88f4dff8fd2ea69d9b34a873"
                    className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono text-slate-900"
                  />
                  <p className="text-[11px] text-slate-400">
                    * ดูได้จากหน้า LINE Developers Console แท็บ Basic settings หัวข้อ Your user ID
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 block">
                      3. LIFF ID สำหรับฟอร์มนักศึกษา (ไม่บังคับ - ระบุเพื่อเปิดใช้งานดึงข้อมูลอัตโนมัติ)
                    </label>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                      LIFF Integration
                    </span>
                  </div>
                  <input
                    type="text"
                    value={lineSettings.liffId}
                    onChange={(e) => setLineSettings({ ...lineSettings, liffId: e.target.value })}
                    placeholder="เช่น 2012510989-xxxxxx (จากแท็บ LIFF ใน LINE Developers)"
                    className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono text-slate-900"
                  />
                  <p className="text-[11px] text-slate-400">
                    * เมื่อใส่ค่านี้ นักศึกษาที่เปิดฟอร์มผ่าน LINE ระบบจะดึง LINE User ID ให้อัตโนมัติ 100%
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSavingLine}
                    className="flex-1 py-3 bg-[#06C755] hover:bg-[#05a948] text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {isSavingLine ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        กำลังตรวจสอบและส่งข้อความทดสอบไปยังแอป LINE...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        บันทึกและส่งข้อความทดสอบเข้าแอป LINE อาจารย์ทันที
                      </>
                    )}
                  </button>

                  {lineSettings.liffId && (
                    <button
                      type="button"
                      onClick={handleSaveLiffOnly}
                      disabled={isSavingLine}
                      className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition disabled:opacity-50"
                    >
                      บันทึกเฉพาะ LIFF ID
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Comprehensive LIFF Creation Step-by-Step Guide */}
            <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/50 p-6 rounded-3xl border border-emerald-200 text-xs space-y-4 text-slate-700">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#06C755]" />
                <h4 className="font-bold text-slate-900 text-sm">
                  คู่มือวิธีสร้าง LINE LIFF App เพื่อดึง LINE User ID นักศึกษาอัตโนมัติ
                </h4>
              </div>
              <ol className="list-decimal pl-5 space-y-2.5 leading-relaxed">
                <li>
                  <strong>เข้าสู่ระบบ LINE Developers:</strong> ไปที่{" "}
                  <a
                    href="https://developers.line.biz"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 font-bold underline"
                  >
                    https://developers.line.biz
                  </a>{" "}
                  แล้วเลือก Provider และ Channel (Messaging API) เดียวกับบอทของคุณ
                </li>
                <li>
                  <strong>ไปที่แท็บ LIFF:</strong> คลิกแท็บ <strong>&quot;LIFF&quot;</strong> แล้วกดปุ่ม{" "}
                  <strong>&quot;Add&quot;</strong> เพื่อสร้างแอปพลิเคชัน LIFF ใหม่
                </li>
                <li>
                  <strong>ตั้งค่าข้อมูล LIFF:</strong>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-600">
                    <li>
                      <strong>LIFF app name:</strong> เช่น <code>ฟอร์มส่งโครงงาน มธ</code>
                    </li>
                    <li>
                      <strong>Size:</strong> เลือก <code>Full</code> (เปิดเต็มหน้าจอมือถือ)
                    </li>
                    <li>
                      <strong>Endpoint URL:</strong> ระบุ URL ของเว็บไซต์ (เช่น{" "}
                      <code>https://project-tracking-system-for-advisor.vercel.app/form</code> หรือ URL บน Vercel)
                    </li>
                    <li>
                      <strong>Scopes:</strong> ติ๊กถูกที่ <code>profile</code> และ <code>openid</code>
                    </li>
                    <li>
                      <strong>Bot link feature:</strong> เลือก <code>On (Normal)</code> หรือ{" "}
                      <code>On (Aggressive)</code> เพื่อเชิญชวนให้นักศึกษากดเพิ่มเพื่อนกับบอทอัตโนมัติ
                    </li>
                  </ul>
                </li>
                <li>
                  <strong>กด Add และคัดลอก LIFF ID:</strong> นำรหัส <strong>LIFF ID</strong> (รูปแบบเช่น{" "}
                  <code>2012510989-xxxxxx</code>) มาใส่ในช่องด้านบน แล้วกดบันทึก
                </li>
                <li>
                  <strong>แชร์ลิงก์ให้นักศึกษา:</strong> คุณสามารถนำลิงก์{" "}
                  <code className="bg-white px-1.5 py-0.5 rounded font-mono text-emerald-800">
                    https://liff.line.me/{lineStatus.liffId || "{LIFF_ID}"}
                  </code>{" "}
                  ไปใส่ใน Rich Menu หรือส่งในกลุ่ม LINE ได้เลย! เมื่อนักศึกษาแตะเปิด ระบบจะล็อกอินและกรอกรหัส User ID ให้ครบ 100% ทันที
                </li>
              </ol>
            </div>

            {/* 4 Step Visual Guide for Online Deployment */}
            <div className="bg-slate-100 p-6 rounded-3xl border border-slate-200 text-xs space-y-4 text-slate-700">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" />
                วิธีนำเว็บไซต์ขึ้นออนไลน์ (Deploy ให้ทุกคนเข้าใช้ผ่านอินเทอร์เน็ตได้ฟรี)
              </h4>
              <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
                <li>
                  <strong>อัปโหลดโปรเจกต์ขึ้น GitHub:</strong> นำโค้ดโฟลเดอร์นี้ขึ้น GitHub Repository ของคุณ
                </li>
                <li>
                  <strong>เชื่อมต่อกับ Vercel:</strong> เข้าเว็บ <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">vercel.com</a> แล้วกด Import โครงการนี้
                </li>
                <li>
                  <strong>ใส่ Environment Variables บน Vercel:</strong> นำค่า <code className="bg-white px-1.5 py-0.5 rounded font-mono">LINE_CHANNEL_ACCESS_TOKEN</code> และ <code className="bg-white px-1.5 py-0.5 rounded font-mono">LINE_ADVISOR_USER_ID</code> ไปใส่ในแท็บ Environment Variables ของ Vercel
                </li>
                <li>
                  <strong>กด Deploy:</strong> คุณจะได้ลิงก์เว็บไซต์ เช่น <code className="bg-white px-1.5 py-0.5 rounded font-mono">https://tu-project-tracker.vercel.app</code> ส่งให้นักศึกษาและอาจารย์เปิดใช้งานได้จากทุกที่ทั่วโลกทันทีครับ!
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Modal เข้าสู่ระบบสำหรับอาจารย์ที่ปรึกษา */}
        {showAdminLoginModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95">
              <button
                onClick={() => {
                  setShowAdminLoginModal(false);
                  setAdminPinError(null);
                  setAdminPinInput("");
                }}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Lock className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  เข้าสู่ระบบสำหรับอาจารย์ที่ปรึกษา
                </h3>
                <p className="text-xs text-slate-500">
                  กรุณากรอกรหัสผ่านเพื่อเข้าดูรายงานและตรวจโครงงาน (รหัสผ่านเริ่มต้น: 1234)
                </p>
              </div>

              <form onSubmit={handleAdminPinSubmit} className="space-y-4">
                <div>
                  <input
                    type="password"
                    placeholder="กรอกรหัสผ่านอาจารย์ (PIN)"
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  {adminPinError && (
                    <p className="text-xs text-rose-500 font-semibold mt-1">
                      {adminPinError}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition shadow-md shadow-blue-500/20"
                >
                  ยืนยันเข้าสู่ระบบ
                </button>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
