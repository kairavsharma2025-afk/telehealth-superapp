import { test, expect } from "@playwright/test";
import { registerUser, bookAppointment, getAppointment } from "./fixtures";

test.describe("web-doctor: appointment workflow", () => {
  test("doctor can sign in, see a patient's booking, and confirm it", async ({ page }) => {
    // ---- arrange (via API) ----
    const doctor = await registerUser("doctor");
    const patient = await registerUser("patient");

    const appt = await bookAppointment(patient.accessToken, doctor.user.id, {
      reason: "e2e: routine checkup",
    });
    expect(appt.status).toBe("scheduled");

    // ---- sign in via UI ----
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Doctor sign-in" })).toBeVisible();

    await page.getByLabel("Email").fill(doctor.user.email);
    await page.getByLabel("Password").fill(doctor.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // ---- dashboard renders the seeded appointment ----
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible();

    const row = page.locator("li.row", { hasText: "e2e: routine checkup" });
    await expect(row).toBeVisible();
    await expect(row.locator(".pill")).toHaveText("scheduled");

    // ---- confirm ----
    await row.getByRole("button", { name: "Confirm" }).click();
    await expect(row.locator(".pill")).toHaveText("confirmed");

    // verify backend agrees
    const afterConfirm = await getAppointment(doctor.accessToken, appt.id);
    expect(afterConfirm.status).toBe("confirmed");

    // ---- complete ----
    await row.getByRole("button", { name: "Complete" }).click();
    await expect(row.locator(".pill")).toHaveText("completed");

    const afterComplete = await getAppointment(doctor.accessToken, appt.id);
    expect(afterComplete.status).toBe("completed");

    // no transition buttons remain
    await expect(row.getByRole("button", { name: "Confirm" })).toHaveCount(0);
    await expect(row.getByRole("button", { name: "Complete" })).toHaveCount(0);
    await expect(row.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  });

  test("invalid credentials show an error and stay on /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@e2e.example");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.locator(".error")).toContainText("Invalid credentials");
    await expect(page).toHaveURL(/\/login/);
  });

  test("patient role is denied at the doctor dashboard", async ({ page }) => {
    const patient = await registerUser("patient");

    await page.goto("/login");
    await page.getByLabel("Email").fill(patient.user.email);
    await page.getByLabel("Password").fill(patient.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.locator(".centered")).toContainText(/Access denied/i);
  });
});
