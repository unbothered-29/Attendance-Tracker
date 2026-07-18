import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, Subject, TimeSlot, User, AttendanceRecord } from '../types';

const defaultState: AppState = {
  user: null,
  attendanceGoal: 75,
  subjects: [],
  timetable: [],
  markedOffDays: [],
  attendanceLog: {},
  isSetupComplete: false,
};

interface AppContextType {
  state: AppState;
  login: (user: User) => void;
  setAttendanceGoal: (goal: number) => void;
  setSubjects: (subjects: Subject[]) => void;
  setTimetable: (slots: TimeSlot[]) => void;
  setUserBatch: (batch: string) => void;
  setUserYear: (year: string) => void;
  setUserField: (field: string) => void;
  setUserSemester: (semester: string) => void;
  completeSetup: () => void;
  toggleOffDay: (date: string) => void;
  markAttendance: (date: string, slotId: string, status: 'attended' | 'skipped') => void;
  removeAttendance: (date: string, slotId: string) => void;
  updateTimetableSlot: (slot: TimeSlot) => void;
  updateDailySlotOverride: (date: string, slot: TimeSlot) => void;
  startNewSemester: () => void;
  resetData: () => void;
  setNote: (date: string, note: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('attendance_app_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse state', e);
      }
    }
    return defaultState;
  });

  useEffect(() => {
    localStorage.setItem('attendance_app_state', JSON.stringify(state));
  }, [state]);

  const login = (user: User) => setState((s) => ({ ...s, user }));
  const setAttendanceGoal = (attendanceGoal: number) => setState((s) => ({ ...s, attendanceGoal }));
  const setSubjects = (subjects: Subject[]) => setState((s) => ({ ...s, subjects }));
  const setTimetable = (timetable: TimeSlot[]) => setState((s) => ({ ...s, timetable }));
  const setUserBatch = (batch: string) => setState((s) => ({ ...s, userBatch: batch }));
  const setUserYear = (year: string) => setState((s) => ({ ...s, userYear: year }));
  const setUserField = (field: string) => setState((s) => ({ ...s, userField: field }));
  const setUserSemester = (semester: string) => setState((s) => ({ ...s, userSemester: semester }));
  const completeSetup = () => setState((s) => ({ ...s, isSetupComplete: true }));

  const toggleOffDay = (date: string) => {
    setState((s) => {
      const isOff = s.markedOffDays.includes(date);
      if (isOff) {
        return { ...s, markedOffDays: s.markedOffDays.filter((d) => d !== date) };
      }
      return { ...s, markedOffDays: [...s.markedOffDays, date] };
    });
  };

  const markAttendance = (date: string, slotId: string, status: 'attended' | 'skipped') => {
    setState((s) => {
      const key = `${date}_${slotId}`;
      const newLog = { ...s.attendanceLog };
      newLog[key] = { id: key, date, slotId, status };
      return { ...s, attendanceLog: newLog };
    });
  };

  const removeAttendance = (date: string, slotId: string) => {
    setState((s) => {
      const key = `${date}_${slotId}`;
      const newLog = { ...s.attendanceLog };
      delete newLog[key];
      return { ...s, attendanceLog: newLog };
    });
  };

  const updateTimetableSlot = (slot: TimeSlot) => {
    setState((s) => ({
      ...s,
      timetable: s.timetable.map(t => t.id === slot.id ? slot : t)
    }));
  };

  const updateDailySlotOverride = (date: string, slot: TimeSlot) => {
    setState((s) => {
      const key = `${date}_${slot.id}`;
      return {
        ...s,
        dailySlotOverrides: {
          ...(s.dailySlotOverrides || {}),
          [key]: slot
        }
      };
    });
  };

  const startNewSemester = () => {
    setState((s) => ({
      ...defaultState,
      user: s.user,
      userField: s.userField,
      userYear: s.userYear,
      userBatch: s.userBatch,
      userSemester: s.userSemester,
    }));
  };

  const resetData = () => {
    setState(defaultState);
  };

  const setNote = (date: string, note: string) => {
    setState((s) => ({
      ...s,
      notes: { ...s.notes, [date]: note },
    }));
  };

  return (
    <AppContext.Provider
      value={{
        state,
        login,
        setAttendanceGoal,
        setSubjects,
        setTimetable,
        setUserBatch,
        setUserYear,
        setUserField,
        setUserSemester,
        completeSetup,
        toggleOffDay,
        markAttendance,
        removeAttendance,
        updateTimetableSlot,
        updateDailySlotOverride,
        startNewSemester,
        resetData,
        setNote,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within an AppProvider');
  return context;
}
