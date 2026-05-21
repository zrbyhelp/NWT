export const maxAvatarBytes = 5 * 1024 * 1024;

export const avatarContentTypeExtensions = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

export function isValidAvatarFile(file: File) {
  const contentType = file.type.toLowerCase();

  return contentType in avatarContentTypeExtensions && file.size > 0 && file.size <= maxAvatarBytes;
}
