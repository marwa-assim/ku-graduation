import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";

const VALID_ROLES = [
  "student",
  "admin",
  "scanner",
  "regcom",
  "vip",
  "land",
  "finance",
  "tailor",
  "photographer",
  "academic_staff",
];

const VALID_TYPES = [
  "student",
  "academic_staff",
  "administrative_staff",
  "guest",
  "vip",
];

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let quoted = false;
  let value = "";

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      out.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }

  out.push(value.trim());
  return out;
}

function isYes(value: unknown): boolean {
  return ["yes", "true", "1", "y"].includes(
    String(value ?? "").trim().toLowerCase()
  );
}

function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return email || null;
}

function buildReference(
  personType: string,
  value: unknown,
  rowNumber: number
): string {
  const reference = String(value ?? "").trim();

  if (reference) return reference;

  if (personType === "student") {
    throw new Error(
      `Row ${rowNumber}: student reference_number is required`
    );
  }

  return `USR-${Date.now().toString(36).toUpperCase()}-${rowNumber}`;
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireProfile(["admin", "regcom", "vip"]);
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose a CSV file." },
        { status: 400 }
      );
    }

    const lines = (await file.text())
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "The CSV contains no user rows." },
        { status: 400 }
      );
    }

    const headers = parseCsvLine(lines[0]).map((header) =>
      header.toLowerCase()
    );

    for (const required of [
      "full_name",
      "email",
      "person_type",
      "role",
    ]) {
      if (!headers.includes(required)) {
        return NextResponse.json(
          { error: `Missing required column: ${required}` },
          { status: 400 }
        );
      }
    }

    const rows = lines
      .slice(1)
      .filter(
        (line) =>
          !line.startsWith('"VALID VALUES') &&
          !line.startsWith('"person_type:') &&
          !line.startsWith('"role/') &&
          !line.startsWith('"additional_roles:') &&
          !line.startsWith('"college,') &&
          !line.startsWith('"Available ') &&
          !line.startsWith('"Student reference') &&
          !line.startsWith('"password ')
      )
      .map((line, index) => {
        const values = parseCsvLine(line);
        const row: Record<string, string | number> = {};

        headers.forEach((header, columnIndex) => {
          row[header] = values[columnIndex]?.trim() || "";
        });

        row._row = index + 2;
        return row;
      })
      .filter((row) => row.full_name || row.email);

    const admin = createAdminClient();

    const [collegeQuery, degreeQuery, programQuery] = await Promise.all([
      admin
        .from("colleges")
        .select("id,name")
        .eq("organization_id", profile.organization_id),
      admin
        .from("degree_levels")
        .select("id,name")
        .eq("organization_id", profile.organization_id),
      admin
        .from("academic_programs")
        .select("id,name,college_id,degree_level_id")
        .eq("organization_id", profile.organization_id),
    ]);

    if (collegeQuery.error || degreeQuery.error || programQuery.error) {
      throw new Error(
        collegeQuery.error?.message ||
          degreeQuery.error?.message ||
          programQuery.error?.message
      );
    }

    const byName = (items: any[]) =>
      new Map(
        items.map((item) => [
          String(item.name).trim().toLowerCase(),
          item,
        ])
      );

    const collegeMap = byName(collegeQuery.data || []);
    const degreeMap = byName(degreeQuery.data || []);
    const programMap = byName(programQuery.data || []);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // Prevent duplicate rows inside the same CSV file.
    const seenEmails = new Set<string>();
    const seenReferences = new Set<string>();

    for (const row of rows as any[]) {
      const rowNumber = Number(row._row);
      const email = normalizeEmail(row.email);
      const reference = buildReference(
        row.person_type,
        row.reference_number,
        rowNumber
      );

      if (!row.full_name) {
        throw new Error(`Row ${rowNumber}: full_name is required`);
      }

      if (!VALID_TYPES.includes(row.person_type)) {
        throw new Error(
          `Row ${rowNumber}: invalid person_type '${row.person_type}'`
        );
      }

      if (!VALID_ROLES.includes(row.role)) {
        throw new Error(
          `Row ${rowNumber}: invalid role '${row.role}'`
        );
      }

      if (email && seenEmails.has(email)) {
        skipped += 1;
        continue;
      }

      if (seenReferences.has(reference)) {
        skipped += 1;
        continue;
      }

      if (email) seenEmails.add(email);
      seenReferences.add(reference);

      const additionalRoles = String(row.additional_roles || "")
        .split(/[|;]/)
        .map((role) => role.trim())
        .filter(Boolean);

      for (const role of additionalRoles) {
        if (!VALID_ROLES.includes(role)) {
          throw new Error(
            `Row ${rowNumber}: invalid additional role '${role}'`
          );
        }
      }

      const college = row.college
        ? collegeMap.get(String(row.college).toLowerCase())
        : null;
      const degree = row.degree
        ? degreeMap.get(String(row.degree).toLowerCase())
        : null;
      const program = row.program
        ? programMap.get(String(row.program).toLowerCase())
        : null;

      if (row.college && !college) {
        throw new Error(
          `Row ${rowNumber}: college '${row.college}' does not match Settings`
        );
      }

      if (row.degree && !degree) {
        throw new Error(
          `Row ${rowNumber}: degree '${row.degree}' does not match Settings`
        );
      }

      if (row.program && !program) {
        throw new Error(
          `Row ${rowNumber}: program '${row.program}' does not match Settings`
        );
      }

      if (program && college && program.college_id !== college.id) {
        throw new Error(
          `Row ${rowNumber}: program does not belong to the selected college`
        );
      }

      if (program && degree && program.degree_level_id !== degree.id) {
        throw new Error(
          `Row ${rowNumber}: program does not belong to the selected degree`
        );
      }

      // Match an existing directory record by reference OR email.
      let existingQuery = admin
        .from("people_directory")
        .select("id,profile_id,email,reference_number")
        .eq("organization_id", profile.organization_id)
        .eq("reference_number", reference)
        .maybeSingle();

      let existing = await existingQuery;

      if (!existing.data && email) {
        existing = await admin
          .from("people_directory")
          .select("id,profile_id,email,reference_number")
          .eq("organization_id", profile.organization_id)
          .ilike("email", email)
          .maybeSingle();
      }

      if (existing.error) {
        throw new Error(`Row ${rowNumber}: ${existing.error.message}`);
      }

      let profileId: string | null = existing.data?.profile_id ?? null;

      if (isYes(row.create_login)) {
        if (!email) {
          throw new Error(
            `Row ${rowNumber}: email is required when create_login=yes`
          );
        }

        if (!row.password || String(row.password).length < 8) {
          throw new Error(
            `Row ${rowNumber}: password must be at least 8 characters`
          );
        }

        if (!profileId) {
          const created = await admin.auth.admin.createUser({
            email,
            password: String(row.password),
            email_confirm: true,
            user_metadata: { full_name: row.full_name },
          });

          if (created.error) {
            // Existing Auth user should not cause the whole row to be skipped.
            if (created.error.message.toLowerCase().includes("already")) {
              const users = await admin.auth.admin.listUsers({
                page: 1,
                perPage: 1000,
              });

              if (users.error) {
                throw new Error(
                  `Row ${rowNumber}: ${users.error.message}`
                );
              }

              const authUser = (users.data.users as any[]).find(
                (user: any) =>
                 String(user.email ?? "").trim().toLowerCase() === email
               );

              if (!authUser) {
                throw new Error(
                  `Row ${rowNumber}: authentication user already exists but could not be resolved`
                );
              }

              profileId = authUser.id;
            } else {
              throw new Error(
                `Row ${rowNumber}: ${created.error.message}`
              );
            }
          } else {
            profileId = created.data.user.id;
          }
        }

        const profileUpsert = await admin.from("profiles").upsert({
          id: profileId,
          organization_id: profile.organization_id,
          email,
          full_name: row.full_name,
          role: row.role,
          person_type: row.person_type,
          reference_number: reference,
          phone: row.phone || null,
          active: true,
        });

        if (profileUpsert.error) {
          throw new Error(
            `Row ${rowNumber}: ${profileUpsert.error.message}`
          );
        }
      }

      const payload = {
        organization_id: profile.organization_id,
        profile_id: profileId,
        email,
        full_name: row.full_name,
        person_type: row.person_type,
        role: row.role,
        reference_number: reference,
        college_id: college?.id || null,
        degree_level_id:
          row.person_type === "student" ? degree?.id || null : null,
        program_id:
          row.person_type === "student" ? program?.id || null : null,
        phone: row.phone || null,
        gender: row.gender || null,
        active: true,
      };

      if (existing.data) {
        const update = await admin
          .from("people_directory")
          .update(payload)
          .eq("id", existing.data.id);

        if (update.error) {
          throw new Error(
            `Row ${rowNumber}: ${update.error.message}`
          );
        }

        updated += 1;
      } else {
        const insert = await admin
          .from("people_directory")
          .insert(payload);

        if (insert.error) {
          throw new Error(
            `Row ${rowNumber}: ${insert.error.message}`
          );
        }

        inserted += 1;
      }

      if (profileId) {
        const allRoles = [
          row.role,
          ...additionalRoles.filter(
            (role: string) => role !== row.role
          ),
        ];

        const deleteRoles = await admin
          .from("profile_roles")
          .delete()
          .eq("profile_id", profileId);

        if (deleteRoles.error) {
          throw new Error(
            `Row ${rowNumber}: ${deleteRoles.error.message}`
          );
        }

        const rolesInsert = await admin.from("profile_roles").insert(
          allRoles.map((role: string) => ({
            organization_id: profile.organization_id,
            profile_id: profileId,
            role,
          }))
        );

        if (rolesInsert.error) {
          throw new Error(
            `Row ${rowNumber}: ${rolesInsert.error.message}`
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      skipped,
      processed: inserted + updated + skipped,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Import failed" },
      { status: 400 }
    );
  }
}