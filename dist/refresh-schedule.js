// Matches .github/workflows/catalog.yml: minute 17, every six hours, UTC.
export function nextCaptureAt(now = Date.now()) {
 const next = new Date(now);
 next.setUTCMinutes(17, 0, 0);
 next.setUTCHours(Math.floor(next.getUTCHours() / 6) * 6);
 if (next.getTime() <= now) next.setUTCHours(next.getUTCHours() + 6);
 return next.getTime();
}
export function captureCountdown(now = Date.now()) {
 const seconds = Math.ceil((nextCaptureAt(now) - now) / 1000);
 return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
  .map(value => String(value).padStart(2, '0')).join(':');
}
