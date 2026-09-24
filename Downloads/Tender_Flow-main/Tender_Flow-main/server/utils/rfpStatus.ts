export function isBidClosed(bidEndDate?: string): boolean {
  if (!bidEndDate) return false;
  const end = new Date(bidEndDate).getTime();
  return Date.now() > end;
}