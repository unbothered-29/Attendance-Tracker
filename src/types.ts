export interface User {
  name: string;
  email: string;
  college: string;
}

export interface Subject {
  id: string;
  name: string;
  teacher?: string;
}

export interface TimeSlot {
  id: string;
  subjectId: string;
  start: string; // HH:mm
  end: string; // HH:mm
  dayOfWeek: number; // 0 (Sun) to 6 (Sat)
  year?: string; // Optional year identifier
  division?: string; // Optional division identifier
  batch?: string; // Optional batch identifier
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  slotId: string;
  status: 'attended' | 'skipped';
}

export interface AppState {
  user: User | null;
  attendanceGoal: number;
  subjects: Subject[];
  timetable: TimeSlot[];
  markedOffDays: string[]; // YYYY-MM-DD
  attendanceLog: Record<string, AttendanceRecord>; // key: `${date}_${slotId}`
  dailySlotOverrides?: Record<string, TimeSlot>; // key: `${date}_${slotId}`
  isSetupComplete: boolean;
  userBatch?: string;
  userYear?: string;
  userDivision?: string;
  userField?: string;
  userSemester?: string;
  notes?: Record<string, string>;
}
