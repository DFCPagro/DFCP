import { useScheduleStore } from './scheduleStore';

export const useEnsureMonth = () =>
  useScheduleStore(s => s.ensureMonth);

export const useWeeklyPattern = () =>
  useScheduleStore(s => s.weeklyPattern);

export const useSetWeeklyPattern = () =>
  useScheduleStore(s => s.setWeeklyPattern);

export const useSaveMonth = () =>
  useScheduleStore(s => s.saveMonth);

export const useGetMonth = () =>
  useScheduleStore(s => s.getMonth);
