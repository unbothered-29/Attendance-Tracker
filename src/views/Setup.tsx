import React, { useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { UploadCloud, FileText, Loader2, Plus, Trash2, ArrowLeft, Wand2 } from 'lucide-react';
import { generateId } from '../lib/utils';
import { Subject, TimeSlot } from '../types';
import { TimePicker12 } from '../components/TimePicker12';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function Setup() {
  const { state, setSubjects, setTimetable, setAttendanceGoal, setUserBatch, setUserYear, setUserDivision, setUserField, setUserSemester, completeSetup } = useAppContext();
  
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Profile, 2: Upload/Generate, 3: Review/Edit
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  
  const [goal, setGoal] = useState(state.attendanceGoal ? String(state.attendanceGoal) : '75');
  const [rawSubjects, setRawSubjects] = useState<{ id: string; name: string; teacher?: string }[]>([]);
  const [rawSlots, setRawSlots] = useState<{ id: string; subjectId: string; start: string; end: string; dayOfWeek: number; batch?: string; year?: string; division?: string; }[]>([]);
  
  const [selectedBatch, setSelectedBatch] = useState<string>(state.userBatch || '');
  const [selectedYear, setSelectedYear] = useState<string>(state.userYear || 'FE');
  const [selectedDivision, setSelectedDivision] = useState<string>(state.userDivision || '');
  const [selectedField, setSelectedField] = useState<string>(state.userField || 'Engineering');
  const [selectedSemester, setSelectedSemester] = useState<string>(state.userSemester || '1');
  const [activeDayTab, setActiveDayTab] = useState<number>(1);
  const [editTab, setEditTab] = useState<'subjects' | 'schedule'>('subjects');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError('');
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const res = await fetch("/api/parse-timetable", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              imageBase64: base64,
              profile: {
                year: selectedYear,
                division: selectedDivision,
                batch: selectedBatch,
                field: selectedField,
                semester: selectedSemester
              }
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to parse timetable");

          const subjects = (data.subjects || []).map((s: any) => ({ ...s, id: s.id || generateId() }));
          const slots = (data.slots || []).map((s: any) => ({ ...s, id: s.id || generateId() }));

          setRawSubjects(subjects);
          setRawSlots(slots);
          setStep(3);
        } catch (err: any) {
          console.error(err);
          setError(err.message || 'Failed to read image. Please try again or skip to manual entry.');
        } finally {
          setIsProcessing(false);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file');
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setError('Failed to process. Please try again or skip to manual entry.');
      setIsProcessing(false);
    }
  };

  const handleAutoGenerate = async () => {
    setIsProcessing(true);
    setError('');
    try {
      const res = await fetch("/api/generate-timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          profile: {
            year: selectedYear,
            division: selectedDivision,
            batch: selectedBatch,
            field: selectedField,
            semester: selectedSemester
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate timetable");

      const subjects = (data.subjects || []).map((s: any) => ({ ...s, id: s.id || generateId() }));
      const slots = (data.slots || []).map((s: any) => ({ ...s, id: s.id || generateId() }));

      setRawSubjects(subjects);
      setRawSlots(slots);
      setStep(3);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate. Please try again or use manual entry.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = () => {
    setStep(3);
  };

  const addSubject = () => {
    setRawSubjects([...rawSubjects, { id: generateId(), name: 'New Subject' }]);
  };

  const updateSubject = (id: string, field: 'name' | 'teacher', value: string) => {
    setRawSubjects(rawSubjects.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeSubject = (id: string) => {
    setRawSubjects(rawSubjects.filter(s => s.id !== id));
    setRawSlots(rawSlots.filter(s => s.subjectId !== id));
  };

  const addSlot = () => {
    if (rawSubjects.length === 0) return;
    setRawSlots([...rawSlots, { id: generateId(), subjectId: rawSubjects[0].id, start: '09:00', end: '10:00', dayOfWeek: activeDayTab }]);
  };

  const updateSlot = (id: string, field: string, value: any) => {
    setRawSlots(rawSlots.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeSlot = (id: string) => {
    setRawSlots(rawSlots.filter(s => s.id !== id));
  };

  const handleSave = () => {
    if (rawSubjects.length === 0 || rawSlots.length === 0) {
      setError("Please add at least one subject and one class slot.");
      return;
    }

    setSubjects(rawSubjects);
    setTimetable(rawSlots);
    setAttendanceGoal(Number(goal) || 75);
    
    setUserBatch(selectedBatch);
    setUserYear(selectedYear);
    setUserDivision(selectedDivision);
    setUserField(selectedField);
    setUserSemester(selectedSemester);

    completeSetup();
  };

  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent blur-3xl -z-10" />
        <Card className="w-full max-w-lg shadow-2xl">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-4xl font-display font-bold tracking-tight bg-gradient-to-br from-white to-purple-300 bg-clip-text text-transparent">Your Profile</CardTitle>
            <p className="text-base text-gray-400 mt-3">
              Tell us a bit about your studies so we can tailor your timetable.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Field of Study</Label>
                  <select 
                    className="flex h-10 w-full rounded-lg border border-purple-500/20 bg-white/5 px-3 py-2 text-sm text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
                    value={selectedField}
                    onChange={(e) => setSelectedField(e.target.value)}
                    required
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="MBBS">MBBS / Medical</option>
                    <option value="Commerce">Commerce / BCom</option>
                    <option value="Arts">Arts / BA</option>
                    <option value="Science">Science / BSc</option>
                    <option value="Law">Law / LLB</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Current Semester</Label>
                  <select 
                    className="flex h-10 w-full rounded-lg border border-purple-500/20 bg-white/5 px-3 py-2 text-sm text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    required
                  >
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                    <option value="3">Semester 3</option>
                    <option value="4">Semester 4</option>
                    <option value="5">Semester 5</option>
                    <option value="6">Semester 6</option>
                    <option value="7">Semester 7</option>
                    <option value="8">Semester 8</option>
                    <option value="9">Semester 9</option>
                    <option value="10">Semester 10</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div className="space-y-2">
                  <Label>Year of Study</Label>
                  <select 
                    className="flex h-10 w-full rounded-lg border border-purple-500/20 bg-white/5 px-3 py-2 text-sm text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    <option value="FE">First Year (FE)</option>
                    <option value="SE">Second Year (SE)</option>
                    <option value="TE">Third Year (TE)</option>
                    <option value="BE">Fourth Year (BE)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Division (Optional)</Label>
                  <Input 
                    placeholder="e.g. A"
                    value={selectedDivision}
                    onChange={(e) => setSelectedDivision(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div className="space-y-2">
                  <Label>Batch (Optional)</Label>
                  <Input 
                    placeholder="e.g. B1"
                    value={selectedBatch}
                    onChange={(e) => setSelectedBatch(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Attendance Goal (%)</Label>
                  <Input 
                    type="number"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    min="1" max="100"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full h-12">
                  Next Step
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent blur-3xl -z-10" />
        <Card className="w-full max-w-lg shadow-2xl">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-4xl font-display font-bold tracking-tight bg-gradient-to-br from-white to-purple-300 bg-clip-text text-transparent">Setup Timetable</CardTitle>
            <p className="text-base text-gray-400 mt-3">
              Upload a clear photo of your timetable, generate one automatically, or enter it manually.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 text-sm text-purple-200">
              <strong>Tip:</strong> Ensure the photo is well-lit, flat, and has no glare for the best text extraction.
            </div>

            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <div className="grid grid-cols-1 gap-4">
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                className="h-20" 
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <UploadCloud className="w-6 h-6 mr-3" />}
                {isProcessing ? 'Processing Image...' : 'Upload Timetable Photo'}
              </Button>
              <Button 
                onClick={handleAutoGenerate}
                variant="outline"
                className="h-20 border-purple-500/30 hover:bg-purple-500/10"
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <Wand2 className="w-6 h-6 mr-3 text-purple-400" />}
                {isProcessing ? 'Generating...' : 'Auto-Generate Timetable'}
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleSkip} 
                className="h-12"
                disabled={isProcessing}
              >
                <FileText className="w-5 h-5 mr-2" />
                Skip & Enter Manually
              </Button>
            </div>
            <div className="text-center pt-2">
              <Button variant="link" onClick={() => setStep(1)} disabled={isProcessing} className="text-gray-500">
                &larr; Back to Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setStep(2)} className="text-gray-400 hover:text-white shrink-0 mt-1 sm:mt-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Review & Edit</h1>
          <p className="text-gray-400 mt-1">Review your timetable and fix any mistakes before continuing.</p>
        </div>
      </div>

      {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg border border-red-500/20 text-sm">{error}</div>}

      <div className="flex bg-white/5 p-1 rounded-xl w-full max-w-sm mx-auto mb-6">
        <button
          onClick={() => setEditTab('subjects')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${editTab === 'subjects' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
        >
          Subjects ({rawSubjects.length})
        </button>
        <button
          onClick={() => setEditTab('schedule')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${editTab === 'schedule' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
        >
          Schedule ({rawSlots.length})
        </button>
      </div>

      <div className="w-full">
        {editTab === 'subjects' ? (
          <Card className="max-w-3xl mx-auto h-fit">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Subjects</CardTitle>
                <Button size="sm" variant="outline" onClick={addSubject}>
                  <Plus className="w-4 h-4 mr-1"/> Add Subject
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {rawSubjects.length === 0 && <p className="text-sm text-gray-500">No subjects added yet.</p>}
              {rawSubjects.map(subject => (
                <div key={subject.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="flex-1 space-y-3 sm:space-y-0 sm:flex sm:gap-3 w-full min-w-0">
                    <Input 
                      value={subject.name} 
                      onChange={(e) => updateSubject(subject.id, 'name', e.target.value)}
                      placeholder="Subject Name"
                      className="bg-black/20 border-purple-500/20 focus-visible:ring-purple-500/50 sm:flex-1 min-w-0"
                    />
                    <Input 
                      value={subject.teacher || ''} 
                      onChange={(e) => updateSubject(subject.id, 'teacher', e.target.value)}
                      placeholder="Teacher Name (optional)"
                      className="h-10 text-sm bg-black/20 border-purple-500/10 focus-visible:ring-purple-500/50 sm:flex-1 min-w-0"
                    />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeSubject(subject.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10 self-end sm:self-auto shrink-0 hidden sm:flex">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeSubject(subject.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10 self-end sm:hidden w-full justify-center">
                    <Trash2 className="w-4 h-4 mr-2" /> Remove
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Weekly Schedule</CardTitle>
                <Button size="sm" variant="ghost" onClick={addSlot} disabled={rawSubjects.length === 0}>
                  <Plus className="w-4 h-4 mr-1"/> Add Class
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
               {rawSubjects.length === 0 ? (
                 <div className="text-center py-12">
                   <p className="text-sm text-gray-500">Add subjects first to create schedule slots.</p>
                   <Button size="sm" variant="outline" className="mt-4" onClick={() => setEditTab('subjects')}>
                     Go to Subjects
                   </Button>
                 </div>
               ) : (
                 <>
                   <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
                     {DAYS.map((day, i) => {
                       if (i === 0 && !rawSlots.some(s => s.dayOfWeek === 0)) return null;
                       if (i === 6 && !rawSlots.some(s => s.dayOfWeek === 6)) return null;
                       return (
                         <button
                           key={i}
                           onClick={() => setActiveDayTab(i)}
                           className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${activeDayTab === i ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                         >
                           {day}
                         </button>
                       );
                     })}
                   </div>

                   {rawSlots.filter(s => s.dayOfWeek === activeDayTab).length === 0 ? (
                      <div className="text-center py-12 text-gray-500 bg-white/[0.01] rounded-xl border border-white/[0.05]">
                        <p>No classes scheduled for {DAYS[activeDayTab]}.</p>
                        <Button size="sm" variant="outline" className="mt-4" onClick={addSlot}>
                          Add a Class
                        </Button>
                      </div>
                   ) : (
                     <div className="space-y-3">
                       {rawSlots.filter(s => s.dayOfWeek === activeDayTab).sort((a, b) => a.start.localeCompare(b.start)).map(slot => (
                         <div key={slot.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white/[0.02] p-3 rounded-xl border border-white/10 w-full">
                           <div className="flex gap-2 w-full sm:w-auto sm:flex-1 min-w-0">
                             <select 
                               className="h-10 w-full rounded-lg border border-purple-500/20 bg-black/20 px-3 py-2 text-sm text-gray-200 focus:outline-none min-w-0"
                               value={slot.subjectId}
                               onChange={(e) => updateSlot(slot.id, 'subjectId', e.target.value)}
                             >
                               {rawSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                             </select>
                             <Button size="icon" variant="ghost" onClick={() => removeSlot(slot.id)} className="sm:hidden text-red-400 hover:text-red-300 hover:bg-red-400/10 shrink-0">
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           </div>
                           <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-between sm:justify-start">
                             <div className="flex items-center gap-1 sm:gap-2">
                               <TimePicker12 
                                 value={slot.start} 
                                 onChange={(val) => updateSlot(slot.id, 'start', val)} 
                               />
                               <span className="text-gray-600 font-medium px-1">to</span>
                               <TimePicker12 
                                 value={slot.end} 
                                 onChange={(val) => updateSlot(slot.id, 'end', val)} 
                               />
                             </div>
                             <Button size="icon" variant="ghost" onClick={() => removeSlot(slot.id)} className="hidden sm:flex text-red-400 hover:text-red-300 hover:bg-red-400/10 shrink-0 sm:ml-2">
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                 </>
               )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button size="lg" onClick={handleSave} className="w-full md:w-auto px-8">
          Complete Setup
        </Button>
      </div>
    </div>
  );
}
