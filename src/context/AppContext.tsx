import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState, Subject, TimeSlot, User } from '../types';
import { auth, googleProvider, db } from '../lib/firebase';
import { onAuthStateChanged, signInWithPopup, signInAnonymously, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

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
  firebaseUser: FirebaseUser | null;
  loadingAuth: boolean;
  login: (user: User) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setAttendanceGoal: (goal: number) => void;
  setSubjects: (subjects: Subject[]) => void;
  setTimetable: (slots: TimeSlot[]) => void;
  setUserBatch: (batch: string) => void;
  setUserYear: (year: string) => void;
  setUserDivision: (division: string) => void;
  setUserField: (field: string) => void;
  setUserSemester: (semester: string) => void;
  completeSetup: () => void;
  toggleOffDay: (date: string) => void;
  markAttendance: (date: string, slotId: string, status: 'attended' | 'skipped' | 'cancelled') => void;
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
        console.error('Failed to parse state from localStorage', e);
      }
    }
    return defaultState;
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const isRemoteUpdate = useRef(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('attendance_app_state', JSON.stringify(state));
  }, [state]);

  // Sync state changes to Firestore if user logged in
  useEffect(() => {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    if (firebaseUser) {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      setDoc(userDocRef, {
        ...state,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.error('Failed to save state to Firestore:', err);
      });
    }
  }, [state, firebaseUser]);

  // Firebase auth state listener & Firestore real-time sync
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setLoadingAuth(false);

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeDoc = onSnapshot(userDocRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            isRemoteUpdate.current = true;
            setState((prev) => ({
              ...prev,
              user: {
                uid: user.uid,
                name: data.user?.name || user.displayName || prev.user?.name || 'Student',
                email: data.user?.email || user.email || prev.user?.email || '',
                college: data.user?.college || prev.user?.college || 'Not specified',
              },
              attendanceGoal: data.attendanceGoal ?? prev.attendanceGoal,
              subjects: data.subjects ?? prev.subjects,
              timetable: data.timetable ?? prev.timetable,
              markedOffDays: data.markedOffDays ?? prev.markedOffDays,
              attendanceLog: data.attendanceLog ?? prev.attendanceLog,
              dailySlotOverrides: data.dailySlotOverrides ?? prev.dailySlotOverrides,
              isSetupComplete: data.isSetupComplete ?? prev.isSetupComplete,
              userBatch: data.userBatch ?? prev.userBatch,
              userYear: data.userYear ?? prev.userYear,
              userDivision: data.userDivision ?? prev.userDivision,
              userField: data.userField ?? prev.userField,
              userSemester: data.userSemester ?? prev.userSemester,
              notes: data.notes ?? prev.notes,
            }));
          }
        }, (err) => {
          console.error('Error listening to user document:', err);
        });

        return () => unsubscribeDoc();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const login = async (user: User) => {
    let currentFbUser = auth.currentUser;
    if (!currentFbUser) {
      try {
        const res = await signInAnonymously(auth);
        currentFbUser = res.user;
      } catch (e) {
        console.error('Anonymous sign in failed:', e);
      }
    }
    
    const updatedUser = { ...user, uid: currentFbUser?.uid };
    setState((s) => ({ ...s, user: updatedUser }));

    if (currentFbUser) {
      const userDocRef = doc(db, 'users', currentFbUser.uid);
      await setDoc(userDocRef, {
        user: updatedUser,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);

      let userInfo: User = {
        uid: user.uid,
        name: user.displayName || 'Student',
        email: user.email || '',
        college: 'Not specified'
      };

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.user) {
          userInfo = { ...data.user, uid: user.uid };
        }
      }

      setState((s) => ({ ...s, user: userInfo }));

      await setDoc(userDocRef, {
        user: userInfo,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.error('Logout error:', e);
    }
    setState(defaultState);
    localStorage.removeItem('attendance_app_state');
  };

  const setAttendanceGoal = (attendanceGoal: number) => setState((s) => ({ ...s, attendanceGoal }));
  const setSubjects = (subjects: Subject[]) => setState((s) => ({ ...s, subjects }));
  const setTimetable = (timetable: TimeSlot[]) => setState((s) => ({ ...s, timetable }));
  const setUserBatch = (batch: string) => setState((s) => ({ ...s, userBatch: batch }));
  const setUserYear = (year: string) => setState((s) => ({ ...s, userYear: year }));
  const setUserDivision = (division: string) => setState((s) => ({ ...s, userDivision: division }));
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

  const markAttendance = (date: string, slotId: string, status: 'attended' | 'skipped' | 'cancelled') => {
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
      userDivision: s.userDivision,
      userBatch: s.userBatch,
      userSemester: s.userSemester,
    }));
  };

  const resetData = () => {
    logout();
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
        firebaseUser,
        loadingAuth,
        login,
        loginWithGoogle,
        logout,
        setAttendanceGoal,
        setSubjects,
        setTimetable,
        setUserBatch,
        setUserYear,
        setUserDivision,
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
