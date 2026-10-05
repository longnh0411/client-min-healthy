# 🩸 Ngọt vừa thui — Sổ đường huyết

Web app (PWA) giúp người bệnh tiểu đường **ghi lại đường huyết trước/sau bữa ăn**, hiểu nguyên
con số cao/thấp qua ngữ cảnh bữa trước, xem trạng thái từng lần đo và ước tính HbA1c tham khảo.
Giao diện tiếng Việt, đơn vị duy nhất **mg/dL**.

> ⚠️ Ứng dụng chỉ để theo dõi, không thay thế tư vấn y tế. Ngưỡng mặc định chỉ tham khảo ADA —
> hãy chỉnh theo chỉ định của bác sĩ điều trị.

## Kiến trúc

- **Client** (repo này): Next.js 16 App Router + React 19 + Tailwind CSS 4, deploy **Vercel**.
  Không có backend riêng — gọi thẳng monolith.
- **API**: service `min-healthy` trong monolith [api-longnh-tools](https://github.com/longnh0411/api-longnh-tools)
  (NestJS + MongoDB Atlas, deploy Render). Route: `/api/min-healthy/*` (meals, settings).
- **Auth**: đăng nhập Google bằng Firebase — client lấy `idToken` → `POST /api/auth/social`
  (xác thực qua `firebase-admin` phía API) → nhận access/refresh token (bearer).
- **Ảnh phần ăn**: Cloudflare R2 qua presigned URL (`POST /api/users/upload/presign`, category `meal`).
- **Nhắc đo**: FCM push — client đăng ký token (`POST /api/notification/register`), cron trong
  API gửi push đúng giờ người dùng đặt trong phần Cài đặt.

Chỉ có 2 màn hình: `/login` (Google) và `/` (mọi form dùng bottom sheet, không thêm route).

## Chạy local

```bash
cp .env.example .env.local   # điền env (xem dưới)
npm install
npm run dev                  # http://localhost:3000
```

Env `.env.local` (đều có trong `.env.example`):

| Biến | Ý nghĩa |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL monolith (vd `http://localhost:3100` khi dev, Render URL khi deploy) — **không** có `/api` ở cuối |
| `NEXT_PUBLIC_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | Web config của **cùng Firebase project** với `FIREBASE_*` env phía API |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web Push certificate key (Firebase Console → Project settings → Cloud Messaging → Web Push certificates) — cần để nhận push |

### Bật đăng nhập Google

1. Firebase Console → **Authentication** → Sign-in method → bật **Google**.
2. **Authorized domains**: thêm `localhost` và domain Vercel của app.
3. Điền web config vào `.env.local` (mục trên).

### Bật nhắc đo (push)

Cần `NEXT_PUBLIC_FIREBASE_VAPID_KEY` + FCM token đăng ký theo app `min-healthy`.
Lưu ý **iOS Safari**: push nền chỉ nhận khi đã cài app qua “Thêm vào Màn hình chính” (iOS 16.4+).

### CORS phía API

Thêm domain client (localhost:3000 + domain Vercel) vào env `WEB_URLS` của api-longnh-tools.

## Lệnh

```bash
npm run dev         # dev server
npm run build       # build production
npm run lint        # eslint
npm run test        # vitest (logic nghiệp vụ lib/glucose.ts)
node scripts/generate-icons.mjs   # sinh lại icon PWA sau khi đổi thiết kế
```

## Tính năng

- Ghi bữa ăn + đo **trước ăn** (tự đoán loại bữa theo giờ) và **đo sau ăn** (tự gắn bữa gần nhất
  chưa có số đo, hiển thị “sau ăn 1g 55p”, độ chênh `+38`).
- Số đo trước ăn hiện **ngữ cảnh bữa trước** (tên món, giờ, khoảng cách; cách ≥ 8 giờ → “Lúc đói”).
- **Chip trạng thái** từng số đo theo ngưỡng chỉnh được: Thấp / Hơi thấp / Trong mục tiêu / Cao / Rất cao
  (chữ + màu, không nhận xét “tốt/chưa tốt”).
- **HbA1c ước tính** (eAG) 30/60/90 ngày, cần ≥ 10 lần đo, luôn kèm chú thích tham khảo.
- **Biểu đồ xu hướng** 7/14/30 ngày (SVG tay, đường tham chiếu `low`/`postMax`).
- **Lịch sử** nhóm theo ngày, sửa/xoá bản ghi (sheet chỉnh mọi trường).
- **Banner an toàn** khi số đo `< low` hoặc `≥ veryHigh` (kèm số cấp cứu 115).
- **PWA**: cài lên màn hình chính (manifest + service worker + gợi ý cài cho Android/iOS).
- **Nhắc nhở đo**: tối đa 6 mốc giờ, bật/tắt từng mốc — push FCM đúng giờ (cron phía API, múi giờ VN).
- **Ảnh phần ăn**: chọn/tự resize (≤1600px JPEG) rồi upload thẳng R2 qua presigned URL.

## Validation dữ liệu nhập

- Số đo: số nguyên 20–600 mg/dL; lệch > 100 so với đo liền trước cùng loại → hỏi xác nhận.
- `measuredAt` không được ở tương lai; đo sau ăn phải sau thời điểm ăn (validate cả 2 phía).

## Future work

- Offline-first (ghi khi mất mạng, đồng bộ lại) — hiện REST thuần.
- Dọn object R2 mồ côi khi xoá meal (hiện giữ nguyên ảnh như hành vi avatar của API).
- Gợi ý tự hoàn thành tên món từ lịch sử; xuất CSV.
