// Logs in as the test doctor and lists the documents the Documents page
// will render for them. Smoke check that the visibility rule picks up
// patient-owned uploads via the appointment link.

const GATEWAY = process.env["GATEWAY_URL"] ?? "http://localhost:4000";
const EMAIL = "doctor@test.example";
const PASSWORD = "test12345";

interface UploadRow {
  id: string;
  ownerUserId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  category: string | null;
  createdAt: string;
}

async function main() {
  const loginRes = await fetch(`${GATEWAY}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status}`);
  const { accessToken, user } = (await loginRes.json()) as {
    accessToken: string;
    user: { id: string };
  };
  console.log(`  doctor id: ${user.id}`);

  const listRes = await fetch(`${GATEWAY}/uploads`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) throw new Error(`GET /uploads failed: ${listRes.status} ${await listRes.text()}`);
  const { items } = (await listRes.json()) as { items: UploadRow[] };

  console.log(`  total returned: ${items.length}`);
  console.log("");
  for (const u of items.slice(0, 20)) {
    console.log(
      `    ${u.createdAt}  ${u.status.padEnd(10)} ${u.filename.padEnd(40)} ${(u.category ?? "—").padEnd(12)} ${u.sizeBytes} B`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
