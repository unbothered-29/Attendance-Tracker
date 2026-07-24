import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { UploadCloud, FileText, Loader2, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { generateId } from '../lib/utils';
import { Subject, TimeSlot } from '../types';
import { TimePicker12 } from '../components/TimePicker12';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function Setup() {
  const { state, setSubjects, setTimetable, setAttendanceGoal, setUserBatch, setUserYear, setUserDivision, setUserField, setUserSemester, completeSetup } = useAppContext();
  
  const [step, setStep] = useState<1 | 2>(1); // 1: Upload, 2: Review/Edit
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  
  const [goal, setGoal] = useState(state.attendanceGoal ? String(state.attendanceGoal) : '75');
  const [rawSubjects, setRawSubjects] = useState<{ id: string; name: string; teacher?: string }[]>([]);
  const [rawSlots, setRawSlots] = useState<{ id: string; subjectId: string; start: string; end: string; dayOfWeek: number; batch?: string; year?: string; division?: string; }[]>([]);
  const [availableBatches, setAvailableBatches] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableDivisions, setAvailableDivisions] = useState<string[]>([]);
  
  const [selectedBatch, setSelectedBatch] = useState<string>(state.userBatch || '');
  const [selectedYear, setSelectedYear] = useState<string>(state.userYear || 'FE');
  const [selectedDivision, setSelectedDivision] = useState<string>(state.userDivision || '');
  const [selectedField, setSelectedField] = useState<string>(state.userField || 'Engineering');
  const [selectedSemester, setSelectedSemester] = useState<string>(state.userSemester || '1');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            body: JSON.stringify({ imageBase64: base64 })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to parse timetable");

          // Ensure IDs are valid since they come from the AI
          const subjects = (data.subjects || []).map((s: any) => ({ ...s, id: s.id || generateId() }));
          const slots = (data.slots || []).map((s: any) => ({ ...s, id: s.id || generateId() }));

          setRawSubjects(subjects);
          setRawSlots(slots);
          if (data.batches && data.batches.length > 0) {
            setAvailableBatches(data.batches);
            setSelectedBatch(data.batches[0]);
          }
          if (data.years && data.years.length > 0) {
            setAvailableYears(data.years);
            if (data.years.includes('FE')) setSelectedYear('FE');
            else setSelectedYear(data.years[0]);
          }
          if (data.divisions && data.divisions.length > 0) {
            setAvailableDivisions(data.divisions);
            setSelectedDivision(data.divisions[0]);
          }
          setStep(2);
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

  const handleSkip = () => {
    setStep(2);
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
    setRawSlots([...rawSlots, { id: generateId(), subjectId: rawSubjects[0].id, start: '09:00', end: '10:00', dayOfWeek: 1 }]);
  };

  const updateSlot = (id: string, field: string, value: string | number) => {
    setRawSlots(rawSlots.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeSlot = (id: string) => {
    setRawSlots(rawSlots.filter(s => s.id !== id));
  };

  const handleSave = () => {
    if (rawSubjects.length === 0 || rawSlots.length === 0) {
      setError('Please add at least one subject and one timetable slot.');
      return;
    }
    
    setSubjects(rawSubjects);
    setTimetable(rawSlots);
    setAttendanceGoal(Number(goal) || 75);
    
    if (selectedBatch) {
      setUserBatch(selectedBatch);
    }
    if (selectedYear) {
      setUserYear(selectedYear);
    }
    if (selectedDivision) {
      setUserDivision(selectedDivision);
    }
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
            <CardTitle className="text-4xl font-display font-bold tracking-tight bg-gradient-to-br from-white to-purple-300 bg-clip-text text-transparent">Setup Timetable</CardTitle>
            <p className="text-base text-gray-400 mt-3">
              Upload a clear photo of your timetable, or enter it manually.
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

            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                className="h-24 flex-col gap-2" 
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
                {isProcessing ? 'Processing...' : 'Upload Photo'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSkip} 
                className="h-24 flex-col gap-2"
                disabled={isProcessing}
              >
                <FileText className="w-6 h-6" />
                Enter Manually
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
        <Button variant="ghost" size="icon" onClick={() => setStep(1)} className="text-gray-400 hover:text-white shrink-0 mt-1 sm:mt-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Review & Edit</h1>
          <p className="text-gray-400 mt-1">Review the extracted data and fix any mistakes before continuing.</p>
        </div>
      </div>

      {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg border border-red-500/20 text-sm">{error}</div>}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Subjects</CardTitle>
              <Button size="sm" variant="ghost" onClick={addSubject}><Plus className="w-4 h-4 mr-1"/> Add</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {rawSubjects.length === 0 && <p className="text-sm text-gray-500">No subjects added.</p>}
            {rawSubjects.map(sub => (
              <div key={sub.id} className="flex flex-col md:flex-row gap-2 bg-white/5 p-2 rounded-lg border border-purple-500/10">
                <Input 
                  value={sub.name} 
                  onChange={(e) => updateSubject(sub.id, 'name', e.target.value)} 
                  placeholder="Subject name"
                  className="flex-1"
                />
                <Input 
                  value={sub.teacher || ''} 
                  onChange={(e) => updateSubject(sub.id, 'teacher', e.target.value)} 
                  placeholder="Teacher (optional)"
                  className="flex-1"
                />
                <Button size="icon" variant="ghost" onClick={() => removeSubject(sub.id)} className="shrink-0 text-red-400 hover:text-red-300 hover:bg-red-400/10 md:self-auto self-end mt-2 md:mt-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Goal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Target Percentage (%)</Label>
              <Input 
                type="number" 
                value={goal} 
                onChange={(e) => setGoal(e.target.value)} 
                min="1" max="100" 
              />
              <p className="text-xs text-gray-500">This applies to all subjects to help you stay on track.</p>
            </div>
            
            {availableBatches.length > 0 && (
              <div className="space-y-2 border-t border-white/5 pt-4">
                <Label>Your Batch</Label>
                <select 
                  className="flex h-10 w-full rounded-lg border border-purple-500/20 bg-white/5 px-3 py-2 text-sm text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                >
                  <option value="">All Batches</option>
                  {availableBatches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <p className="text-xs text-gray-500">We found batch-specific slots (e.g. practicals). Select your batch to filter them.</p>
              </div>
            )}

            <div className="space-y-2 border-t border-white/5 pt-4">
              <Label>Field of Study</Label>
              <select 
                className="flex h-10 w-full rounded-lg border border-purple-500/20 bg-white/5 px-3 py-2 text-sm text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
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

            <div className="space-y-2 border-t border-white/5 pt-4">
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
                {availableYears.filter(y => !['FE', 'SE', 'TE', 'BE'].includes(y)).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-2 border-t border-white/5 pt-4">
              <Label>Division</Label>
              <select 
                className="flex h-10 w-full rounded-lg border border-purple-500/20 bg-white/5 px-3 py-2 text-sm text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
              >
                <option value="">No Division / All Divisions</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                {availableDivisions.filter(d => !['A', 'B', 'C', 'D'].includes(d)).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 border-t border-white/5 pt-4">
              <Label>Current Semester</Label>
              <select 
                className="flex h-10 w-full rounded-lg border border-purple-500/20 bg-white/5 px-3 py-2 text-sm text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
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
          </CardContent>
        </Card>
      </div>

      <Card>
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
             <p className="text-sm text-gray-500">Add subjects first to create schedule slots.</p>
           ) : rawSlots.length === 0 ? (
             <p className="text-sm text-gray-500">No classes scheduled. Add them here.</p>
           ) : (
             <div className="space-y-3">
               {rawSlots.map(slot => (
                 <div key={slot.id} className="flex flex-wrap md:flex-nowrap gap-2 items-center bg-white/5 p-2 rounded-lg border border-purple-500/10">
                   <select 
                     className="h-10 rounded-lg border border-purple-500/20 bg-transparent px-3 py-2 text-sm text-gray-200 focus:outline-none flex-1 min-w-[120px]"
                     value={slot.subjectId}
                     onChange={(e) => updateSlot(slot.id, 'subjectId', e.target.value)}
                   >
                     {rawSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                   <select 
                     className="h-10 rounded-lg border border-purple-500/20 bg-transparent px-3 py-2 text-sm text-gray-200 focus:outline-none w-[140px]"
                     value={slot.dayOfWeek}
                     onChange={(e) => updateSlot(slot.id, 'dayOfWeek', Number(e.target.value))}
                   >
                     {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                   </select>
                   <TimePicker12 
                     value={slot.start} 
                     onChange={(val) => updateSlot(slot.id, 'start', val)} 
                   />
                   <span className="text-gray-500">to</span>
                   <TimePicker12 
                     value={slot.end} 
                     onChange={(val) => updateSlot(slot.id, 'end', val)} 
                   />
                   <Button size="icon" variant="ghost" onClick={() => removeSlot(slot.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                     <Trash2 className="w-4 h-4" />
                   </Button>
                 </div>
               ))}
             </div>
           )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSave}>
          Generate Timetable
        </Button>
      </div>
    </div>
  );
}
