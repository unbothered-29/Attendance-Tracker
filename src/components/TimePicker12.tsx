import React from 'react';

export function TimePicker12({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  // value is in "HH:mm" (24hr)
  const h24 = value ? parseInt(value.split(':')[0], 10) : 9;
  const m = value ? value.split(':')[1] : '00';
  
  const h12 = h24 % 12 || 12;
  const ampm = h24 >= 12 ? 'PM' : 'AM';

  const handleHourChange = (newH12: number) => {
    let newH24 = newH12;
    if (ampm === 'PM' && newH12 !== 12) newH24 += 12;
    if (ampm === 'AM' && newH12 === 12) newH24 = 0;
    onChange(`${newH24.toString().padStart(2, '0')}:${m}`);
  };

  const handleMinuteChange = (newM: string) => {
    onChange(`${h24.toString().padStart(2, '0')}:${newM}`);
  };

  const handleAmPmChange = (newAmPm: string) => {
    let newH24 = h24;
    if (newAmPm === 'PM' && h24 < 12) newH24 += 12;
    if (newAmPm === 'AM' && h24 >= 12) newH24 -= 12;
    onChange(`${newH24.toString().padStart(2, '0')}:${m}`);
  };

  return (
    <div className="flex items-center gap-1 bg-[#120919] border border-purple-500/20 rounded-lg px-2 h-10 w-fit">
      <select 
        className="bg-transparent text-gray-200 focus:outline-none appearance-none text-center"
        value={h12}
        onChange={(e) => handleHourChange(Number(e.target.value))}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(hour => (
          <option key={hour} value={hour}>{hour}</option>
        ))}
      </select>
      <span className="text-gray-400">:</span>
      <select 
        className="bg-transparent text-gray-200 focus:outline-none appearance-none text-center"
        value={m}
        onChange={(e) => handleMinuteChange(e.target.value)}
      >
        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(minute => (
          <option key={minute} value={minute}>{minute}</option>
        ))}
      </select>
      <select 
        className="bg-transparent text-purple-400 focus:outline-none appearance-none font-medium ml-1"
        value={ampm}
        onChange={(e) => handleAmPmChange(e.target.value)}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
