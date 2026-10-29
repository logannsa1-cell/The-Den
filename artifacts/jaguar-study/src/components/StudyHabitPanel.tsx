import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Flame, RotateCcw } from 'lucide-react';
import {
  getGetStudyHabitStateQueryKey,
  useGetStudyHabitState,
  useRecordStudyActivity,
  useUpdateStudyHabitPreferences,
  type StudyHabitPreferencesInput,
} from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';

function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function timeAtZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export function StudyHabitPanel({ userId, isStudying }: { userId: string; isStudying: boolean }) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => [...getGetStudyHabitStateQueryKey(), userId],
    [userId],
  );
  const habits = useGetStudyHabitState({
    query: {
      queryKey,
      enabled: Boolean(userId),
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  });
  const record = useRecordStudyActivity();
  const savePreferences = useUpdateStudyHabitPreferences();
  const [message, setMessage] = useState('');
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const initializedUser = useRef('');
  const recording = useRef(false);
  const recordStudyActivity = useRef(record.mutateAsync);
  recordStudyActivity.current = record.mutateAsync;
  const form = useForm<StudyHabitPreferencesInput>({
    defaultValues: {
      reminderEnabled: false,
      reminderTime: '19:00',
      timeZone: deviceTimeZone(),
    },
  });

  useEffect(() => {
    if (!habits.data || (initializedUser.current === userId && form.formState.isDirty)) return;
    form.reset({
      reminderEnabled: habits.data.reminderEnabled,
      reminderTime: habits.data.reminderTime ?? '19:00',
      timeZone:
        habits.data.reminderEnabled || habits.data.reminderTime
          ? habits.data.timeZone
          : deviceTimeZone(),
    });
    initializedUser.current = userId;
  }, [form, form.formState.isDirty, habits.data, userId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    const updatePermission = () => setPermission(Notification.permission);
    updatePermission();
    window.addEventListener('focus', updatePermission);
    return () => window.removeEventListener('focus', updatePermission);
  }, []);

  const recordStudyDay = useCallback(async () => {
    if (!userId || recording.current) return;
    recording.current = true;
    try {
      const state = await recordStudyActivity.current({
        data: { timeZone: deviceTimeZone() },
      });
      queryClient.setQueryData(queryKey, state);
    } catch {
      setMessage('Could not save today’s study activity. It will try again next session.');
    } finally {
      recording.current = false;
    }
  }, [queryClient, queryKey, userId]);

  useEffect(() => {
    if (!isStudying || habits.data?.studiedToday || !userId) return;
    let focusedMs = 0;
    let lastCheck = Date.now();
    let submitted = false;
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        focusedMs += Math.min(now - lastCheck, 20_000);
      }
      lastCheck = now;
      if (focusedMs >= 5 * 60 * 1000 && !submitted) {
        submitted = true;
        void recordStudyDay();
      }
    };
    const resetClock = () => { lastCheck = Date.now(); };
    const timer = window.setInterval(tick, 15_000);
    document.addEventListener('visibilitychange', resetClock);
    window.addEventListener('focus', resetClock);
    window.addEventListener('blur', resetClock);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', resetClock);
      window.removeEventListener('focus', resetClock);
      window.removeEventListener('blur', resetClock);
    };
  }, [habits.data?.studiedToday, isStudying, recordStudyDay, userId]);

  useEffect(() => {
    const state = habits.data;
    const reminderTime = state?.reminderTime;
    if (
      !userId ||
      !state?.reminderEnabled ||
      !reminderTime ||
      permission !== 'granted'
    ) return;

    const storageKey = `jaguar-reminder-fired-${userId}`;
    const checkReminder = () => {
      if (state.studiedToday) return;
      try {
        const { date, time } = timeAtZone(new Date(), state.timeZone);
        if (time < reminderTime || localStorage.getItem(storageKey) === date) return;
        new Notification('Time for your Jaguar study session', {
          body: 'Open a study set and spend five focused minutes to keep your streak going.',
        });
        localStorage.setItem(storageKey, date);
      } catch {
        setMessage('Could not show the reminder on this device.');
      }
    };
    checkReminder();
    const timer = window.setInterval(checkReminder, 15_000);
    return () => window.clearInterval(timer);
  }, [habits.data, permission, userId]);

  const save = async (values: StudyHabitPreferencesInput) => {
    setMessage('');
    if (values.reminderEnabled) {
      if (!values.reminderTime) {
        setMessage('Choose a reminder time first.');
        return;
      }
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setMessage('This browser does not support notifications.');
        return;
      }
      let result: NotificationPermission;
      try {
        result = Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();
      } catch {
        setMessage('Could not request notification permission in this browser.');
        return;
      }
      setPermission(result);
      if (result !== 'granted') {
        setMessage('Allow notifications in this browser, then save the reminder again.');
        return;
      }
    }

    savePreferences.mutate(
      {
        data: {
          ...values,
          reminderTime: values.reminderTime || null,
          timeZone: values.timeZone || deviceTimeZone(),
        },
      },
      {
        onSuccess: (state) => {
          queryClient.setQueryData(queryKey, state);
          form.reset({
            reminderEnabled: state.reminderEnabled,
            reminderTime: state.reminderTime ?? '19:00',
            timeZone: state.timeZone,
          });
          setMessage(state.reminderEnabled ? 'Reminder saved to your account.' : 'Reminder turned off.');
        },
        onError: () => setMessage('Could not save reminder settings. Try again.'),
      },
    );
  };

  if (!userId) {
    return (
      <section className="study-habit-panel" aria-label="Study streak">
        <div className="study-habit-heading">
          <span className="study-flame" aria-hidden="true">
            <Flame className="study-flame-outer" />
            <Flame className="study-flame-inner" />
          </span>
          <div><h2>Study streak</h2><p>Sign in to save your streak and reminders.</p></div>
        </div>
      </section>
    );
  }

  const currentStreak = habits.data?.currentStreak;
  const bestStreak = habits.data?.bestStreak;

  return (
    <section className="study-habit-panel" aria-labelledby="study-habit-title" data-testid="section-study-habits">
      <div className="study-habit-heading">
        <span className="study-flame" aria-hidden="true">
          <Flame className="study-flame-outer" />
          <Flame className="study-flame-inner" />
        </span>
        <div className="study-habit-summary">
          <h2 id="study-habit-title">Study streak</h2>
          <strong data-testid="text-study-streak">
            {habits.isLoading ? 'Loading…' : `${currentStreak ?? 0} ${currentStreak === 1 ? 'day' : 'days'}`}
          </strong>
        </div>
        <span className="study-habit-best">
          Best {habits.isLoading ? '—' : bestStreak ?? 0}
        </span>
      </div>
      <p className="study-habit-caption">
        {habits.data?.studiedToday
          ? 'Today’s study is logged.'
          : 'Five focused minutes in a study set count for today.'}
      </p>

      {habits.isError && (
        <div className="study-habit-error" role="alert">
          <span>Couldn’t load your study streak.</span>
          <button className="text-button" type="button" onClick={() => void habits.refetch()}>
            <RotateCcw size={12} /> Retry
          </button>
        </div>
      )}

      <Form {...form}>
        <form className="study-reminder-form" onSubmit={form.handleSubmit(save)}>
          <FormField
            control={form.control}
            name="reminderEnabled"
            render={({ field }) => (
              <FormItem className="study-reminder-toggle">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    aria-label="Enable daily reminder"
                    data-testid="checkbox-daily-reminder"
                  />
                </FormControl>
                <FormLabel>Daily reminder</FormLabel>
              </FormItem>
            )}
          />
          <div className="study-reminder-controls">
            <FormField
              control={form.control}
              name="reminderTime"
              render={({ field }) => (
                <FormItem className="study-reminder-time">
                  <FormLabel>At</FormLabel>
                  <FormControl>
                    <input
                      type="time"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      className="field"
                      data-testid="input-reminder-time"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <button className="quiet-button study-reminder-save" type="submit" disabled={savePreferences.isPending || habits.isLoading} data-testid="button-save-reminder">
              {savePreferences.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Form>
      <p className="study-reminder-note">
        {permission === 'unsupported'
          ? 'Notifications are not supported in this browser.'
          : 'Without a push service, reminders only fire while Jaguar is open.'}
      </p>
      {message && <p className="study-habit-message" role="status">{message}</p>}
    </section>
  );
}
