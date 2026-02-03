import dayjs from 'dayjs';

export const AUTO_COMPLETE_TITLE = 'Appointment auto-completed';
export const AUTO_CANCEL_TITLE = 'Appointment auto-cancelled';

export function buildAutoCancelStudentContent(startTime: Date): string {
  const formatted = dayjs(startTime).format('YYYY-MM-DD HH:mm');
  return `Your appointment at ${formatted} was auto-cancelled because it was not confirmed within 24 hours or has expired.`;
}

export function buildAutoCancelCoachContent(
  studentName: string | null,
  startTime: Date,
): string {
  const formatted = dayjs(startTime).format('YYYY-MM-DD HH:mm');
  const trimmed = (studentName ?? '').trim();
  const name = trimmed.length > 0 ? trimmed : 'Student';
  return `${name}'s appointment at ${formatted} was auto-cancelled because it was not handled within 24 hours or has expired.`;
}
