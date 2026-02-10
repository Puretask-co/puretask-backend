# Founder Reference: File Upload

**Candidate:** File upload (Module #36)  
**Where it lives:** `src/services/fileUploadService.ts` (uploadFile, deleteFile, validateFile, PROFILE_PHOTO_TYPES, ID_DOCUMENT_TYPES); used by cleanerOnboardingService (face photo, ID verification)  
**Why document:** How uploads (e.g. photos, documents) are stored and how URLs are generated.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The file upload service in PureTask handles storing uploaded files (profile photos, ID documents) and validating type and size before storage. **uploadFile(file, userId, folder, filename?):** writes the file to local disk under UPLOAD_DIR/folder/userId/filename (or uuid.ext if no filename), returns { url, path }. The url is a relative path like /uploads/profile-photos/{userId}/{filename} so the app can serve it or we can point to it in the DB. **validateFile(file, allowedTypes, maxSize):** checks file.size <= maxSize and file.mimetype is in allowedTypes; returns { valid, error? }. **deleteFile(filePath):** deletes the file from disk (ignores ENOENT). **Constants:** PROFILE_PHOTO_TYPES = image/jpeg, jpg, png, webp; ID_DOCUMENT_TYPES = image/jpeg, jpg, png, application/pdf. **Storage:** Today we use local filesystem (UPLOAD_DIR env or cwd/uploads); the comment says "In production, use S3 or Cloudinary." So we have one API for upload/validate/delete and a single place to swap to S3/Cloudinary later.

**Simple (like for a 10-year-old):** The file upload service is where we save uploaded files (like profile photos and ID documents) and check that they're the right type and size. We save them in a folder per user (e.g. uploads/profile-photos/user123/photo.jpg) and return a URL path so the app can show or link to the file. We validate "is it a photo or PDF?" and "is it under the size limit?" before saving. We can also delete a file by path. Right now we store on the server's disk; later we could store in S3 or Cloudinary.

### 2. Where it is used

**Technical:** `src/services/fileUploadService.ts` defines uploadFile, deleteFile, validateFile, PROFILE_PHOTO_TYPES, ID_DOCUMENT_TYPES. **Callers:** cleanerOnboardingService uses validateFile and uploadFile for face photo (profile-photos, 5MB, PROFILE_PHOTO_TYPES) and ID verification (identity-documents, 10MB, ID_DOCUMENT_TYPES). Routes that accept multipart uploads (e.g. cleanerOnboarding POST face-photo, POST id-verification) get the file from req.file (multer) and pass buffer/mimetype/size to the service. No other callers in grep except tests (fileUploadService.test, cleanerOnboardingService.test mocks it). UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"). MAX_FILE_SIZE default 10MB in validateFile.

**Simple (like for a 10-year-old):** The code lives in fileUploadService.ts. The cleaner onboarding flow uses it for the face photo and the ID document: we validate type and size then upload to profile-photos or identity-documents. The routes that handle "upload a file" get the file from the request and call this service. We can set UPLOAD_DIR in the environment; otherwise we use a folder called "uploads" under the app.

### 3. When we use it

**Technical:** We use it when a cleaner uploads a face photo (onboarding step 4) or an ID document (onboarding step 5). The route receives the file (multer), calls validateFile with the right types and size limit, then uploadFile with buffer, userId, folder, and optional filename. We use deleteFile when we need to remove a file (e.g. replace old photo—caller would upload new then delete old path if we store path in DB). Triggers: HTTP POST with multipart form and file; no cron or background job for upload itself.

**Simple (like for a 10-year-old):** We use it when a cleaner uploads their face photo or their ID document during onboarding. The app receives the file, checks it's the right type and size, then saves it and gets back a URL. We use delete when we need to remove a file (e.g. when they upload a new photo and we want to delete the old one). Nothing runs on a schedule—only when someone uploads.

### 4. How it is used

**Technical:** **uploadFile:** folderPath = UPLOAD_DIR/folder/userId; ensureUploadDir(folderPath); finalFilename = filename or uuid.ext; filePath = folderPath/finalFilename; if Buffer write fs.writeFile else pipeline(stream, writeStream); url = /uploads/folder/userId/finalFilename; return { url, path: filePath }. **validateFile:** if file.size > maxSize return { valid: false, error: "File size exceeds X MB" }; if !allowedTypes.includes(file.mimetype) return { valid: false, error: "File type not allowed..." }; return { valid: true }. **deleteFile:** fs.unlink(filePath); ignore ENOENT. Callers (onboarding): validateFile(file, PROFILE_PHOTO_TYPES, 5e6) then uploadFile(file.buffer, userId, "profile-photos", filename); or validateFile(file, ID_DOCUMENT_TYPES, 10e6) then uploadFile(..., "identity-documents", filename). The returned url is stored in cleaner_profiles.profile_photo_url or id_verifications.document_url.

**Simple (like for a 10-year-old):** To upload we build a path like uploads/profile-photos/userId/filename, create the folder if needed, write the file (from a buffer or stream), and return the URL path and the full file path. To validate we check size and that the MIME type is in the allowed list. To delete we remove the file from disk. In onboarding we validate then upload and save the URL in the database (profile photo or ID document).

### 5. How we use it (practical)

**Technical:** Set UPLOAD_DIR in env if you don't want cwd/uploads. Ensure the app serves static files from /uploads (e.g. express.static("uploads")) so the returned url works; otherwise the url is only for DB reference and you'd need to add a signed URL or proxy route. For production, replace the local write with S3/Cloudinary upload and return a public or signed URL. Logs: file_uploaded (userId, folder, filename), file_upload_failed, file_deleted, file_delete_failed. Callers must pass file with size and mimetype (and buffer or stream for upload). Multer or similar must run before the route handler so req.file is set.

**Simple (like for a 10-year-old):** We can set UPLOAD_DIR in the environment. The app has to serve the uploads folder (e.g. so /uploads/... works in the browser) or we need another way to let people see the file. For production we'd probably upload to S3 or Cloudinary and return that URL instead of a local path. We log when we upload or delete or when something fails. The route has to get the file from the request (using something like multer) and pass it to the service.

### 6. Why we use it vs other methods

**Technical:** Centralizing upload and validation in one service keeps type/size rules and storage path logic in one place. Callers (onboarding, future photo proof) just call uploadFile and validateFile with the right constants. If we later switch to S3 we change only fileUploadService. Alternatives: each route does its own write and validation (duplicated logic); store files in DB as blobs (bad for large files and serving). We chose: one service, local disk for now, clear validate-then-upload flow and constants for profile vs ID documents.

**Simple (like for a 10-year-old):** We use it so all "upload a file" and "check file type/size" logic lives in one place. Then onboarding (and any future feature that needs uploads) just calls this service. When we want to switch to S3 or Cloudinary we only change this file. If we didn't have it we'd repeat the same checks and save logic everywhere, or we'd put big files in the database which doesn't scale well.

### 7. Best practices

**Technical:** Always validate before upload (validateFile then uploadFile). Use the right constants (PROFILE_PHOTO_TYPES, ID_DOCUMENT_TYPES) and size limits (5MB profile, 10MB ID) so we don't accept huge or wrong types. Store the returned url in the DB so we can link to the file; don't store the full filesystem path in public responses. For production use S3 or Cloudinary and return a signed or public URL; set appropriate CORS and bucket policy. Don't log file contents or full paths with user data in plaintext in logs. Gaps: we don't scan for malware; we don't strip EXIF from images (privacy); we don't resize images (could add for thumbnails); static serving of /uploads must be set up separately.

**Simple (like for a 10-year-old):** We always validate first then upload. We use the right allowed types and size limits (5MB for photos, 10MB for IDs). We save the URL we return in the database so we can show or link the file. For production we'd use S3 or Cloudinary and return a proper URL. We don't log the file contents. What we could do better: we don't scan for viruses, we don't remove location data from photos, we don't make thumbnails, and something else has to serve the files at /uploads.

### 8. Other relevant info

**Technical:** uploadFile accepts Buffer or NodeJS.ReadableStream; onboarding passes file.buffer from multer. ensureUploadDir uses fs.mkdir(dir, { recursive: true }) and ignores ENOENT. The url is relative (/uploads/...) so the app must mount static or a route to serve it. For S3 we'd use the SDK, putObject or upload, and return the S3 URL or a signed URL. See FOUNDER_CLEANER_ONBOARDING for where face photo and ID upload are used. Document any new folder or allowed types when adding features (e.g. job photos).

**Simple (like for a 10-year-old):** We accept the file as a buffer or a stream; onboarding sends the buffer from the form. We create the folder if it doesn't exist. The URL we return is relative so the app has to serve that path. For S3 we'd upload there and return the S3 URL. See the onboarding doc for where we use face photo and ID upload. When we add new kinds of uploads (e.g. job photos) we should write down the folder and allowed types.

---

## Purpose and outcome (condensed)

### 9–12. Purpose, success, without it, not responsible for

**Technical:** Purpose: store uploaded files (profile photos, ID documents) and validate type/size so we have one place for upload logic and can swap storage later. Success: validateFile rejects bad type/size; uploadFile writes file and returns url; url stored in DB and can be used. Without it we'd have no central upload or validation. Not responsible for: multer or multipart parsing; serving the file at /uploads; virus scan or EXIF strip; business rules (who can upload what).

**Simple (like for a 10-year-old):** It's there to save uploads and check they're the right type and size. Success is we reject bad files and we save good ones and return a URL we can store and use. Without it we'd have no shared way to handle uploads. It doesn't parse the request (multer does), doesn't serve the file (the app does), and doesn't do virus scanning or photo cleanup—only validate and store.

---

## Inputs, outputs, flow, rules (condensed)

### 13–17. Inputs, outputs, flow, rules

**Technical:** Inputs: file (Buffer or stream), userId, folder (profile-photos | identity-documents), optional filename; for validate: file (size, mimetype), allowedTypes, maxSize. Outputs: { url, path } or { valid, error? } or void (delete). Flow: validate → upload → return url; or delete → unlink. Rules: folder is one of the two; allowedTypes and maxSize per use case (profile 5MB, ID 10MB).

**Simple (like for a 10-year-old):** We need the file, user id, folder, and maybe a filename. For validate we need the file (size and type) and the allowed types and max size. We get back a URL and path from upload, or valid/error from validate, or nothing from delete. We validate then upload; we use the right types and size for profile vs ID.

---

## Triggers through ownership (condensed)

### 18–37. Triggers, failure modes, dependencies, config, testing, recovery, stakeholders, lifecycle, state, assumptions, interaction, failure, correctness, owner, evolution

**Technical:** Triggered by callers (onboarding face photo, ID verification). Failure: disk full, permission denied, invalid type/size (validate fails). Depends on fs, path, logger, env UPLOAD_DIR. Config: UPLOAD_DIR, MAX_FILE_SIZE in code. Test: fileUploadService.test (validateFile, uploadFile with mocks). Recovery: caller handles validate error; upload failure throws. Stakeholders: product (onboarding), compliance (ID storage). No state in service. Assumptions: folder exists or we can create it; caller has buffer or stream. When not to use: for very large or streaming uploads we might need different API. Interacts with logger; onboarding uses it. Owner: platform. Evolution: S3/Cloudinary; virus scan; EXIF strip; image resize; document folder for job photos.

**Simple (like for a 10-year-old):** Onboarding (and any future upload feature) calls it. Things that can go wrong: disk full, wrong permissions, or we reject the file because of type/size. We need the filesystem and logger and optionally UPLOAD_DIR. We have tests for validate and upload. The caller handles validation errors and we throw on upload failure. Product and compliance care. We don't keep state. We assume we can create the folder and the caller gives us a buffer or stream. The platform team owns it. Later we might use S3, add virus scanning, remove photo metadata, or resize images.

---

*End of Founder Reference: File Upload*
