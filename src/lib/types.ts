export type UserRole = "admin" | "general" | null;

export type ProjectStatus = "PENDING" | "NEEDS_REVISION" | "APPROVED" | "REJECTED";

export interface NoteItem {
  id: string;
  author: string;
  content: string;
  sentAt: string;
  sentToLineId: string;
  deliveryStatus: "SENT" | "SIMULATED" | "FAILED";
}

export interface SubmissionItem {
  id: string;
  projectTitle: string;
  groupName: string;
  department: string;
  studentName: string;
  studentId: string;
  lineId: string;
  pdfFileName: string;
  pdfFileUrl: string;
  submittedAt: string;
  status: ProjectStatus;
  notes: NoteItem[];
}
