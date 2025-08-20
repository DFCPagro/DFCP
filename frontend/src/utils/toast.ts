import { toaster } from '@/components/ui/toaster';
import { monthName } from '@/store/scheduleStore';

export const toastSaved = (y: number, m: number, daysLen: number) =>
  toaster.create({
    title: 'Schedule saved',
    description: `${monthName(m)} ${y} • ${daysLen} days updated`,
    type: 'success',
    duration: 3000,
    closable: true,
  });

export const toastCanceled = () =>
  toaster.create({
    title: 'No changes applied',
    type: 'info',
    duration: 2000,
    closable: true,
  });
