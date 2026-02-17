import { execFile as execFileCb, type ExecFileException } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, readFile, unlink, access } from "node:fs/promises";

export async function stripPdfPassword(
  pdfBuffer: Buffer,
  password: string
): Promise<Buffer> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `${id}_input.pdf`);
  const outputPath = join(tmpdir(), `${id}_output.pdf`);

  try {
    await writeFile(inputPath, pdfBuffer);

    await new Promise<void>((resolve, reject) => {
      execFileCb(
        "qpdf",
        [`--password=${password}`, "--decrypt", inputPath, outputPath],
        (err, _stdout, stderr) => {
          if (err) {
            const exitCode = (err as ExecFileException).code;
            // qpdf exit code 3 = warnings but operation succeeded
            if (exitCode === 3 || (typeof exitCode === "number" && exitCode === 3)) {
              resolve();
              return;
            }
            // Also check stderr — "operation succeeded with warnings" is fine
            if (stderr?.includes("operation succeeded with warnings")) {
              resolve();
              return;
            }
            reject(err);
            return;
          }
          resolve();
        }
      );
    });

    // Verify output file exists
    await access(outputPath);
    return await readFile(outputPath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("invalid password")) {
      throw new Error(
        "Invalid PDF password — check that ID_NUMBER is correct"
      );
    }
    throw new Error(`qpdf failed: ${message}`);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
