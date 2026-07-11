import type { Request, Response } from "express";
import Busboy from "busboy";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { AppError } from "../middleware/error-handler";

const UPLOAD_PASSWORD = "defence-sentiment-dashboard#123";

export async function uploadFile(req: Request, res: Response): Promise<void> {
  if (req.headers["x-password"] !== UPLOAD_PASSWORD) {
    throw new AppError(401, "Unauthorized");
  }

  const uploadDir = path.join(process.cwd(), "data");
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  await new Promise<void>((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: 5 * 1024 * 1024 * 1024,
      },
    });

    let uploadedFile = "";

    bb.on("file", (_fieldname, file, info) => {
      uploadedFile = info.filename;
      const saveTo = path.join(uploadDir, info.filename);
      const writeStream = createWriteStream(saveTo);
      file.pipe(writeStream);
      writeStream.on("error", reject);
    });

    bb.on("close", () => {
      res.json({ success: true, filename: uploadedFile });
      resolve();
    });

    bb.on("error", reject);
    req.pipe(bb);
  });
}
