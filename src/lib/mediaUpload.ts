import { auth } from './firebase';
import { invalidatePublicCache } from './publicData';

export type UploadKind = 'image' | 'avatar' | 'favicon' | 'document';

export interface UploadedMediaResult {
  assetId: string;
  url: string;
  canonicalUrl: string;
  thumbnailUrl: string | null;
  name: string;
  mediaType: 'image' | 'pdf' | 'document';
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  mediaDocId?: string | null;
}

export const IMAGE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif';
export const FAVICON_ACCEPT =
  'image/png,image/webp,image/x-icon,image/vnd.microsoft.icon,image/jpeg,.ico,.png,.webp,.jpg,.jpeg';
export const DOCUMENT_ACCEPT =
  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp';

export const MAX_RAW_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function extractMediaAssetId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/api\/media\/([a-zA-Z0-9_-]{4,128})(?:\/thumb)?(?:\?|$)/);
  return match ? match[1] : null;
}

export function isHeicLikeFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return (
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

export function isIcoLikeFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return (
    mime === 'image/x-icon' ||
    mime === 'image/vnd.microsoft.icon' ||
    name.endsWith('.ico')
  );
}

export function validateUploadFile(file: File, kind: UploadKind): string | null {
  if (!file || file.size === 0) {
    return 'Selected file is empty.';
  }
  if (file.size > MAX_RAW_FILE_BYTES) {
    return `File is too large (${formatFileSize(file.size)}). Maximum allowed size is 15 MB.`;
  }

  const name = (file.name || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  if (kind === 'image' || kind === 'avatar') {
    const validExt = /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name);
    const validMime = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif',
    ].includes(mime);
    if (!validExt && !validMime) {
      return 'Unsupported image format. Please choose JPG, PNG, WEBP, GIF, or HEIC/HEIF.';
    }
    return null;
  }

  if (kind === 'favicon') {
    const validExt = /\.(ico|png|webp|jpe?g|gif)$/i.test(name);
    const validMime = [
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'image/png',
      'image/webp',
      'image/jpeg',
      'image/gif',
    ].includes(mime);
    if (!validExt && !validMime) {
      return 'Favicon must be ICO, PNG, WEBP, JPG, or GIF.';
    }
    return null;
  }

  if (kind === 'document') {
    const validExt = /\.(pdf|docx?|jpe?g|png|webp)$/i.test(name);
    const validMime = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
    ].includes(mime);
    if (!validExt && !validMime) {
      return 'Unsupported document format. Allowed: PDF, DOC, DOCX, JPG, PNG, or WEBP.';
    }
    return null;
  }

  return null;
}

export async function isAnimatedGif(file: Blob): Promise<boolean> {
  const mime = (file.type || '').toLowerCase();
  const name = file instanceof File ? file.name.toLowerCase() : '';
  if (mime !== 'image/gif' && !name.endsWith('.gif')) return false;

  try {
    const buffer = await file.slice(0, 512 * 1024).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (
      bytes.length < 10 ||
      bytes[0] !== 0x47 ||
      bytes[1] !== 0x49 ||
      bytes[2] !== 0x46
    ) {
      return false;
    }
    // Count Graphic Control Extension markers (0x21 0xF9 0x04)
    let gceCount = 0;
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) {
        gceCount++;
        if (gceCount > 1) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export async function convertHeicToJpegIfNeeded(file: File): Promise<File> {
  if (!isHeicLikeFile(file)) return file;
  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9,
  });
  const outBlob = Array.isArray(converted) ? converted[0] : converted;
  const newName = file.name.replace(/\.(heic|heif)$/i, '') + '.jpg';
  return new File([outBlob], newName, { type: 'image/jpeg' });
}

function loadImageElement(srcUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image file. Please try another picture.'));
    img.src = srcUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error('Failed to encode image canvas.'));
        else resolve(b);
      },
      mime,
      quality
    );
  });
}

export async function renderThumbnailBlob(
  sourceBlob: Blob,
  maxThumbSize = 400
): Promise<{ thumbBlob: Blob; width: number; height: number }> {
  const objectUrl = URL.createObjectURL(sourceBlob);
  try {
    const img = await loadImageElement(objectUrl);
    const width = img.naturalWidth || img.width || 1;
    const height = img.naturalHeight || img.height || 1;
    const scale = Math.min(1, maxThumbSize / Math.max(width, height));
    const tw = Math.max(1, Math.round(width * scale));
    const th = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(img, 0, 0, tw, th);

    const outMime =
      sourceBlob.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const thumbBlob = await canvasToBlob(canvas, outMime, 0.82);
    return { thumbBlob, width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export interface PreparedImageAsset {
  uploadBlob: Blob;
  thumbBlob: Blob | null;
  fileName: string;
  width: number;
  height: number;
}

export async function prepareImageForUpload(
  inputFile: File,
  options?: { maxDimension?: number; cropSquare?: boolean }
): Promise<PreparedImageAsset> {
  if (isIcoLikeFile(inputFile)) {
    return {
      uploadBlob: inputFile,
      thumbBlob: null,
      fileName: inputFile.name || 'favicon.ico',
      width: 64,
      height: 64,
    };
  }

  let workingFile = await convertHeicToJpegIfNeeded(inputFile);
  const animated = await isAnimatedGif(workingFile);

  if (animated) {
    // Preserve animated GIF frames intact; generate static thumbnail from frame 1
    let thumbBlob: Blob | null = null;
    let width = 0;
    let height = 0;
    try {
      const thumbInfo = await renderThumbnailBlob(workingFile, 400);
      thumbBlob = thumbInfo.thumbBlob;
      width = thumbInfo.width;
      height = thumbInfo.height;
    } catch {
      // Ignore if GIF thumbnail generation fails
    }
    return {
      uploadBlob: workingFile,
      thumbBlob,
      fileName: workingFile.name || 'animation.gif',
      width,
      height,
    };
  }

  const maxDim = options?.maxDimension ?? 2200;
  const objectUrl = URL.createObjectURL(workingFile);
  try {
    const img = await loadImageElement(objectUrl);
    const naturalW = img.naturalWidth || img.width || 1;
    const naturalH = img.naturalHeight || img.height || 1;

    const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
    const targetW = Math.max(1, Math.round(naturalW * scale));
    const targetH = Math.max(1, Math.round(naturalH * scale));

    let finalBlob: Blob = workingFile;
    const mime = (workingFile.type || '').toLowerCase();
    const shouldReencode =
      scale < 1 ||
      workingFile.size > 1.8 * 1024 * 1024 ||
      mime === 'image/bmp';

    if (shouldReencode) {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const targetMime = mime === 'image/png' ? 'image/png' : 'image/jpeg';
      const encoded = await canvasToBlob(canvas, targetMime, 0.88);
      if (encoded.size < workingFile.size || scale < 1) {
        finalBlob = encoded;
      }
    }

    // Generate <= 400px thumbnail
    const thumbScale = Math.min(1, 400 / Math.max(naturalW, naturalH));
    const thumbW = Math.max(1, Math.round(naturalW * thumbScale));
    const thumbH = Math.max(1, Math.round(naturalH * thumbScale));
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const thumbCtx = thumbCanvas.getContext('2d');
    let thumbBlob: Blob | null = null;
    if (thumbCtx) {
      thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);
      thumbBlob = await canvasToBlob(
        thumbCanvas,
        mime === 'image/png' ? 'image/png' : 'image/jpeg',
        0.8
      );
    }

    return {
      uploadBlob: finalBlob,
      thumbBlob,
      fileName: workingFile.name || 'image.jpg',
      width: targetW,
      height: targetH,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export interface UploadMediaOptions {
  file?: File;
  croppedBlob?: Blob;
  name?: string;
  kind?: UploadKind;
  maxDimension?: number;
  registerMedia?: boolean;
  replaceAssetId?: string | null;
  onProgress?: (percent: number) => void;
}

export async function uploadMediaFile(options: UploadMediaOptions): Promise<UploadedMediaResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to upload files.');
  }

  const kind: UploadKind = options.kind || 'image';
  const progress = options.onProgress;
  progress?.(5);

  let uploadBlob: Blob;
  let thumbBlob: Blob | null = null;
  let finalName = options.name?.trim() || options.file?.name || 'upload.jpg';
  let width = 0;
  let height = 0;
  let mediaType: 'image' | 'pdf' | 'document' = 'image';

  if (options.croppedBlob) {
    uploadBlob = options.croppedBlob;
    progress?.(12);
    try {
      const thumbInfo = await renderThumbnailBlob(options.croppedBlob, 400);
      thumbBlob = thumbInfo.thumbBlob;
      width = thumbInfo.width;
      height = thumbInfo.height;
    } catch {
      // Fallback safely
    }
  } else if (options.file) {
    const validationErr = validateUploadFile(options.file, kind);
    if (validationErr) {
      throw new Error(validationErr);
    }

    const mime = (options.file.type || '').toLowerCase();
    const lowerName = (options.file.name || '').toLowerCase();
    const isDocFile =
      mime === 'application/pdf' ||
      mime === 'application/msword' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      /\.(pdf|docx?)$/i.test(lowerName);

    if (isDocFile) {
      uploadBlob = options.file;
      mediaType = mime === 'application/pdf' || lowerName.endsWith('.pdf') ? 'pdf' : 'document';
      progress?.(15);
    } else {
      const prepared = await prepareImageForUpload(options.file, {
        maxDimension: options.maxDimension ?? (kind === 'avatar' ? 640 : 2200),
      });
      uploadBlob = prepared.uploadBlob;
      thumbBlob = prepared.thumbBlob;
      if (!options.name?.trim()) {
        finalName = prepared.fileName;
      }
      width = prepared.width;
      height = prepared.height;
      progress?.(15);
    }
  } else {
    throw new Error('No file was provided to upload.');
  }

  if (uploadBlob.size > MAX_RAW_FILE_BYTES) {
    throw new Error('Processed file exceeds the 15 MB upload limit.');
  }

  const idToken = await currentUser.getIdToken();
  const formData = new FormData();
  formData.append('file', uploadBlob, finalName);
  if (thumbBlob && thumbBlob.size <= 320 * 1024) {
    formData.append('thumb', thumbBlob, `thumb-${finalName}`);
  }
  formData.append('name', finalName.slice(0, 190));
  formData.append('mediaType', mediaType);
  if (width > 0) formData.append('width', String(width));
  if (height > 0) formData.append('height', String(height));
  formData.append('registerMedia', options.registerMedia === false ? 'false' : 'true');
  if (options.replaceAssetId) {
    formData.append('replaceAssetId', options.replaceAssetId);
  }

  const result = await new Promise<UploadedMediaResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/media/upload', true);
    xhr.setRequestHeader('Authorization', `Bearer ${idToken}`);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        const pct = Math.min(97, Math.round(15 + (evt.loaded / evt.total) * 82));
        progress?.(pct);
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          progress?.(100);
          resolve(parsed as UploadedMediaResult);
        } else {
          reject(new Error(parsed?.error || `Upload failed with status ${xhr.status}.`));
        }
      } catch {
        reject(new Error(`Upload failed with status ${xhr.status}.`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred while uploading the file.'));
    };

    xhr.onabort = () => {
      reject(new Error('Upload was cancelled.'));
    };

    xhr.send(formData);
  });

  invalidatePublicCache();
  return result;
}

export async function deleteAssetByUrl(url?: string | null): Promise<boolean> {
  const assetId = extractMediaAssetId(url);
  if (!assetId) return false;
  const currentUser = auth.currentUser;
  if (!currentUser) return false;

  try {
    const idToken = await currentUser.getIdToken();
    const resp = await fetch(`/api/media/${encodeURIComponent(assetId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    invalidatePublicCache();
    return resp.ok;
  } catch {
    return false;
  }
}
