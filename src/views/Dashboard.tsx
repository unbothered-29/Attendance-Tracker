import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { NATIONAL_HOLIDAYS, cn, formatTime12 } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { format, addDays, startOfWeek, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, endOfWeek } from 'date-fns';
import { CheckCircle2, XCircle, CalendarOff, LogOut, Edit2, Save, User as UserIcon, UploadCloud, Plus, Calendar, MinusCircle } from 'lucide-react';
import { Subject, TimeSlot, User } from '../types';
import { TimePicker12 } from '../components/TimePicker12';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Dashboard() {
  const { 
    state, markAttendance, removeAttendance, toggleOffDay, 
    updateDailySlotOverride, updateTimetableSlot, startNewSemester, 
    resetData, setNote, setSubjects, setTimetable,
    login, setUserField, setUserYear, setUserDivision, setUserBatch, setUserSemester, setAttendanceGoal
  } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal states
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [editingNote, setEditingNote] = useState('');
  
  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const [isUploadingTimetable, setIsUploadingTimetable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddTimetable = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingTimetable(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const res = await fetch("/api/parse-timetable", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64 })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to parse timetable");

          const generateId = () => Math.random().toString(36).substr(2, 9);
          // Add new subjects
          const newSubjects = (data.subjects || []).map((s: any) => ({ ...s, id: generateId() }));
          // Add new slots, matching new subject IDs
          const newSlots = (data.slots || []).map((s: any) => {
            const parsedSubject = data.subjects?.find((sub: any) => sub.id === s.subjectId);
            const matchingNewSubject = newSubjects.find((sub: any) => sub.name === parsedSubject?.name);
            return {
              ...s,
              id: generateId(),
              subjectId: matchingNewSubject ? matchingNewSubject.id : s.subjectId,
              year: s.year || undefined,
              division: s.division || undefined,
              batch: s.batch || undefined
            };
          });

          setSubjects([...state.subjects, ...newSubjects]);
          setTimetable([...state.timetable, ...newSlots]);
          alert("Timetable added successfully!");
        } catch (err: any) {
          console.error(err);
          alert(err.message || 'Failed to read image. Please try again.');
        } finally {
          setIsUploadingTimetable(false);
        }
      };
      reader.onerror = () => {
        alert('Failed to read file');
        setIsUploadingTimetable(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      alert('Failed to process file.');
      setIsUploadingTimetable(false);
    }
  };

  // Weekly grid date context
  const weekStart = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  // Calendar days context
  const calendarDays = useMemo(() => {
    if (!showCalendarModal) return [];
    const start = startOfWeek(startOfMonth(calendarViewDate));
    const end = endOfWeek(endOfMonth(calendarViewDate));
    return eachDayOfInterval({ start, end });
  }, [calendarViewDate, showCalendarModal]);

  const filteredTimetable = useMemo(() => {
    return state.timetable.filter(t => {
      if (t.year && state.userYear && t.year !== state.userYear) return false;
      if (t.division && state.userDivision && t.division !== state.userDivision) return false;
      if (t.batch && state.userBatch && t.batch !== state.userBatch) return false;
      return true;
    });
  }, [state.timetable, state.userYear, state.userDivision, state.userBatch]);

  // Compute Stats
  const stats = useMemo(() => {
    const res: Record<string, { 
      lecture: { attended: number; total: number },
      practical: { attended: number; total: number }
    }> = {};
    state.subjects.forEach(s => res[s.id] = { 
      lecture: { attended: 0, total: 0 },
      practical: { attended: 0, total: 0 }
    });

    Object.values(state.attendanceLog).forEach((log: any) => {
      // Check if date is a holiday or marked off
      if (NATIONAL_HOLIDAYS.includes(log.date) || state.markedOffDays.includes(log.date)) return;
      
      const slot = filteredTimetable.find(s => s.id === log.slotId);
      if (slot && res[slot.subjectId]) {
        const type = slot.batch ? 'practical' : 'lecture';
        if (log.status !== 'cancelled') {
          res[slot.subjectId][type].total += 1;
          if (log.status === 'attended') {
            res[slot.subjectId][type].attended += 1;
          }
        }
      }
    });

    return res;
  }, [state.attendanceLog, state.subjects, filteredTimetable, state.markedOffDays]);

  const [selectedSlotInfo, setSelectedSlotInfo] = useState<{ slot: TimeSlot, dateStr: string } | null>(null);
  const [selectedDayAction, setSelectedDayAction] = useState<{ dateStr: string, date: Date, slots: TimeSlot[] } | null>(null);
  const [isEditingSlot, setIsEditingSlot] = useState(false);
  const [editSlotData, setEditSlotData] = useState<TimeSlot | null>(null);
  const [showConfirmSemester, setShowConfirmSemester] = useState(false);

  const getSubjectName = (id: string) => state.subjects.find(s => s.id === id)?.name || 'Unknown';

  const handleDayMark = (status: 'attended' | 'skipped' | 'cancelled') => {
    if (!selectedDayAction) return;
    const { dateStr, slots } = selectedDayAction;
    slots.forEach(slot => {
      markAttendance(dateStr, slot.id, status);
    });
    setSelectedDayAction(null);
  };

  const handleDayHolidayToggle = () => {
    if (!selectedDayAction) return;
    toggleOffDay(selectedDayAction.dateStr);
    setSelectedDayAction(null);
  };

  const handleSlotClick = (slot: TimeSlot, dateStr: string) => {
    setSelectedSlotInfo({ slot, dateStr });
    setIsEditingSlot(false);
    setEditSlotData({ ...slot });
  };

  const handleMark = (status: 'attended' | 'skipped' | 'cancelled') => {
    if (!selectedSlotInfo) return;
    const { slot, dateStr } = selectedSlotInfo;
    const key = `${dateStr}_${slot.id}`;
    
    // Toggle logic
    const existing = state.attendanceLog[key];
    if (existing && existing.status === status) {
      removeAttendance(dateStr, slot.id);
    } else {
      markAttendance(dateStr, slot.id, status);
    }
    setSelectedSlotInfo(null);
  };

  const handleSaveForToday = () => {
    if (!selectedSlotInfo || !editSlotData) return;
    updateDailySlotOverride(selectedSlotInfo.dateStr, editSlotData);
    setSelectedSlotInfo(null);
  };

  const handleSavePermanently = () => {
    if (!selectedSlotInfo || !editSlotData) return;
    updateTimetableSlot(editSlotData);
    setSelectedSlotInfo(null);
  };

  // Check if a specific slot on a specific date is marked
  const getSlotStatus = (dateStr: string, slotId: string) => {
    const isHoliday = NATIONAL_HOLIDAYS.includes(dateStr) || state.markedOffDays.includes(dateStr);
    if (isHoliday) return 'holiday';
    return state.attendanceLog[`${dateStr}_${slotId}`]?.status;
  };

  useEffect(() => {
    // Scroll to the current date on mobile devices
    if (window.innerWidth < 768) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const el = document.getElementById(`day-${dateStr}`);
      if (el) {
        // Use a small timeout to ensure rendering is complete
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, 100);
      }
    }
  }, [currentDate]);

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-8 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent blur-3xl -z-10 rounded-full" />
        <div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight bg-gradient-to-br from-white via-white to-purple-400 bg-clip-text text-transparent">
            {state.user?.name}'s Dashboard
          </h1>
          <p className="text-gray-400 mt-2 flex flex-wrap items-center gap-2 text-sm sm:text-base">
            <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10">{state.userField && state.userYear ? `${state.userField} - ${state.userYear}` : 'No Field'}</span>
            {state.userDivision && <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10">Div {state.userDivision}</span>}
            {state.userSemester && <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10">Sem {state.userSemester}</span>}
            {state.userBatch && <span className="px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-200">Batch {state.userBatch}</span>}
            <span className="px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-300">Goal: {state.attendanceGoal}%</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Button variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10" onClick={() => setShowConfirmSemester(true)}>
            New Semester
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowProfileModal(true)} title="Profile">
            <UserIcon className="w-5 h-5 text-gray-400 hover:text-white" />
          </Button>
        </div>
      </header>

      <div className="space-y-12">
        
        {/* Timetable Grid & Calendar */}
        <div className="space-y-8">
          
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 gap-4 sm:gap-0">
              <div className="text-lg font-medium text-purple-300 sm:w-1/3">
                <button 
                  className="flex items-center gap-2 hover:text-purple-200 hover:bg-white/5 py-1 px-3 rounded-lg transition-colors focus:outline-none"
                  onClick={() => {
                    setCalendarViewDate(currentDate);
                    setShowCalendarModal(true);
                  }}
                  title="Open Calendar"
                >
                  <Calendar className="w-5 h-5" />
                  {format(currentDate, 'MMMM yyyy')}
                </button>
              </div>
              <div className="sm:w-1/3 flex sm:justify-center">
                <CardTitle>This Week's Schedule</CardTitle>
              </div>
              <div className="flex gap-2 sm:w-1/3 sm:justify-end">
                <Button variant="ghost" size="sm" onClick={() => setCurrentDate(addDays(currentDate, -7))}>&larr; Prev</Button>
                <Button variant="ghost" size="sm" onClick={() => setCurrentDate(addDays(currentDate, 7))}>Next &rarr;</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar" id="timetable-scroll-container">
                <div className="flex md:grid md:grid-cols-7 gap-4 md:gap-2 min-w-full md:min-w-[700px]">
                  {/* Days Header */}
                  {weekDays.map((date, i) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const isToday = isSameDay(date, new Date());
                    const isHoliday = NATIONAL_HOLIDAYS.includes(dateStr) || state.markedOffDays.includes(dateStr);
                    
                    return (
                      <div key={i} id={`day-${dateStr}`} className="w-full shrink-0 md:w-auto md:shrink snap-center text-center space-y-3">
                        <div className={cn(
                          "py-3 rounded-xl border cursor-pointer select-none transition-all shadow-sm",
                          isToday ? "bg-purple-500/20 border-purple-500/50 shadow-purple-500/10" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]",
                          isHoliday && "opacity-50 border-dashed hover:opacity-80"
                        )}
                        onClick={() => setSelectedDayAction({
                          dateStr,
                          date,
                          slots: filteredTimetable.filter(t => t.dayOfWeek === date.getDay())
                        })}
                        title="Click to manage day"
                        >
                          <div className={cn("text-xs uppercase font-bold tracking-wider", isToday ? "text-purple-300" : "text-gray-500")}>{DAYS[date.getDay()]}</div>
                          <div className={cn("text-2xl font-display font-bold mt-1", isToday ? "text-white" : "text-gray-200")}>
                            {format(date, 'd')}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{format(date, 'MMM yyyy')}</div>
                          {isHoliday && <div className="text-[10px] text-purple-400 mt-2 flex items-center justify-center font-medium bg-purple-500/10 py-1 mx-2 rounded"><CalendarOff className="w-3 h-3 mr-1"/> Holiday</div>}
                        </div>
                        
                        {/* Slots for this day */}
                        <div className="space-y-2">
                          {filteredTimetable
                            .filter(t => t.dayOfWeek === date.getDay())
                            .sort((a, b) => a.start.localeCompare(b.start))
                            .map(baseSlot => {
                              const overrideKey = `${dateStr}_${baseSlot.id}`;
                              const slot = state.dailySlotOverrides?.[overrideKey] || baseSlot;
                              
                              const status = getSlotStatus(dateStr, slot.id);
                              
                              // Calculate duration in hours
                              let durationHours = 1;
                              if (slot.start && slot.end) {
                                const [h1, m1] = slot.start.split(':').map(Number);
                                const [h2, m2] = slot.end.split(':').map(Number);
                                if (!isNaN(h1) && !isNaN(h2)) {
                                  durationHours = (h2 + (m2 || 0) / 60) - (h1 + (m1 || 0) / 60);
                                }
                              }
                              durationHours = Math.max(0.5, Math.min(4, durationHours)); // Clamp between 30m and 4h
                              
                              const baseHeightRem = 5;
                              const gapRem = 0.5; // space-y-2 is 0.5rem
                              const blockHeight = (durationHours * baseHeightRem) + ((durationHours - 1) * gapRem);
                              
                              return (
                                <div 
                                  key={slot.id}
                                  onClick={() => !isHoliday && handleSlotClick(slot, dateStr)}
                                  style={{ height: `${blockHeight}rem` }}
                                  className={cn(
                                    "p-3 rounded-xl text-left text-sm cursor-pointer border transition-all relative overflow-hidden flex flex-col justify-between shadow-sm group",
                                    status === 'holiday' ? "bg-white/[0.02] border-white/10 border-dashed opacity-50 pointer-events-none" :
                                    status === 'cancelled' ? "bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50 hover:bg-yellow-500/20" :
                                    status === 'attended' ? "bg-green-500/10 border-green-500/30 hover:border-green-500/50 hover:bg-green-500/20" :
                                    status === 'skipped' ? "bg-red-500/10 border-red-500/30 hover:border-red-500/50 hover:bg-red-500/20" :
                                    "bg-white/[0.03] border-white/10 hover:border-purple-500/40 hover:bg-white/[0.06]"
                                  )}
                                >
                                  <div className="space-y-1">
                                    <div className="font-semibold text-gray-200 truncate pr-4 leading-tight">{getSubjectName(slot.subjectId)}</div>
                                    {state.subjects.find(s => s.id === slot.subjectId)?.teacher && (
                                      <div className="text-[11px] text-gray-400 truncate pr-4">{state.subjects.find(s => s.id === slot.subjectId)?.teacher}</div>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-medium tracking-wide">{formatTime12(slot.start)} - {formatTime12(slot.end)}</div>
                                  
                                  {status === 'attended' && <CheckCircle2 className="w-4 h-4 text-green-400 absolute top-3 right-3 opacity-80" />}
                                  {status === 'skipped' && <XCircle className="w-4 h-4 text-red-400 absolute top-3 right-3 opacity-80" />}
                                  {status === 'cancelled' && <MinusCircle className="w-4 h-4 text-yellow-400 absolute top-3 right-3 opacity-80" />}
                                  {!status && <div className="absolute top-3 right-3 w-4 h-4 rounded-full border border-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Section */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-white">Attendance Stats</h2>
            <p className="text-gray-400 text-sm mt-1">Track your progress and attendance goals across all subjects.</p>
          </div>
          
          {state.subjects.filter(subject => filteredTimetable.some(t => t.subjectId === subject.id)).length === 0 && <p className="text-sm text-gray-500">No subjects tracked.</p>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {state.subjects.filter(subject => filteredTimetable.some(t => t.subjectId === subject.id)).map(subject => {
                const s = stats[subject.id];
                const totalAttended = s ? s.lecture.attended + s.practical.attended : 0;
                const totalConducted = s ? s.lecture.total + s.practical.total : 0;
                
                // Calculate projected total over 72 days
                const weeklyLectures = filteredTimetable.filter(t => t.subjectId === subject.id && !t.batch).length;
                const weeklyPracticals = filteredTimetable.filter(t => t.subjectId === subject.id && t.batch).length;
                const totalWeekly = weeklyLectures + weeklyPracticals;
                
                const semesterLectures = Math.round(weeklyLectures * (72 / 7));
                const semesterPracticals = Math.round(weeklyPracticals * (72 / 7));
                const semesterTotal = semesterLectures + semesterPracticals;
                
                const totalSkipped = totalConducted - totalAttended;
                
                const currentPerc = totalConducted > 0 ? Math.round((totalAttended / totalConducted) * 100) : 0;
                const overallPerc = semesterTotal > 0 ? Math.round((totalAttended / semesterTotal) * 100) : 0;
                const overallSkippedPerc = semesterTotal > 0 ? Math.round((totalSkipped / semesterTotal) * 100) : 0;
                
                const isSafe = currentPerc >= state.attendanceGoal;
                
                // Calculate safe skips or needed to attend based on current total
                let safeSkips = 0;
                let needed = 0;
                if (totalConducted > 0) {
                  const goalFrac = state.attendanceGoal / 100;
                  if (isSafe) {
                    safeSkips = Math.floor((totalAttended - goalFrac * totalConducted) / goalFrac);
                  } else if (goalFrac < 1) {
                    needed = Math.ceil((goalFrac * totalConducted - totalAttended) / (1 - goalFrac));
                  }
                }

                // Also calculate based on 72 days total
                const requiredToPassSemester = Math.ceil((state.attendanceGoal / 100) * semesterTotal);
                const remainingNeededForSemester = Math.max(0, requiredToPassSemester - totalAttended);
                
                let neededLectures = 0;
                let neededPracticals = 0;
                if (remainingNeededForSemester > 0 && totalWeekly > 0) {
                  neededLectures = Math.round(remainingNeededForSemester * (weeklyLectures / totalWeekly));
                  neededPracticals = remainingNeededForSemester - neededLectures;
                }

                return (
                  <div key={subject.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="font-semibold text-gray-200">{subject.name}</div>
                      <div className={cn("text-2xl font-display font-bold", isSafe ? "text-green-400" : "text-red-400")}>
                        {semesterTotal > 0 ? `${overallPerc}%` : '-'}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 text-xs text-gray-400 mt-2">
                      <div className="flex flex-col sm:flex-row justify-between">
                        <span>Current: {totalAttended} / {totalConducted} attended ({totalConducted > 0 ? currentPerc : 0}%)</span>
                        {totalConducted > 0 && (
                          <span className="mt-1 sm:mt-0 font-medium">
                            {isSafe ? (
                              <span className="text-green-400">Can skip {safeSkips} {safeSkips === 1 ? 'class' : 'classes'}</span>
                            ) : (
                              <span className="text-red-400">Need {needed} {needed === 1 ? 'class' : 'classes'} (now)</span>
                            )}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-1 mt-2 pt-3 border-t border-white/5">
                        <div className="flex flex-col sm:flex-row justify-between">
                          <span>Semester (72 Days): {totalAttended} / {semesterTotal}</span>
                          <span className="text-purple-300 font-medium mt-1 sm:mt-0">Need {remainingNeededForSemester} more to hit {state.attendanceGoal}%</span>
                        </div>
                        {remainingNeededForSemester > 0 && (
                          <div className="flex justify-end text-[10px] text-gray-500">
                            (approx. {neededLectures} lectures & {neededPracticals} practicals)
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="h-2 w-full bg-white/5 rounded-full mt-4 overflow-hidden flex ring-1 ring-white/10">
                      <div 
                        className="bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] h-full transition-all" 
                        style={{ width: `${Math.min(overallPerc, 100)}%` }}
                        title={`Attended: ${overallPerc}%`}
                      />
                      <div 
                        className="bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)] h-full transition-all" 
                        style={{ width: `${Math.min(overallSkippedPerc, 100 - Math.min(overallPerc, 100))}%` }}
                        title={`Skipped: ${overallSkippedPerc}%`}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Modal / Popup for Day Action */}
      {selectedDayAction && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm shadow-2xl border-purple-500/30 animate-in fade-in zoom-in duration-200">
            <CardHeader>
              <CardTitle>Manage Day</CardTitle>
              <p className="text-sm text-gray-400">{format(selectedDayAction.date, 'EEEE, MMM do')}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start h-12" 
                onClick={() => handleDayMark('attended')}
                variant="outline"
              >
                <CheckCircle2 className="w-5 h-5 mr-3 text-green-400" />
                Mark all as Attended
              </Button>
              <Button 
                className="w-full justify-start h-12" 
                onClick={() => handleDayMark('skipped')}
                variant="outline"
              >
                <XCircle className="w-5 h-5 mr-3 text-red-400" />
                Mark all as Skipped
              </Button>
              <Button 
                className="w-full justify-start h-12" 
                onClick={() => handleDayMark('cancelled')}
                variant="outline"
              >
                <MinusCircle className="w-5 h-5 mr-3 text-purple-400" />
                Mark all as Cancelled
              </Button>
              <Button 
                className="w-full justify-start h-12" 
                variant="outline"
                onClick={handleDayHolidayToggle}
              >
                <CalendarOff className="w-5 h-5 mr-3 text-purple-400" />
                {NATIONAL_HOLIDAYS.includes(selectedDayAction.dateStr) || state.markedOffDays.includes(selectedDayAction.dateStr) 
                  ? 'Unmark as Public Holiday' 
                  : 'Mark as Public Holiday'
                }
              </Button>
              <div className="pt-2 flex justify-end">
                <Button variant="ghost" onClick={() => setSelectedDayAction(null)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal / Popup for Slot Action */}
      {/* Confirm Semester Modal */}
      {showConfirmSemester && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm shadow-2xl border-purple-500/30 animate-in fade-in zoom-in duration-200">
            <CardHeader>
              <CardTitle>Reset timetable?</CardTitle>
              <p className="text-sm text-gray-400">Are you sure you want to start a new semester? This will reset your timetable and attendance records, but keep your profile.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start h-12" 
                variant="danger"
                onClick={() => {
                  startNewSemester();
                  setShowConfirmSemester(false);
                }}
              >
                Yes, reset timetable
              </Button>
              <Button 
                className="w-full justify-start h-12" 
                variant="outline"
                onClick={() => setShowConfirmSemester(false)}
              >
                No, cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-purple-500/30 animate-in fade-in zoom-in duration-200 max-h-[95vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-4 shrink-0">
              <CardTitle>Edit Profile</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowProfileModal(false)}>
                <XCircle className="w-5 h-5 text-gray-400" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 overflow-y-auto flex-1">
              {/* Not fully implemented yet - just basic user info rendering for now */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-purple-300">Name</label>
                  <input 
                    className="w-full bg-white/5 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-gray-200"
                    defaultValue={state.user?.name}
                    onChange={(e) => login({ ...state.user!, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-purple-300">Field</label>
                    <input 
                      className="w-full bg-white/5 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-gray-200"
                      defaultValue={state.userField}
                      onChange={(e) => setUserField(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-purple-300">Year</label>
                    <input 
                      className="w-full bg-white/5 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-gray-200"
                      defaultValue={state.userYear}
                      onChange={(e) => setUserYear(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-purple-300">Division</label>
                    <input 
                      className="w-full bg-white/5 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-gray-200"
                      defaultValue={state.userDivision}
                      onChange={(e) => setUserDivision(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-purple-300">Batch</label>
                    <input 
                      className="w-full bg-white/5 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-gray-200"
                      defaultValue={state.userBatch}
                      onChange={(e) => setUserBatch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-purple-300">Semester</label>
                    <input 
                      className="w-full bg-white/5 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-gray-200"
                      defaultValue={state.userSemester}
                      onChange={(e) => setUserSemester(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-purple-300">Goal (%)</label>
                    <input 
                      type="number"
                      className="w-full bg-white/5 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-gray-200"
                      defaultValue={state.attendanceGoal}
                      onChange={(e) => setAttendanceGoal(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleAddTimetable}
                  />
                  <Button 
                    variant="outline" 
                    className="w-full text-purple-400 hover:text-purple-300" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingTimetable}
                  >
                    {isUploadingTimetable ? (
                      <span className="flex items-center"><div className="w-4 h-4 mr-2 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div> Processing...</span>
                    ) : (
                      <span className="flex items-center"><Plus className="w-4 h-4 mr-2" /> Add Another Timetable (Image)</span>
                    )}
                  </Button>
                  <Button variant="danger" className="w-full" onClick={resetData}>
                    <LogOut className="w-4 h-4 mr-2" /> Log Out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Calendar Modal */}
      {showCalendarModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg shadow-2xl border-purple-500/30 animate-in fade-in zoom-in duration-200 max-h-[95vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-4 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setCalendarViewDate(subMonths(calendarViewDate, 1))}>
                &larr;
              </Button>
              <CardTitle className="text-lg sm:text-xl font-bold">{format(calendarViewDate, 'MMMM yyyy')}</CardTitle>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button variant="ghost" size="icon" onClick={() => setCalendarViewDate(addMonths(calendarViewDate, 1))}>
                  &rarr;
                </Button>
                <Button variant="ghost" size="icon" onClick={() => {
                  setShowCalendarModal(false);
                  setSelectedCalendarDate(null);
                }}>
                  <XCircle className="w-5 h-5 text-gray-400" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-7 gap-1 mb-1 sm:mb-2">
                {DAYS.map(day => (
                  <div key={day} className="text-center text-[10px] sm:text-xs text-gray-500 font-semibold truncate" title={day}>
                    <span className="sm:hidden">{day.charAt(0)}</span>
                    <span className="hidden sm:inline">{day}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, i) => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const isCurrentMonth = isSameMonth(date, calendarViewDate);
                  const isToday = isSameDay(date, new Date());
                  const hasNote = !!state.notes?.[dateStr];
                  const isSelected = selectedCalendarDate && isSameDay(date, selectedCalendarDate);
                  
                  return (
                    <div 
                      key={i} 
                      className={cn(
                        "p-1 sm:p-2 min-h-[40px] sm:min-h-[60px] rounded-lg border cursor-pointer select-none transition-colors relative flex flex-col",
                        !isCurrentMonth && "opacity-40",
                        isSelected ? "bg-purple-600/30 border-purple-400" :
                        isToday ? "bg-purple-600/20 border-purple-500" : "bg-white/5 border-white/5 hover:bg-white/[0.04]"
                      )}
                      onClick={() => {
                        setSelectedCalendarDate(date);
                        setEditingNote(state.notes?.[dateStr] || '');
                      }}
                    >
                      <div className={cn("text-xs sm:text-sm font-medium", isToday ? "text-purple-300" : "text-gray-200")}>
                        {format(date, 'd')}
                      </div>
                      {hasNote && (
                        <div className="mt-auto self-start bg-purple-500 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedCalendarDate && (
                <div className="pt-2 sm:pt-4 border-t border-white/5 mt-2 sm:mt-4 animate-in slide-in-from-bottom-2 shrink-0">
                  <div className="flex justify-between items-center mb-1 sm:mb-2">
                    <label className="text-xs sm:text-sm font-medium text-purple-300">
                      Note for {format(selectedCalendarDate, 'MMMM d, yyyy')}
                    </label>
                  </div>
                  <textarea
                    className="w-full bg-white/5 border border-purple-500/30 rounded-lg p-2 sm:p-3 text-xs sm:text-sm text-gray-200 focus:outline-none focus:border-purple-500 resize-none min-h-[60px] sm:min-h-[80px]"
                    placeholder="Add a note..."
                    value={editingNote}
                    onChange={(e) => setEditingNote(e.target.value)}
                  />
                  <div className="flex justify-end gap-2 mt-2 pb-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCalendarDate(null)}>
                      Cancel
                    </Button>
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => {
                        setNote(format(selectedCalendarDate, 'yyyy-MM-dd'), editingNote);
                        setSelectedCalendarDate(null);
                      }}
                    >
                      Save Note
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {selectedSlotInfo && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm shadow-2xl border-purple-500/30 animate-in fade-in zoom-in duration-200">
            {isEditingSlot && editSlotData ? (
              <>
                <CardHeader>
                  <CardTitle>Edit Class</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-200">Subject</label>
                    <select 
                      className="flex h-10 w-full rounded-lg border border-purple-500/20 bg-white/5 px-3 py-2 text-sm text-gray-200 focus:outline-none"
                      value={editSlotData.subjectId}
                      onChange={(e) => setEditSlotData({ ...editSlotData, subjectId: e.target.value })}
                    >
                      {state.subjects.filter(subject => filteredTimetable.some(t => t.subjectId === subject.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-200">Start Time</label>
                      <TimePicker12 
                        value={editSlotData.start} 
                        onChange={(val) => setEditSlotData({ ...editSlotData, start: val })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-200">End Time</label>
                      <TimePicker12 
                        value={editSlotData.end} 
                        onChange={(val) => setEditSlotData({ ...editSlotData, end: val })} 
                      />
                    </div>
                  </div>
                  <div className="pt-4 space-y-2">
                    <Button className="w-full justify-start h-10" onClick={handleSaveForToday}>
                      <Save className="w-4 h-4 mr-2" />
                      Save for Today
                    </Button>
                    <Button variant="outline" className="w-full justify-start h-10" onClick={handleSavePermanently}>
                      <Save className="w-4 h-4 mr-2 text-purple-400" />
                      Save Permanently
                    </Button>
                    <div className="flex justify-end pt-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingSlot(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>{getSubjectName(selectedSlotInfo.slot.subjectId)}</CardTitle>
                  <p className="text-sm text-gray-400">{format(parseISO(selectedSlotInfo.dateStr), 'EEEE, MMM do')} • {formatTime12(selectedSlotInfo.slot.start)} - {formatTime12(selectedSlotInfo.slot.end)}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    className="w-full justify-start h-12" 
                    onClick={() => handleMark('attended')}
                    variant={getSlotStatus(selectedSlotInfo.dateStr, selectedSlotInfo.slot.id) === 'attended' ? 'success' : 'outline'}
                  >
                    <CheckCircle2 className="w-5 h-5 mr-3" />
                    Mark as Attended
                  </Button>
                  <Button 
                    className="w-full justify-start h-12" 
                    variant={getSlotStatus(selectedSlotInfo.dateStr, selectedSlotInfo.slot.id) === 'skipped' ? 'danger' : 'outline'}
                    onClick={() => handleMark('skipped')}
                  >
                    <XCircle className="w-5 h-5 mr-3" />
                    Mark as Skipped
                  </Button>
                  <Button 
                    className="w-full justify-start h-12" 
                    variant={getSlotStatus(selectedSlotInfo.dateStr, selectedSlotInfo.slot.id) === 'cancelled' ? 'warning' : 'outline'}
                    onClick={() => handleMark('cancelled')}
                  >
                    <MinusCircle className="w-5 h-5 mr-3" />
                    Lecture Cancelled
                  </Button>
                  <Button 
                    className="w-full justify-start h-12" 
                    variant="outline"
                    onClick={() => setIsEditingSlot(true)}
                  >
                    <Edit2 className="w-5 h-5 mr-3 text-purple-400" />
                    Edit Class Details
                  </Button>
                  <div className="pt-2 flex justify-end">
                    <Button variant="ghost" onClick={() => setSelectedSlotInfo(null)}>Cancel</Button>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      )}

    </div>
  );
}
