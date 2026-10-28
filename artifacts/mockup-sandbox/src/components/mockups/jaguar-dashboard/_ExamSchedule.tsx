import { useEffect, useState } from 'react';
import { CalendarDays, Trash2 } from 'lucide-react';
function readJson<T>(_key: string, fallback: T): T { return fallback; }
function writeJson(_key: string, _value: unknown) {}

type Schedule = { subject: string; date: string; pace: string };
const EMPTY: Schedule = { subject: '', date: '', pace: '1' };

function daysUntil(date: string) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

/** Personal exam schedule. Stored only on this device, per user. Never sent to study generation. */
export function ExamSchedule({ userId }: { userId: string }) {
  const key = `jaguar-exam-schedule-${userId}`;
  const [s, setS] = useState<Schedule>(EMPTY);
  const [loadedFor, setLoadedFor] = useState('');
  useEffect(() => { setS({ ...EMPTY, ...readJson<Schedule>(key, EMPTY) }); setLoadedFor(key); }, [key]);
  useEffect(() => { if (userId && loadedFor === key) writeJson(key, s); }, [key, s, loadedFor, userId]);
  const left = s.date ? daysUntil(s.date) : null;
  const hours = Number(s.pace);
  return (
    <section className="panel schedule-panel" aria-labelledby="schedule-title" data-testid="section-exam-schedule">
      <div className="panel-head"><h2 id="schedule-title" className="panel-title">Set your pace</h2><span className="step-label">SAVED ON THIS DEVICE</span></div>
      <div className="schedule-grid">
        <div className="countdown-block" data-testid="text-days-left">
          <span className="schedule-icon"><CalendarDays size={18} /></span>
          {left === null ? <><strong>--</strong><small>Pick your exam date</small></>
            : left < 0 ? <><strong>Done</strong><small>That date has passed</small></>
            : <><strong>{left}</strong><small>{left === 1 ? 'day' : 'days'} to {s.subject || 'your exam'}</small></>}
          {left !== null && left >= 0 && <em>{Math.round(left * hours * 10) / 10} study hours at your pace</em>}
        </div>
        <div className="schedule-fields">
          <label className="setting"><span>Subject</span><input className="field" value={s.subject} maxLength={60} placeholder="e.g. Biology paper 2" onChange={(e) => setS({ ...s, subject: e.target.value })} data-testid="input-exam-subject" /></label>
          <div className="field-row">
            <label className="setting"><span>Exam date</span><input className="field" type="date" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} data-testid="input-exam-date" /></label>
            <label className="setting"><span>Daily time</span>
              <select className="field" value={s.pace} onChange={(e) => setS({ ...s, pace: e.target.value })} data-testid="select-hours">
                <option value="0.5">30 min</option><option value="1">1 hour</option><option value="1.5">1.5 hours</option><option value="2">2 hours</option><option value="3">3 hours</option><option value="4">4 hours</option>
              </select></label>
          </div>
          {(s.date || s.subject) && <button className="text-button" type="button" onClick={() => setS(EMPTY)} data-testid="button-clear-schedule"><Trash2 size={11} /> Clear schedule</button>}
        </div>
      </div>
    </section>
  );
}
