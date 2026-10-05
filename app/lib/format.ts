// Format ngày giờ tiếng Việt theo múi giờ thiết bị (plan.md: lưu UTC, hiện giờ máy).

const DAY_NAMES = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

export function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/** Key nhóm theo ngày (giờ máy): YYYY-MM-DD */
export function dayKey(d: Date | string): string {
  const dt = new Date(d);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** Nhãn nhóm ngày: Hôm nay / Hôm qua / Thứ tư · 01/10 */
export function dayGroupLabel(d: Date | string): string {
  const dt = new Date(d);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (dayKey(dt) === dayKey(today)) return "Hôm nay";
  if (dayKey(dt) === dayKey(yesterday)) return "Hôm qua";
  return `${DAY_NAMES[dt.getDay()]} · ${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

/** "1h 55p" / "45p" — khoảng cách sau ăn (plan.md §3.2) */
export function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}p`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}g` : `${h}g ${m}p`;
}

/** "15 phút trước" / "2 giờ trước" / "hôm qua" — cho thẻ trạng thái hiện tại */
export function fmtRelative(d: Date | string): string {
  const diff = Date.now() - new Date(d).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  if (days === 1) return "hôm qua";
  return `${days} ngày trước`;
}

/** Khoảng cách 2 mốc: "5g 20p" — cho ngữ cảnh bữa trước */
export function fmtGap(from: Date | string, to: Date | string): string {
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  return fmtDuration(minutes);
}

/** Độ chênh có dấu: "+38" / "−12" (mg/dL) */
export function fmtDelta(delta: number | null): string {
  if (delta === null) return "";
  return delta >= 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

/** Date → value cho input type="datetime-local" (giờ máy) */
export function toDatetimeLocal(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** value datetime-local → ISO string */
export function fromDatetimeLocal(v: string): string {
  return new Date(v).toISOString();
}
