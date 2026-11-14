import express from 'express';
import type { NextFunction, Request, Response as ExpressResponse } from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
}

interface VerifiedUser {
  uid: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

interface MediaAssetMeta {
  name: string;
  mediaType: 'image' | 'video' | 'pdf' | 'document';
  mimeType: string;
  thumbMimeType?: string;
  size: number;
  width?: number;
  height?: number;
  chunkCount: number;
  uploadedBy: string;
  uploadedByName?: string;
  createdAt: string;
  updatedAt?: string;
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_THUMB_BYTES = 320 * 1024; // 320KB (Firestore limit 350KB)
const CHUNK_SIZE_BYTES = 450 * 1024; // 450KB raw -> ~600KB base64, safely under 1MB Firestore doc cap
const MEDIA_CACHE_DIR = '/tmp/rwanda-media-cache';
const MAX_MEMORY_CACHE_ITEMS = 64;
const MAX_MEMORY_CACHE_ITEM_BYTES = 3 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

function loadFirebaseConfig(): FirebaseAppletConfig {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  const raw = fs.readFileSync(cfgPath, 'utf-8');
  return JSON.parse(raw) as FirebaseAppletConfig;
}

const firebaseConfig = loadFirebaseConfig();
const firestoreDocsBase = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
  firebaseConfig.projectId
)}/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents`;

// Ensure disk cache dir exists
try {
  fs.mkdirSync(MEDIA_CACHE_DIR, { recursive: true });
} catch {
  // Non-fatal if read-only; memory + Firestore fallback remain active
}

// Simple bounded LRU cache for decoded binary assets & thumbnails
const memoryCache = new Map<string, { buffer: Buffer; mimeType: string; name: string }>();

function setMemoryCache(key: string, entry: { buffer: Buffer; mimeType: string; name: string }) {
  if (entry.buffer.length > MAX_MEMORY_CACHE_ITEM_BYTES) return;
  if (memoryCache.has(key)) memoryCache.delete(key);
  memoryCache.set(key, entry);
  while (memoryCache.size > MAX_MEMORY_CACHE_ITEMS) {
    const oldestKey = memoryCache.keys().next().value;
    if (!oldestKey) break;
    memoryCache.delete(oldestKey);
  }
}

function getCacheFilePaths(cacheKey: string) {
  const safe = cacheKey.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return {
    binPath: path.join(MEDIA_CACHE_DIR, `${safe}.bin`),
    metaPath: path.join(MEDIA_CACHE_DIR, `${safe}.json`),
  };
}

function writeDiskCache(cacheKey: string, buffer: Buffer, mimeType: string, name: string) {
  try {
    const { binPath, metaPath } = getCacheFilePaths(cacheKey);
    fs.writeFileSync(binPath, buffer);
    fs.writeFileSync(metaPath, JSON.stringify({ mimeType, name }));
  } catch {
    // Ignore disk cache write errors
  }
}

function readDiskCache(cacheKey: string): { buffer: Buffer; mimeType: string; name: string } | null {
  try {
    const { binPath, metaPath } = getCacheFilePaths(cacheKey);
    if (!fs.existsSync(binPath) || !fs.existsSync(metaPath)) return null;
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as { mimeType: string; name: string };
    const buffer = fs.readFileSync(binPath);
    if (!meta?.mimeType || !buffer.length) return null;
    return { buffer, mimeType: meta.mimeType, name: meta.name || 'file' };
  } catch {
    return null;
  }
}

function clearAssetCache(assetId: string) {
  const keys = [`asset_${assetId}`, `thumb_${assetId}`];
  for (const key of keys) {
    memoryCache.delete(key);
    try {
      const { binPath, metaPath } = getCacheFilePaths(key);
      if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    } catch {
      // ignore
    }
  }
}

// --- Firebase ID Token Verification (RS256 against Google public certs) ---
let cachedCerts: Record<string, string> = {};
let certsExpiresAt = 0;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  if (Date.now() < certsExpiresAt && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error(`Failed to fetch Google token verification certificates (${resp.status})`);
  }
  const certs = (await resp.json()) as Record<string, string>;
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = certs;
  certsExpiresAt = Date.now() + Math.max(60, maxAgeSec) * 1000;
  return certs;
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64');
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedUser> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed authentication token.');
  }
  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const header = JSON.parse(base64UrlDecode(encodedHeader).toString('utf-8')) as {
    alg?: string;
    kid?: string;
  };
  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf-8')) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    name?: string;
    email_verified?: boolean;
  };

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported token signature algorithm.');
  }

  const certs = await getFirebasePublicCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw new Error('Authentication certificate not found for token.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  const isValidSig = verifier.verify(cert, base64UrlDecode(encodedSig));
  if (!isValidSig) {
    throw new Error('Invalid authentication token signature.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${firebaseConfig.projectId}`;
  if (payload.aud !== firebaseConfig.projectId) {
    throw new Error('Token audience mismatch.');
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error('Token issuer mismatch.');
  }
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error('Authentication session expired. Please sign in again.');
  }
  if (payload.iat && payload.iat > nowSec + 300) {
    throw new Error('Authentication token issued in the future.');
  }
  if (!payload.sub || !VALID_ID_REGEX.test(payload.sub)) {
    throw new Error('Invalid user subject claim.');
  }
  if (!payload.email_verified) {
    throw new Error('Verified email is required to upload or delete media.');
  }

  return {
    uid: payload.sub,
    email: payload.email || '',
    name: payload.name || payload.email || 'Admin',
    emailVerified: Boolean(payload.email_verified),
  };
}

// --- Magic-byte MIME verification ---
function detectMimeFromBuffer(buf: Buffer, declaredMime: string, originalName: string): string | null {
  if (buf.length < 4) return null;

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WEBP
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  // GIF
  if (buf.length >= 6) {
    const gifHeader = buf.subarray(0, 6).toString('ascii');
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
      return 'image/gif';
    }
  }
  // HEIC / HEIF (ISO Base Media File Format: offset 4 = 'ftyp')
  if (buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii').toLowerCase();
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) {
      return brand.startsWith('mif') || brand.startsWith('msf') ? 'image/heif' : 'image/heic';
    }
  }
  // ICO
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) {
    return 'image/x-icon';
  }
  // PDF
  if (buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }
  // DOCX (ZIP PK\x03\x04)
  const lowerName = originalName.toLowerCase();
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    if (
      lowerName.endsWith('.docx') ||
      declaredMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
  }
  // Legacy DOC (OLE2 Compound File)
  if (
    buf.length >= 8 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0 &&
    buf[4] === 0xa1 &&
    buf[5] === 0xb1 &&
    buf[6] === 0x1a &&
    buf[7] === 0xe1
  ) {
    return 'application/msword';
  }

  return null;
}

function classifyMediaType(
  mimeType: string,
  requested?: string
): 'image' | 'pdf' | 'document' {
  if (mimeType === 'application/pdf') return 'pdf';
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'document';
  }
  if (requested === 'pdf' || requested === 'document') return requested;
  return 'image';
}

function sanitizeFileName(raw: string, fallbackExt: string): string {
  const cleaned = raw.replace(/[\r\n"\\/]+/g, '_').trim();
  const truncated = cleaned.slice(0, 180) || `upload.${fallbackExt}`;
  return truncated;
}

function mimeToExtension(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return 'ico';
    case 'application/pdf':
      return 'pdf';
    case 'application/msword':
      return 'doc';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    default:
      return 'bin';
  }
}

// --- Firestore REST Helpers ---
type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { bytesValue: string }
  | { booleanValue: boolean }
  | { nullValue: null };

async function firestoreRequest(
  docPath: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  idToken?: string,
  body?: Record<string, unknown>,
  queryParams?: string
): Promise<Response> {
  const qsParts = [`key=${encodeURIComponent(firebaseConfig.apiKey)}`];
  if (queryParams) qsParts.push(queryParams);
  const url = `${firestoreDocsBase}/${docPath}?${qsParts.join('&')}`;
  const headers: Record<string, string> = {};
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  if (body) headers['Content-Type'] = 'application/json';

  return fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function readFsString(fields: Record<string, FirestoreValue> | undefined, key: string): string | undefined {
  const v = fields?.[key];
  if (v && 'stringValue' in v) return v.stringValue;
  return undefined;
}

function readFsInt(fields: Record<string, FirestoreValue> | undefined, key: string): number | undefined {
  const v = fields?.[key];
  if (v && 'integerValue' in v) return Number(v.integerValue);
  return undefined;
}

function readFsBytes(fields: Record<string, FirestoreValue> | undefined, key: string): Buffer | null {
  const v = fields?.[key];
  if (v && 'bytesValue' in v) return Buffer.from(v.bytesValue, 'base64');
  return null;
}

async function parseFirestoreError(resp: Response, fallback: string): Promise<string> {
  try {
    const json = (await resp.json()) as { error?: { message?: string } };
    if (json?.error?.message) return json.error.message;
  } catch {
    // ignore
  }
  return fallback;
}

function parseBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 2,
  },
});

async function startServer() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  const port = process.env.PORT || 3000;


  // OpenAI-powered FRIDO assistant. The API key is read only on the server.
  app.use(express.json({ limit: '48kb' }));

  const aiRequestCounts = new Map<string, { count: number; resetAt: number }>();
  const AI_TASKS = new Set(['career', 'job_match', 'cv_review', 'job_description', 'admin_assistant']);

  app.post('/api/ai/assist', async (req: Request, res: ExpressResponse) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(503).json({ error: 'AI service is not configured yet. Please contact the FRIDO administrator.' });
        return;
      }

      const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
      const now = Date.now();
      const bucket = aiRequestCounts.get(ip);
      if (bucket && bucket.resetAt > now && bucket.count >= 20) {
        res.status(429).json({ error: 'Too many AI requests. Please try again in a minute.' });
        return;
      }
      if (!bucket || bucket.resetAt <= now) aiRequestCounts.set(ip, { count: 1, resetAt: now + 60_000 });
      else bucket.count += 1;

      const { task, input } = req.body || {};
      if (!AI_TASKS.has(task) || !input || typeof input !== 'object' || Array.isArray(input)) {
        res.status(400).json({ error: 'Invalid AI request.' });
        return;
      }

      const requiresAuth = task !== 'career';
      let actor: VerifiedUser | null = null;
      if (requiresAuth) {
        const idToken = parseBearerToken(req);
        if (!idToken) {
          res.status(401).json({ error: 'Please sign in to use this FRIDO AI feature.' });
          return;
        }
        try {
          actor = await verifyFirebaseIdToken(idToken);
        } catch {
          res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
          return;
        }
      }

      if (task === 'job_description' || task === 'admin_assistant') {
        const idToken = parseBearerToken(req);
        const userResp = await firestoreRequest(`users/${actor!.uid}`, 'GET', idToken!);
        if (!userResp.ok) {
          res.status(403).json({ error: 'Administrator access is required.' });
          return;
        }
        const userDoc = await userResp.json() as { fields?: Record<string, FirestoreValue> };
        const role = readFsString(userDoc.fields, 'role') || '';
        const status = readFsString(userDoc.fields, 'status') || 'active';
        if (!['super_admin', 'admin', 'editor'].includes(role) || status === 'suspended') {
          res.status(403).json({ error: 'You do not have permission to use this AI tool.' });
          return;
        }
      }

      const safeInput = JSON.stringify(input).slice(0, 24_000);
      const instructions: Record<string, string> = {
        career: 'You are FRIDO Career Assistant for people seeking jobs and opportunities in Rwanda. Give practical, honest career guidance in clear English. Never invent vacancies, employers, deadlines, salaries, or application links. If asked about a specific live vacancy, explain that the user should verify details on its listing.',
        job_match: 'You are FRIDO Smart Job Matching. Compare the applicant profile with the supplied job listings. Return the strongest matches first, explain evidence for each match, identify missing qualifications, and never invent requirements. Clearly say when no strong match exists.',
        cv_review: 'You are FRIDO CV Assistant. Review the supplied CV text for clarity, structure, grammar, measurable achievements, and relevance. Do not invent qualifications or work history. Provide improved wording only from facts supplied and flag information the applicant must verify.',
        job_description: 'You are FRIDO Job Description Generator for authorized administrators. Draft inclusive, clear job listings from supplied employer facts. Do not invent employer details, salary, benefits, qualifications, location, or deadline; mark missing information as [Please provide].',
        admin_assistant: 'You are FRIDO Admin Assistant. Help administrators interpret the supplied information, plan content operations, and draft communications. Do not claim to have changed records or performed actions. Never expose personal data unnecessarily.',
      };

      const aiResp = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
          instructions: instructions[task],
          input: safeInput,
          max_output_tokens: 1200,
        }),
      });
      const aiData = await aiResp.json() as { output_text?: string; error?: { message?: string }; output?: Array<{ content?: Array<{ text?: string }> }> };
      if (!aiResp.ok) {
        console.error('OpenAI request failed:', aiData.error?.message || aiResp.status);
        res.status(502).json({ error: 'The AI service could not complete this request. Please try again.' });
        return;
      }
      const outputText = aiData.output_text || aiData.output?.flatMap(item => item.content || []).map(part => part.text || '').join('\n').trim();
      if (!outputText) {
        res.status(502).json({ error: 'The AI service returned an empty response. Please try again.' });
        return;
      }
      res.json({ result: outputText });
    } catch (err) {
      console.error('FRIDO AI endpoint error:', err);
      res.status(500).json({ error: 'Unexpected AI service error.' });
    }
  });

  // 1. Upload endpoint (device picker, camera capture, drag-drop, cropped blobs, docs)
  app.post(
    '/api/media/upload',
    uploadMiddleware.fields([
      { name: 'file', maxCount: 1 },
      { name: 'thumb', maxCount: 1 },
    ]),
    async (req: Request, res: ExpressResponse) => {
      try {
        const idToken = parseBearerToken(req);
        if (!idToken) {
          res.status(401).json({ error: 'Authentication required. Please sign in again.' });
          return;
        }

        let actor: VerifiedUser;
        try {
          actor = await verifyFirebaseIdToken(idToken);
        } catch (authErr) {
          res.status(401).json({
            error: authErr instanceof Error ? authErr.message : 'Invalid authentication session.',
          });
          return;
        }

        const filesMap = req.files as Record<string, Express.Multer.File[]> | undefined;
        const primaryFile = filesMap?.file?.[0];
        const thumbFile = filesMap?.thumb?.[0];

        if (!primaryFile || !primaryFile.buffer || primaryFile.buffer.length === 0) {
          res.status(400).json({ error: 'No file data was received in the upload request.' });
          return;
        }

        const detectedMime = detectMimeFromBuffer(
          primaryFile.buffer,
          primaryFile.mimetype || '',
          primaryFile.originalname || ''
        );

        if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
          res.status(415).json({
            error:
              'Unsupported file format. Supported formats: JPG, JPEG, PNG, WEBP, GIF, HEIC/HEIF, ICO, PDF, DOC, DOCX.',
          });
          return;
        }

        let thumbBuffer: Buffer | null = null;
        let thumbMime: string | undefined;
        if (thumbFile && thumbFile.buffer && thumbFile.buffer.length > 0) {
          const detectedThumbMime = detectMimeFromBuffer(
            thumbFile.buffer,
            thumbFile.mimetype || '',
            thumbFile.originalname || 'thumb.jpg'
          );
          if (
            detectedThumbMime &&
            ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(detectedThumbMime) &&
            thumbFile.buffer.length <= MAX_THUMB_BYTES
          ) {
            thumbBuffer = thumbFile.buffer;
            thumbMime = detectedThumbMime;
          }
        }

        const body = req.body as Record<string, string | undefined>;
        const requestedReplaceId = body.replaceAssetId?.trim();
        let assetId = `ast_${crypto.randomBytes(10).toString('hex')}`;
        let existingCreatedAt: string | undefined;
        let oldChunkCount = 0;
        let isReplacing = false;

        if (requestedReplaceId && VALID_ID_REGEX.test(requestedReplaceId)) {
          const existingResp = await firestoreRequest(
            `mediaAssets/${requestedReplaceId}`,
            'GET',
            idToken
          );
          if (existingResp.ok) {
            const existingDoc = (await existingResp.json()) as {
              fields?: Record<string, FirestoreValue>;
            };
            assetId = requestedReplaceId;
            existingCreatedAt = readFsString(existingDoc.fields, 'createdAt');
            oldChunkCount = readFsInt(existingDoc.fields, 'chunkCount') || 0;
            isReplacing = true;
          }
        }

        const ext = mimeToExtension(detectedMime);
        const cleanName = sanitizeFileName(
          body.name || primaryFile.originalname || `upload.${ext}`,
          ext
        );
        const mediaType = classifyMediaType(detectedMime, body.mediaType);
        const width = body.width ? Math.max(0, Math.min(20000, Math.floor(Number(body.width) || 0))) : 0;
        const height = body.height ? Math.max(0, Math.min(20000, Math.floor(Number(body.height) || 0))) : 0;

        // Split into 450KB binary chunks
        const totalSize = primaryFile.buffer.length;
        const chunks: Buffer[] = [];
        for (let offset = 0; offset < totalSize; offset += CHUNK_SIZE_BYTES) {
          chunks.push(primaryFile.buffer.subarray(offset, Math.min(totalSize, offset + CHUNK_SIZE_BYTES)));
        }

        const nowIso = new Date().toISOString();
        const assetFields: Record<string, FirestoreValue> = {
          name: { stringValue: cleanName },
          mediaType: { stringValue: mediaType },
          mimeType: { stringValue: detectedMime },
          size: { integerValue: String(totalSize) },
          chunkCount: { integerValue: String(chunks.length) },
          uploadedBy: { stringValue: actor.uid },
          uploadedByName: { stringValue: actor.name.slice(0, 150) },
          createdAt: { stringValue: existingCreatedAt || nowIso },
        };
        if (thumbMime) {
          assetFields.thumbMimeType = { stringValue: thumbMime };
        }
        if (width > 0) {
          assetFields.width = { integerValue: String(width) };
        }
        if (height > 0) {
          assetFields.height = { integerValue: String(height) };
        }
        if (isReplacing) {
          assetFields.updatedAt = { stringValue: nowIso };
        }

        // Write parent mediaAssets/{assetId} FIRST (required by Master Gate on chunks/thumbs)
        const assetResp = await firestoreRequest(
          `mediaAssets/${assetId}`,
          'PATCH',
          idToken,
          { fields: assetFields }
        );
        if (!assetResp.ok) {
          const msg = await parseFirestoreError(
            assetResp,
            'Permission denied creating persistent media asset.'
          );
          res.status(assetResp.status === 403 ? 403 : 400).json({ error: msg });
          return;
        }

        // Write chunks in sequence / small batches
        for (let i = 0; i < chunks.length; i++) {
          const chunkResp = await firestoreRequest(
            `mediaAssets/${assetId}/chunks/c${i}`,
            'PATCH',
            idToken,
            {
              fields: {
                index: { integerValue: String(i) },
                data: { bytesValue: chunks[i].toString('base64') },
              },
            }
          );
          if (!chunkResp.ok) {
            const msg = await parseFirestoreError(chunkResp, `Failed saving media chunk #${i}.`);
            // Best-effort cleanup of partially written parent doc if brand new
            if (!isReplacing) {
              await firestoreRequest(`mediaAssets/${assetId}`, 'DELETE', idToken).catch(() => {});
            }
            res.status(chunkResp.status === 403 ? 403 : 500).json({ error: msg });
            return;
          }
        }

        // Clean up extra old chunks if replaced with a smaller file
        if (isReplacing && oldChunkCount > chunks.length) {
          for (let i = chunks.length; i < oldChunkCount; i++) {
            await firestoreRequest(`mediaAssets/${assetId}/chunks/c${i}`, 'DELETE', idToken).catch(
              () => {}
            );
          }
        }

        // Write or delete thumbnail
        let thumbnailUrl: string | null = null;
        if (thumbBuffer && thumbMime) {
          const thumbResp = await firestoreRequest(
            `mediaAssets/${assetId}/thumbs/t0`,
            'PATCH',
            idToken,
            {
              fields: {
                data: { bytesValue: thumbBuffer.toString('base64') },
              },
            }
          );
          if (thumbResp.ok) {
            thumbnailUrl = `/api/media/${assetId}/thumb`;
          }
        } else if (isReplacing) {
          await firestoreRequest(`mediaAssets/${assetId}/thumbs/t0`, 'DELETE', idToken).catch(
            () => {}
          );
        }

        // Cache immediately in memory & disk so preview loads instantaneously
        clearAssetCache(assetId);
        setMemoryCache(`asset_${assetId}`, {
          buffer: primaryFile.buffer,
          mimeType: detectedMime,
          name: cleanName,
        });
        writeDiskCache(`asset_${assetId}`, primaryFile.buffer, detectedMime, cleanName);

        if (thumbBuffer && thumbMime) {
          setMemoryCache(`thumb_${assetId}`, {
            buffer: thumbBuffer,
            mimeType: thumbMime,
            name: `thumb-${cleanName}`,
          });
          writeDiskCache(`thumb_${assetId}`, thumbBuffer, thumbMime, `thumb-${cleanName}`);
        }

        const publicUrl = `/api/media/${assetId}`;
        let mediaDocId: string | null = null;
        const shouldRegister = body.registerMedia !== 'false' && !isReplacing;

        if (shouldRegister) {
          const mediaFields: Record<string, FirestoreValue> = {
            url: { stringValue: publicUrl },
            assetId: { stringValue: assetId },
            name: { stringValue: cleanName },
            mediaType: { stringValue: mediaType },
            mimeType: { stringValue: detectedMime },
            size: { integerValue: String(totalSize) },
            uploadedBy: { stringValue: actor.uid },
            uploadedByName: { stringValue: actor.name.slice(0, 150) },
            createdAt: { stringValue: nowIso },
          };
          if (thumbnailUrl) {
            mediaFields.thumbnailUrl = { stringValue: thumbnailUrl };
          }
          if (width > 0) {
            mediaFields.width = { integerValue: String(width) };
          }
          if (height > 0) {
            mediaFields.height = { integerValue: String(height) };
          }
          const newMediaId = `med_${crypto.randomBytes(8).toString('hex')}`;
          const mediaResp = await firestoreRequest(
            `media/${newMediaId}`,
            'PATCH',
            idToken,
            { fields: mediaFields }
          );
          if (mediaResp.ok) {
            mediaDocId = newMediaId;
          }
        }

        res.status(200).json({
          assetId,
          url: isReplacing ? `${publicUrl}?v=${Date.now()}` : publicUrl,
          canonicalUrl: publicUrl,
          thumbnailUrl: thumbnailUrl
            ? isReplacing
              ? `${thumbnailUrl}?v=${Date.now()}`
              : thumbnailUrl
            : null,
          name: cleanName,
          mediaType,
          mimeType: detectedMime,
          size: totalSize,
          width: width || undefined,
          height: height || undefined,
          mediaDocId,
          uploadedBy: actor.uid,
          uploadedByName: actor.name,
        });
      } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Unexpected server error while uploading.',
        });
      }
    }
  );

  // 2. Serve Thumbnail Endpoint
  app.get('/api/media/:assetId/thumb', async (req: Request, res: ExpressResponse) => {
    const { assetId } = req.params;
    if (!VALID_ID_REGEX.test(assetId)) {
      res.status(400).json({ error: 'Invalid media identifier.' });
      return;
    }

    const cacheKey = `thumb_${assetId}`;
    let entry = memoryCache.get(cacheKey) || readDiskCache(cacheKey);
    if (entry) {
      setMemoryCache(cacheKey, entry);
    } else {
      try {
        const assetResp = await firestoreRequest(`mediaAssets/${assetId}`, 'GET');
        if (!assetResp.ok) {
          res.status(404).json({ error: 'Media asset not found.' });
          return;
        }
        const assetDoc = (await assetResp.json()) as { fields?: Record<string, FirestoreValue> };
        const thumbMimeType = readFsString(assetDoc.fields, 'thumbMimeType');
        const name = readFsString(assetDoc.fields, 'name') || 'thumbnail';

        if (!thumbMimeType) {
          // Redirect cleanly to full asset if no separate thumbnail exists (e.g., ICO or small file)
          res.redirect(302, `/api/media/${assetId}`);
          return;
        }

        const thumbResp = await firestoreRequest(`mediaAssets/${assetId}/thumbs/t0`, 'GET');
        if (!thumbResp.ok) {
          res.redirect(302, `/api/media/${assetId}`);
          return;
        }
        const thumbDoc = (await thumbResp.json()) as { fields?: Record<string, FirestoreValue> };
        const buf = readFsBytes(thumbDoc.fields, 'data');
        if (!buf) {
          res.status(404).json({ error: 'Thumbnail payload missing.' });
          return;
        }
        entry = { buffer: buf, mimeType: thumbMimeType, name: `thumb-${name}` };
        setMemoryCache(cacheKey, entry);
        writeDiskCache(cacheKey, buf, thumbMimeType, entry.name);
      } catch (err) {
        console.error('Failed serving media thumbnail:', err);
        res.status(500).json({ error: 'Failed to retrieve thumbnail.' });
        return;
      }
    }

    const hasVersionQuery = typeof req.query.v === 'string';
    res.setHeader('Content-Type', entry.mimeType);
    res.setHeader('Content-Length', String(entry.buffer.length));
    res.setHeader(
      'Cache-Control',
      hasVersionQuery ? 'public, max-age=31536000, immutable' : 'public, max-age=3600, stale-while-revalidate=86400'
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(entry.buffer);
  });

  // 3. Serve Binary Media Endpoint
  app.get('/api/media/:assetId', async (req: Request, res: ExpressResponse) => {
    const { assetId } = req.params;
    if (!VALID_ID_REGEX.test(assetId)) {
      res.status(400).json({ error: 'Invalid media identifier.' });
      return;
    }

    const cacheKey = `asset_${assetId}`;
    let entry = memoryCache.get(cacheKey) || readDiskCache(cacheKey);
    if (entry) {
      setMemoryCache(cacheKey, entry);
    } else {
      try {
        const assetResp = await firestoreRequest(`mediaAssets/${assetId}`, 'GET');
        if (!assetResp.ok) {
          res.status(assetResp.status === 404 ? 404 : 500).json({ error: 'Media asset not found.' });
          return;
        }
        const assetDoc = (await assetResp.json()) as { fields?: Record<string, FirestoreValue> };
        const mimeType = readFsString(assetDoc.fields, 'mimeType');
        const chunkCount = readFsInt(assetDoc.fields, 'chunkCount') || 0;
        const name = readFsString(assetDoc.fields, 'name') || 'file';

        if (!mimeType || chunkCount <= 0) {
          res.status(404).json({ error: 'Media asset metadata incomplete.' });
          return;
        }

        const chunkBuffers: Buffer[] = [];
        for (let i = 0; i < chunkCount; i++) {
          const chunkResp = await firestoreRequest(`mediaAssets/${assetId}/chunks/c${i}`, 'GET');
          if (!chunkResp.ok) {
            res.status(404).json({ error: `Media chunk ${i} missing.` });
            return;
          }
          const chunkDoc = (await chunkResp.json()) as { fields?: Record<string, FirestoreValue> };
          const buf = readFsBytes(chunkDoc.fields, 'data');
          if (!buf) {
            res.status(500).json({ error: `Corrupted media chunk ${i}.` });
            return;
          }
          chunkBuffers.push(buf);
        }

        const combined = Buffer.concat(chunkBuffers);
        entry = { buffer: combined, mimeType, name };
        setMemoryCache(cacheKey, entry);
        writeDiskCache(cacheKey, combined, mimeType, name);
      } catch (err) {
        console.error('Failed serving media asset:', err);
        res.status(500).json({ error: 'Failed to retrieve media file.' });
        return;
      }
    }

    const forceDownload = req.query.download === '1' || req.query.download === 'true';
    const hasVersionQuery = typeof req.query.v === 'string';
    const safeDispName = entry.name.replace(/["\r\n]/g, '_');

    res.setHeader('Content-Type', entry.mimeType);
    res.setHeader('Content-Length', String(entry.buffer.length));
    res.setHeader(
      'Content-Disposition',
      `${forceDownload ? 'attachment' : 'inline'}; filename="${safeDispName}"`
    );
    res.setHeader(
      'Cache-Control',
      hasVersionQuery ? 'public, max-age=31536000, immutable' : 'public, max-age=3600, stale-while-revalidate=86400'
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(entry.buffer);
  });

  // 4. Delete Persistent Media Asset Endpoint (thumbs + chunks BEFORE parent for Master Gate)
  app.delete('/api/media/:assetId', async (req: Request, res: ExpressResponse) => {
    try {
      const { assetId } = req.params;
      if (!VALID_ID_REGEX.test(assetId)) {
        res.status(400).json({ error: 'Invalid media identifier.' });
        return;
      }

      const idToken = parseBearerToken(req);
      if (!idToken) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      try {
        await verifyFirebaseIdToken(idToken);
      } catch (authErr) {
        res.status(401).json({
          error: authErr instanceof Error ? authErr.message : 'Invalid authentication session.',
        });
        return;
      }

      const assetResp = await firestoreRequest(`mediaAssets/${assetId}`, 'GET', idToken);
      if (assetResp.status === 404) {
        clearAssetCache(assetId);
        res.status(200).json({ deleted: true, alreadyRemoved: true });
        return;
      }
      if (!assetResp.ok) {
        const msg = await parseFirestoreError(assetResp, 'Failed to read media asset.');
        res.status(assetResp.status).json({ error: msg });
        return;
      }

      const assetDoc = (await assetResp.json()) as { fields?: Record<string, FirestoreValue> };
      const chunkCount = readFsInt(assetDoc.fields, 'chunkCount') || 0;
      const hasThumb = Boolean(readFsString(assetDoc.fields, 'thumbMimeType'));

      if (hasThumb) {
        const delThumb = await firestoreRequest(`mediaAssets/${assetId}/thumbs/t0`, 'DELETE', idToken);
        if (delThumb.status === 403) {
          const msg = await parseFirestoreError(delThumb, 'Permission denied deleting media thumbnail.');
          res.status(403).json({ error: msg });
          return;
        }
      }

      for (let i = 0; i < chunkCount; i++) {
        const delChunk = await firestoreRequest(
          `mediaAssets/${assetId}/chunks/c${i}`,
          'DELETE',
          idToken
        );
        if (delChunk.status === 403) {
          const msg = await parseFirestoreError(delChunk, 'Permission denied deleting media chunks.');
          res.status(403).json({ error: msg });
          return;
        }
      }

      const delParent = await firestoreRequest(`mediaAssets/${assetId}`, 'DELETE', idToken);
      if (!delParent.ok && delParent.status !== 404) {
        const msg = await parseFirestoreError(delParent, 'Permission denied deleting media asset.');
        res.status(delParent.status === 403 ? 403 : 500).json({ error: msg });
        return;
      }

      clearAssetCache(assetId);
      res.status(200).json({ deleted: true, assetId });
    } catch (err) {
      console.error('Delete media asset error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unexpected server error while deleting media.',
      });
    }
  });

  // Ensure API errors (like Multer file size / unexpected file field errors) return JSON
  app.use('/api/media', (err: unknown, _req: Request, res: ExpressResponse, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'File is too large. Maximum allowed upload size is 15 MB.' });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Media API error.',
    });
  });

  const httpServer = http.createServer(app);

  if (!isProd) {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'custom',
    });

    if (hmrDisabled) {
      app.get('/@vite/client', async (_req, res, next) => {
        try {
          const transformed = await vite.transformRequest('/@vite/client');
          if (!transformed) {
            next();
            return;
          }
          const patched = transformed.code
            .replace(
              'transport.connect(createHMRHandler(handleMessage));',
              '/* HMR WebSocket disabled via DISABLE_HMR=true */'
            )
            .replace(
              'else throw new SendBeforeConnectError("send was called before connect");',
              'else return;'
            )
            .replace(
              'else throw new SendBeforeConnectError("invoke was called before connect");',
              'else return;'
            );
          res.status(200).set({ 'Content-Type': 'application/javascript; charset=utf-8' }).end(patched);
        } catch (err) {
          next(err);
        }
      });
    }

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const rawHtml = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const template = await vite.transformIndexHtml(url, rawHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist/index.html'));
    });
  }

  httpServer.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
