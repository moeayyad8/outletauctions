import { createClient } from "@supabase/supabase-js";

type UploadBody = {
  name?: string;
  contentType?: string;
  dataBase64?: string;
};

function parseBody(req: any): UploadBody {
  if (!req?.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as UploadBody;
    } catch {
      return {};
    }
  }
  if (typeof req.body === "object") {
    return req.body as UploadBody;
  }
  return {};
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

async function ensureBucket(supabase: ReturnType<typeof createClient>, bucket: string) {
  const { data } = await supabase.storage.listBuckets();
  const exists = (data ?? []).some((b) => b.name === bucket);
  if (exists) return;
  await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: "Supabase storage env vars are missing" });
    }

    const body = parseBody(req);
    const name = typeof body.name === "string" ? body.name : "upload.jpg";
    const contentType = typeof body.contentType === "string" ? body.contentType : "application/octet-stream";
    const dataBase64 = typeof body.dataBase64 === "string" ? body.dataBase64 : "";

    if (!dataBase64) {
      return res.status(400).json({ error: "Missing file data" });
    }

    const fileBuffer = Buffer.from(dataBase64, "base64");
    if (fileBuffer.length === 0) {
      return res.status(400).json({ error: "Invalid file data" });
    }

    if (fileBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "File too large. Max size is 5MB." });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "uploads";
    await ensureBucket(supabase, bucket);

    const safeName = sanitizeFilename(name);
    const objectKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;

    const uploadResult = await supabase.storage.from(bucket).upload(objectKey, fileBuffer, {
      contentType,
      upsert: false,
    });
    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const publicUrlResult = supabase.storage.from(bucket).getPublicUrl(objectKey);
    const objectPath = publicUrlResult.data.publicUrl;

    return res.status(200).json({
      uploadURL: "",
      objectPath,
      metadata: {
        name,
        size: fileBuffer.length,
        contentType,
      },
    });
  } catch (error: any) {
    console.error("Upload API error:", error);
    return res.status(500).json({
      error: "Failed to upload file",
      details: error?.message || "Unknown error",
    });
  }
}
