// Upload ảnh phần ăn lên Cloudflare R2 theo flow presign của monolith
// (tái dùng pattern blob.ts của client-playtogether-tools, thêm resize canvas):
//   1. resize/nén bằng canvas (cạnh dài ≤1600px, JPEG 0.85 — tự convert HEIC → JPEG)
//   2. POST /users/upload/presign { category: "meal" } → { uploadUrl, publicUrl }
//   3. PUT thẳng lên R2 với Content-Type khớp
import { presignMealPhoto } from "./api";

export const MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.85;

/** Resize + nén 1 File/Blob thành Blob JPEG. Lỗi decode → trả blob gốc. */
export async function compressImage(file: File | Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob && blob.size < file.size ? blob : file),
        "image/jpeg",
        JPEG_QUALITY,
      );
    });
  } catch {
    return file; // decode fail (định dạng lạ) → upload nguyên bản, để server chặn nếu không phải ảnh
  }
}

export interface UploadedPhoto {
  publicUrl: string;
  key: string;
}

/** Upload 1 ảnh: nén → presign → PUT R2. Trả publicUrl để lưu vào meal.photoUrl. */
export async function uploadMealPhoto(file: File | Blob): Promise<UploadedPhoto> {
  const blob = await compressImage(file);
  const contentType = blob.type === "image/jpeg" ? "image/jpeg" : file.type || "image/jpeg";
  const { uploadUrl, publicUrl, key } = await presignMealPhoto(`anh-bua-an-${Date.now()}.jpg`, contentType);

  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    throw new Error(`Tải ảnh lên thất bại (HTTP ${res.status})`);
  }
  return { publicUrl, key };
}
