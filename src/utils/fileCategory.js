function categorizeFile(filename, mimeType = '') {
  const lower = filename.toLowerCase();
  if (mimeType.startsWith('audio') || /(mp3|wav|flac|ogg)$/i.test(lower)) return 'audio';
  if (mimeType.startsWith('video') || /(mp4|m4v|avi|mov)$/i.test(lower)) return 'video';
  if (mimeType.startsWith('image') || /(jpg|jpeg|png|tiff|webp|bmp|gif)$/i.test(lower)) return 'image';
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  return 'other';
}

module.exports = { categorizeFile };
