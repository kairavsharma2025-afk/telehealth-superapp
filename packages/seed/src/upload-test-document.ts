// Logs in as the test patient and uploads a tiny PNG end-to-end through
// the public API: POST /uploads → PUT to presigned S3 URL → POST /complete.
// Used to smoke-test the doctor's Documents page without clicking through
// the mobile UI.

const GATEWAY = process.env["GATEWAY_URL"] ?? "http://localhost:4000";
const EMAIL = "patient@test.example";
const PASSWORD = "test12345";

// Minimal valid 67-byte 1x1 transparent PNG.
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

async function main() {
  // 1. Login.
  const loginRes = await fetch(`${GATEWAY}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status} ${await loginRes.text()}`);
  const { accessToken, user } = (await loginRes.json()) as {
    accessToken: string;
    user: { id: string; email: string; role: string };
  };
  console.log(`  logged in as ${user.email} (${user.role}, id=${user.id})`);

  // 2. Create upload metadata + presigned PUT URL.
  const filename = `test-document-${Date.now()}.png`;
  const createRes = await fetch(`${GATEWAY}/uploads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      filename,
      contentType: "image/png",
      sizeBytes: PNG_BYTES.length,
      category: "lab_report",
    }),
  });
  if (!createRes.ok) throw new Error(`POST /uploads failed: ${createRes.status} ${await createRes.text()}`);
  const created = (await createRes.json()) as { id: string; uploadUrl: string };
  console.log(`  upload row created: id=${created.id}`);

  // 3. PUT the bytes to the presigned URL.
  const putRes = await fetch(created.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: PNG_BYTES,
  });
  if (!putRes.ok) throw new Error(`PUT to S3 failed: ${putRes.status} ${await putRes.text()}`);
  console.log(`  bytes uploaded to S3 (${PNG_BYTES.length} bytes)`);

  // 4. Mark complete (server validates object exists in S3 with matching size).
  const completeRes = await fetch(`${GATEWAY}/uploads/${created.id}/complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!completeRes.ok) throw new Error(`POST /complete failed: ${completeRes.status} ${await completeRes.text()}`);
  const final = (await completeRes.json()) as { id: string; status: string; filename: string };
  console.log(`  marked complete: ${final.filename} (status=${final.status})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
