import React, { useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { UploadCloud, FileText, Loader2, Plus, Trash2, ArrowLeft, Wand2, CheckCircle2, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { generateId } from '../lib/utils';
import { TimePicker12 } from '../components/TimePicker12';
import { safeFetchApi } from '../lib/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Fallback preset subjects for popular fields if AI fails or returns empty
const DEFAULT_FIELD_SUBJECTS: Record<string, string[]> = {
  Engineering: ['Data Structures & Algorithms', 'Engineering Mathematics', 'Operating Systems', 'Database Management', 'Computer Networks'],
  MBBS: ['Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Pharmacology'],
  Commerce: ['Financial Accounting', 'Business Economics', 'Corporate Law', 'Direct Taxation', 'Cost Accounting'],
  Science: ['Applied Physics', 'Organic Chemistry', 'Calculus & Linear Algebra', 'Statistics', 'Computer Science'],
  Arts: ['World Literature', 'Political Theory', 'Macroeconomics', 'Modern History', 'Sociology'],
  Law: ['Constitutional Law', 'Law of Contracts', 'Criminal Law', 'Family Law', 'Jurisprudence'],
  Other: ['Subject 1', 'Subject 2', 'Subject 3', 'Subject 4']
};

function generatePresetSchedule(field: string, subjectsList: { id: string; name: string }[]) {
  const slots: { id: string; subjectId: string; start: string; end: string; dayOfWeek: number }[] = [];
  const times = [
    { start: '09:00', end: '10:00' },
    { start: '10:15', end: '11:15' },
    { start: '11:30', end: '12:30' },
    { start: '13:30', end: '14:30' },
  ];

  // Monday to Friday (1 to 5)
  for (let day = 1; day <= 5; day++) {
    for (let t = 0; t < times.length; t++) {
      const subjectIndex = (day + t) % subjectsList.length;
      slots.push({
        id: generateId(),
        subjectId: subjectsList[subjectIndex].id,
        start: times[t].start,
        end: times[t].end,
        dayOfWeek: day
      });
    }
  }
  return slots;
}

export function Setup() {
  const { state, setSubjects, setTimetable, setAttendanceGoal, setUserBatch, setUserYear, setUserDivision, setUserField, setUserSemester, completeSetup } = useAppContext();
  
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Profile, 2: Upload/Generate, 3: Review/Edit
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('Processing...');
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

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Use 2048px maximum dimension to keep small timetable grid text razor sharp
        const MAX_DIM = 2048;
        let width = img.width;
        let height = img.height;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(img.src);
          return;
        }
        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.90));
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingStatus('Analyzing timetable photo with Gemini 3.6 Flash...');
    setError('');
    
    try {
      const compressedBase64 = await compressImage(file);

      setProcessingStatus('Extracting subjects and class schedule from your photo...');
      const data = await safeFetchApi("/api/parse-timetable", { 
        imageBase64: compressedBase64,
        profile: {
          year: selectedYear,
          division: selectedDivision,
          batch: selectedBatch,
          field: selectedField,
          semester: selectedSemester
        }
      });

      let subjects = (data.subjects || []).map((s: any) => ({ ...s, id: s.id || generateId() }));
      let slots = (data.slots || []).map((s: any) => ({ ...s, id: s.id || generateId() }));

      if (subjects.length === 0) {
        throw new Error('No subjects could be detected in the uploaded photo. Please ensure the timetable image is clear and well-lit, or use Auto-Generate.');
      }

      setRawSubjects(subjects);
      setRawSlots(slots);
      setStep(3);
    } catch (err: any) {
      console.error("Upload/OCR error:", err);
      setError(
        err.message || 'Failed to extract timetable from photo. Please try uploading a clearer image or click "Auto-Generate with AI".'
      );
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAutoGenerate = async () => {
    setIsProcessing(true);
    setProcessingStatus('Generating custom timetable with AI...');
    setError('');
    try {
      const data = await safeFetchApi("/api/generate-timetable", { 
        profile: {
          year: selectedYear,
          division: selectedDivision,
          batch: selectedBatch,
          field: selectedField,
          semester: selectedSemester
        }
      });

      let subjects = (data.subjects || []).map((s: any) => ({ ...s, id: s.id || generateId() }));
      let slots = (data.slots || []).map((s: any) => ({ ...s, id: s.id || generateId() }));

      if (subjects.length === 0) {
        const fieldNames = DEFAULT_FIELD_SUBJECTS[selectedField] || DEFAULT_FIELD_SUBJECTS['Engineering'];
        subjects = fieldNames.map(name => ({ id: generateId(), name }));
        slots = generatePresetSchedule(selectedField, subjects);
      }

      setRawSubjects(subjects);
      setRawSlots(slots);
      setStep(3);
    } catch (err: any) {
      console.error(err);
      // Fallback local preset generation if API key is not ready
      const fieldNames = DEFAULT_FIELD_SUBJECTS[selectedField] || DEFAULT_FIELD_SUBJECTS['Engineering'];
      const subjects = fieldNames.map(name => ({ id: generateId(), name }));
      const slots = generatePresetSchedule(selectedField, subjects);
      setRawSubjects(subjects);
      setRawSlots(slots);
      setError(`AI note: ${err.message || 'Populated default schedule for review.'}`);
      setStep(3);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePopulatePreset = () => {
    const fieldNames = DEFAULT_FIELD_SUBJECTS[selectedField] || DEFAULT_FIELD_SUBJECTS['Engineering'];
    const subjects = fieldNames.map(name => ({ id: generateId(), name }));
    const slots = generatePresetSchedule(selectedField, subjects);
    setRawSubjects(subjects);
    setRawSlots(slots);
    setError('');
  };

  const handleSkip = () => {
    if (rawSubjects.length === 0) {
      handlePopulatePreset();
    }
    setStep(3);
  };

  const addSubject = () => {
    const newSubId = generateId();
    const newSubject = { id: newSubId, name: `Subject ${rawSubjects.length + 1}` };
    setRawSubjects([...rawSubjects, newSubject]);
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
    const defaultStart = '09:00';
    const defaultEnd = '10:00';
    setRawSlots([...rawSlots, { id: generateId(), subjectId: rawSubjects[0].id, start: defaultStart, end: defaultEnd, dayOfWeek: activeDayTab }]);
  };

  const updateSlot = (id: string, field: string, value: any) => {
    setRawSlots(rawSlots.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeSlot = (id: string) => {
    setRawSlots(rawSlots.filter(s => s.id !== id));
  };

  const handleSave = () => {
    if (rawSubjects.length === 0) {
      setError("Please add at least one subject before generating the timetable.");
      setEditTab('subjects');
      return;
    }

    if (rawSlots.length === 0) {
      setError("Please add at least one class time slot to your schedule.");
      setEditTab('schedule');
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
                <Button type="submit" className="w-full h-12 text-base font-medium shadow-lg shadow-purple-600/30">
                  Next Step &rarr;
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
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-4xl font-display font-bold tracking-tight bg-gradient-to-br from-white to-purple-300 bg-clip-text text-transparent">Setup Timetable</CardTitle>
            <p className="text-base text-gray-400 mt-2">
              Upload a photo of your timetable or let AI generate a schedule for your review.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 text-sm text-purple-200 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <strong>How it works:</strong> Upload your timetable image or click Auto-Generate. You will get to <strong>review and edit</strong> all extracted subjects and class hours before confirming!
              </div>
            </div>

            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />

            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-lg text-sm">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3.5">
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                className="h-16 text-base font-semibold shadow-lg shadow-purple-600/30" 
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <UploadCloud className="w-6 h-6 mr-3" />}
                {isProcessing ? processingStatus : 'Upload Timetable Photo'}
              </Button>
              
              <Button 
                onClick={handleAutoGenerate}
                variant="outline"
                className="h-14 border-purple-500/30 hover:bg-purple-500/10 text-white font-medium"
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Wand2 className="w-5 h-5 mr-2 text-purple-400" />}
                Auto-Generate with AI
              </Button>

              <Button 
                variant="ghost" 
                onClick={handleSkip} 
                className="h-12 text-gray-400 hover:text-white"
                disabled={isProcessing}
              >
                <FileText className="w-4 h-4 mr-2" />
                Skip & Enter Manually
              </Button>
            </div>
            
            <div className="text-center pt-2">
              <Button variant="link" onClick={() => setStep(1)} disabled={isProcessing} className="text-gray-400 hover:text-white">
                &larr; Back to Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div className="flex items-start sm:items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setStep(2)} className="text-gray-400 hover:text-white shrink-0 mt-1 sm:mt-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Review & Confirm Timetable</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Review your subjects and schedule. Customize anything before creating your timetable.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAutoGenerate} 
            disabled={isProcessing}
            className="text-xs border-purple-500/30 text-purple-200 hover:bg-purple-500/10"
          >
            {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Wand2 className="w-3.5 h-3.5 mr-1.5 text-purple-400" />}
            Auto-Fill with AI
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-purple-500/10 border border-purple-500/30 text-purple-200 p-3.5 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex bg-white/5 p-1 rounded-xl w-full max-w-sm mx-auto">
        <button
          onClick={() => setEditTab('subjects')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${editTab === 'subjects' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
        >
          <span>Subjects</span>
          <span className="bg-black/30 px-2 py-0.5 rounded-full text-xs font-bold">{rawSubjects.length}</span>
        </button>
        <button
          onClick={() => setEditTab('schedule')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${editTab === 'schedule' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
        >
          <span>Schedule</span>
          <span className="bg-black/30 px-2 py-0.5 rounded-full text-xs font-bold">{rawSlots.length}</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="w-full">
        {editTab === 'subjects' ? (
          <Card className="max-w-3xl mx-auto border-white/10 shadow-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Subjects List</CardTitle>
                  <p className="text-xs text-gray-400 mt-1">Add, edit, or remove subjects below.</p>
                </div>
                <Button size="sm" onClick={addSubject} className="bg-purple-600 hover:bg-purple-700 text-white">
                  <Plus className="w-4 h-4 mr-1"/> Add Subject
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {rawSubjects.length === 0 ? (
                <div className="text-center py-10 px-4 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl space-y-4">
                  <p className="text-gray-400 text-sm">No subjects in your list yet.</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button size="sm" onClick={handlePopulatePreset} variant="outline" className="border-purple-500/40 text-purple-300">
                      <Sparkles className="w-4 h-4 mr-1.5 text-purple-400" />
                      Add Standard {selectedField} Subjects
                    </Button>
                    <Button size="sm" onClick={addSubject} className="bg-purple-600">
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add Subject Manually
                    </Button>
                  </div>
                </div>
              ) : (
                rawSubjects.map((subject, index) => (
                  <div key={subject.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white/5 p-3.5 rounded-xl border border-white/10 hover:border-purple-500/30 transition-colors">
                    <span className="text-xs font-bold text-gray-500 w-6 text-center hidden sm:inline-block">
                      {index + 1}
                    </span>
                    <div className="flex-1 space-y-2 sm:space-y-0 sm:flex sm:gap-3 w-full min-w-0">
                      <Input 
                        value={subject.name} 
                        onChange={(e) => updateSubject(subject.id, 'name', e.target.value)}
                        placeholder="Subject Name (e.g. Mathematics)"
                        className="bg-black/30 border-purple-500/20 focus-visible:ring-purple-500/50 sm:flex-[2] min-w-0"
                      />
                      <Input 
                        value={subject.teacher || ''} 
                        onChange={(e) => updateSubject(subject.id, 'teacher', e.target.value)}
                        placeholder="Teacher / Room (optional)"
                        className="h-10 text-sm bg-black/30 border-purple-500/10 focus-visible:ring-purple-500/50 sm:flex-1 min-w-0"
                      />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeSubject(subject.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10 shrink-0 hidden sm:flex">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeSubject(subject.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10 sm:hidden w-full justify-center">
                      <Trash2 className="w-4 h-4 mr-2" /> Remove Subject
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="max-w-4xl mx-auto border-white/10 shadow-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Weekly Schedule</CardTitle>
                  <p className="text-xs text-gray-400 mt-1">Configure class time slots for each day of the week.</p>
                </div>
                <Button size="sm" onClick={addSlot} disabled={rawSubjects.length === 0} className="bg-purple-600 hover:bg-purple-700 text-white">
                  <Plus className="w-4 h-4 mr-1"/> Add Class Slot
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {rawSubjects.length === 0 ? (
                <div className="text-center py-12 px-4 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl space-y-3">
                  <p className="text-sm text-gray-400">Please add at least one subject first before scheduling class slots.</p>
                  <Button size="sm" className="bg-purple-600" onClick={() => setEditTab('subjects')}>
                    Go to Subjects Tab
                  </Button>
                </div>
              ) : (
                <>
                  {/* Day Pills Selector */}
                  <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
                    {DAYS.map((day, i) => {
                      if (i === 0 && !rawSlots.some(s => s.dayOfWeek === 0)) return null; // Hide Sunday if no classes
                      if (i === 6 && !rawSlots.some(s => s.dayOfWeek === 6)) return null; // Hide Saturday if no classes
                      const slotCount = rawSlots.filter(s => s.dayOfWeek === i).length;
                      return (
                        <button
                          key={i}
                          onClick={() => setActiveDayTab(i)}
                          className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors flex items-center gap-2 ${activeDayTab === i ? 'bg-purple-600 text-white shadow-md' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                        >
                          <span>{day}</span>
                          <span className={`px-1.5 py-0.2 text-[11px] rounded-full font-bold ${activeDayTab === i ? 'bg-black/30 text-white' : 'bg-white/10 text-gray-400'}`}>
                            {slotCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Day Classes List */}
                  {rawSlots.filter(s => s.dayOfWeek === activeDayTab).length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-white/[0.01] rounded-2xl border border-dashed border-white/10 space-y-3">
                      <p className="text-sm">No classes scheduled for {DAYS[activeDayTab]}.</p>
                      <Button size="sm" variant="outline" className="border-purple-500/30 text-purple-200 hover:bg-purple-500/10" onClick={addSlot}>
                        <Plus className="w-4 h-4 mr-1.5" /> Add Class to {DAYS[activeDayTab]}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rawSlots.filter(s => s.dayOfWeek === activeDayTab).sort((a, b) => a.start.localeCompare(b.start)).map(slot => (
                        <div key={slot.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white/[0.03] p-3.5 rounded-xl border border-white/10 hover:border-purple-500/30 w-full transition-colors">
                          <div className="flex gap-2 w-full sm:w-auto sm:flex-1 min-w-0">
                            <select 
                              className="h-10 w-full rounded-lg border border-purple-500/20 bg-black/40 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 min-w-0"
                              value={slot.subjectId}
                              onChange={(e) => updateSlot(slot.id, 'subjectId', e.target.value)}
                            >
                              {rawSubjects.map(s => <option key={s.id} value={s.id}>{s.name} {s.teacher ? `(${s.teacher})` : ''}</option>)}
                            </select>
                            <Button size="icon" variant="ghost" onClick={() => removeSlot(slot.id)} className="sm:hidden text-red-400 hover:text-red-300 hover:bg-red-400/10 shrink-0">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-between sm:justify-start">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <TimePicker12 
                                value={slot.start} 
                                onChange={(val) => updateSlot(slot.id, 'start', val)} 
                              />
                              <span className="text-gray-500 text-xs font-medium px-0.5">to</span>
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

      {/* Confirmation & Bottom Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
        <div className="text-xs sm:text-sm text-gray-400 text-center sm:text-left">
          {rawSubjects.length > 0 && rawSlots.length > 0 ? (
            <span className="text-green-400 flex items-center justify-center sm:justify-start gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Ready to build timetable: {rawSubjects.length} subjects & {rawSlots.length} weekly classes
            </span>
          ) : (
            <span className="text-yellow-400 flex items-center justify-center sm:justify-start gap-1.5">
              <AlertCircle className="w-4 h-4" /> Add at least 1 subject and 1 class slot to proceed
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Button 
            variant="ghost" 
            onClick={() => setStep(2)} 
            className="text-gray-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Re-upload
          </Button>

          <Button 
            size="lg" 
            onClick={handleSave} 
            disabled={rawSubjects.length === 0 || rawSlots.length === 0}
            className="w-full sm:w-auto px-8 h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-lg shadow-purple-600/30"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Confirm & Create Timetable
          </Button>
        </div>
      </div>
    </div>
  );
}
