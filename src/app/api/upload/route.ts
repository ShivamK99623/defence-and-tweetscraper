import { NextRequest, NextResponse } from "next/server";
import Busboy from "busboy";
import { Readable } from "node:stream";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const UPLOAD_PASSWORD = "defence-sentiment-dashboard#123";

export async function POST(req: NextRequest) {
  // Static password validation
  if (req.headers.get("x-password") !== UPLOAD_PASSWORD) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const uploadDir = path.join(process.cwd(), "data");

  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  return new Promise<Response>((resolve, reject) => {
    const bb = Busboy({
      headers: Object.fromEntries(req.headers),
      limits: {
        files: 1,
        fileSize: 5 * 1024 * 1024 * 1024, // 5GB
      },
    });

    let uploadedFile = "";

    bb.on("file", (fieldname, file, info) => {
      const filename = `${info.filename}`;
      uploadedFile = filename;

      const saveTo = path.join(uploadDir, filename);
      const writeStream = createWriteStream(saveTo);

      file.pipe(writeStream);

      writeStream.on("finish", () => {
        console.log("Upload completed");
      });

      writeStream.on("error", reject);
    });

    bb.on("field", (name, value) => {
      console.log(name, value);
    });

    bb.on("close", () => {
      resolve(
        NextResponse.json({
          success: true,
          filename: uploadedFile,
        })
      );
    });

    bb.on("error", reject);

    const nodeStream = Readable.fromWeb(req.body as any);

    nodeStream.pipe(bb);
  });
}