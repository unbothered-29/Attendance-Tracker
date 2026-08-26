import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState, Subject, TimeSlot, User } from '../types';
import { auth, googleProvider, db } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInAnonymously, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword as fbUpdatePassword,
  updateProfile as fbUpdateProfile,
  signOut as firebaseSignOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';

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
  loginWithPassword: (identifier: string, password: string) => Promise<void>;
  registerWithPassword: (data: { name: string; username: string; email?: string; college: string; password: string }) => Promise<void>;
  updateUserPassword: (newPassword: string) => Promise<void>;
  updateUserProfile: (user: Partial<User>) => Promise<void>;
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

// Helper to convert username to deterministic auth email
export function getEmailForUsername(identifier: string): string {
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  const cleanUsername = trimmed.replace(/^@/, '').replace(/[^a-z0-9_.-]/g, '');
  return `${cleanUsername || 'student'}@student.attendance.app`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('attendance_app_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.user?.photoUrl && parsed.user.photoUrl.length > 150000) {
          parsed.user.photoUrl = '';
        }
        return parsed;
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

  // Helper to remove undefined fields and handle document payload limits before sending to Firestore
  const sanitizeForFirestore = (data: any) => {
    const cleaned = JSON.parse(JSON.stringify(data));
    if (cleaned.user?.photoUrl && cleaned.user.photoUrl.length > 150000) {
      delete cleaned.user.photoUrl;
    }
    return cleaned;
  };

  // Sync state changes to Firestore if user logged in
  useEffect(() => {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    if (firebaseUser) {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const dataToSave = sanitizeForFirestore({
        ...state,
        updatedAt: new Date().toISOString()
      });
      setDoc(userDocRef, dataToSave, { merge: true }).catch(err => {
        console.error('Failed to save state to Firestore:', err);
      });
    }
  }, [state, firebaseUser]);

  // Firebase auth state listener & Firestore real-time sync
  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      setFirebaseUser(user);
      setLoadingAuth(false);

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeDoc = onSnapshot(
          userDocRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              isRemoteUpdate.current = true;
              setState((prev) => ({
                ...prev,
                user: {
                  uid: user.uid,
                  name: data.user?.name || user.displayName || prev.user?.name || 'Student',
                  username: data.user?.username || prev.user?.username || '',
                  photoUrl: data.user?.photoUrl || user.photoURL || prev.user?.photoUrl || '',
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
          },
          (err) => {
            if (err.code === 'permission-denied') {
              return;
            }
            console.error('Error listening to user document:', err);
          }
        );
      }
    });

    return () => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
      unsubscribeAuth();
    };
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
      const dataToSave = sanitizeForFirestore({
        user: updatedUser,
        updatedAt: new Date().toISOString()
      });
      await setDoc(userDocRef, dataToSave, { merge: true });
    }
  };

  const loginWithPassword = async (identifier: string, password: string) => {
    const email = getEmailForUsername(identifier);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);

      const cleanUname = identifier.includes('@student.attendance.app')
        ? identifier.split('@')[0]
        : (identifier.includes('@') ? '' : identifier.replace(/^@/, ''));

      let userInfo: User = {
        uid: user.uid,
        name: user.displayName || cleanUname || 'Student',
        username: cleanUname,
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
    } catch (error: any) {
      console.error('Password login error:', error);
      if (
        error?.code === 'auth/invalid-credential' ||
        error?.code === 'auth/user-not-found' ||
        error?.code === 'auth/wrong-password'
      ) {
        throw new Error('Invalid username/email or password. Please check your credentials.');
      }
      if (error?.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please wait a moment and try again.');
      }
      throw new Error(error?.message || 'Failed to sign in with password.');
    }
  };

  const registerWithPassword = async (data: { name: string; username: string; email?: string; college: string; password: string }) => {
    const cleanUsername = data.username.trim().replace(/^@/, '');
    const authEmail = data.email?.trim() ? data.email.trim() : getEmailForUsername(cleanUsername);

    try {
      const cred = await createUserWithEmailAndPassword(auth, authEmail, data.password);
      const user = cred.user;
      
      await fbUpdateProfile(user, {
        displayName: data.name
      }).catch(() => {});

      const newUser: User = {
        uid: user.uid,
        name: data.name,
        username: cleanUsername,
        email: data.email?.trim() || authEmail,
        college: data.college || 'Not specified'
      };

      setState((s) => ({ ...s, user: newUser }));

      const userDocRef = doc(db, 'users', user.uid);
      const dataToSave = sanitizeForFirestore({
        user: newUser,
        updatedAt: new Date().toISOString()
      });
      await setDoc(userDocRef, dataToSave, { merge: true });
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error?.code === 'auth/email-already-in-use') {
        throw new Error('This username or email is already registered. Please sign in instead.');
      }
      if (error?.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters long.');
      }
      if (error?.code === 'auth/invalid-email') {
        throw new Error('Invalid username or email format.');
      }
      throw new Error(error?.message || 'Failed to create account.');
    }
  };

  const updateUserPassword = async (newPassword: string) => {
    if (!auth.currentUser) {
      throw new Error('No user is currently signed in.');
    }
    try {
      await fbUpdatePassword(auth.currentUser, newPassword);
      // Record update timestamp
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userDocRef, { passwordLastUpdated: new Date().toISOString() }, { merge: true });
    } catch (error: any) {
      console.error('Update password error:', error);
      if (error?.code === 'auth/requires-recent-login') {
        throw new Error('For security, please log out and sign in again before changing your password.');
      }
      if (error?.code === 'auth/weak-password') {
        throw new Error('New password should be at least 6 characters.');
      }
      throw new Error(error?.message || 'Failed to update password.');
    }
  };

  const updateUserProfile = async (updatedFields: Partial<User>) => {
    setState((s) => {
      if (!s.user) return s;
      const newUser = { ...s.user, ...updatedFields };
      return { ...s, user: newUser };
    });

    const currentFbUser = auth.currentUser;
    if (currentFbUser) {
      if (updatedFields.name) {
        fbUpdateProfile(currentFbUser, { displayName: updatedFields.name }).catch(() => {});
      }
      const userDocRef = doc(db, 'users', currentFbUser.uid);
      const dataToSave = sanitizeForFirestore({
        user: { ...state.user, ...updatedFields, uid: currentFbUser.uid },
        updatedAt: new Date().toISOString()
      });
      await setDoc(userDocRef, dataToSave, { merge: true });
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

      const dataToSave = sanitizeForFirestore({
        user: userInfo,
        updatedAt: new Date().toISOString()
      });

      await setDoc(userDocRef, dataToSave, { merge: true });
    } catch (error: any) {
      if (
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request'
      ) {
        console.warn('Google sign-in popup was closed by the user.');
        return;
      }
      if (error?.code === 'auth/unauthorized-domain') {
        alert('This domain is not listed in your Firebase Authorized Domains. Please add ' + window.location.hostname + ' to Firebase Console -> Authentication -> Settings -> Authorized domains.');
        return;
      }
      console.error('Google sign-in error:', error);
      alert(`Sign in error: ${error?.message || 'Failed to sign in'}`);
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
        loginWithPassword,
        registerWithPassword,
        updateUserPassword,
        updateUserProfile,
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
