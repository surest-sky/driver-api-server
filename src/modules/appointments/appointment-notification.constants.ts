import dayjs from 'dayjs';

export const AUTO_COMPLETE_TITLE = '预约已自动完成';
export const AUTO_CANCEL_TITLE = '预约已自动取消';

export function buildAutoCancelStudentContent(startTime: Date): string {
  const formatted = dayjs(startTime).format('YYYY-MM-DD HH:mm');
  return `您在 ${formatted} 的预约因超过 24 小时未被确认或已过期，系统已自动取消。`;
}

export function buildAutoCancelCoachContent(
  studentName: string | null,
  startTime: Date,
): string {
  const formatted = dayjs(startTime).format('YYYY-MM-DD HH:mm');
  const trimmed = (studentName ?? '').trim();
  const name = trimmed.length > 0 ? trimmed : '学员';
  return `${name} 在 ${formatted} 的预约因超过 24 小时未处理或时间已过期，系统已自动取消。`;
}
