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

type ExistingPerson = {
  id: string;
  profile_id: string | null;
  email: string | null;
  reference_number: string | null;
};

type CsvRow = Record<string, string | number> & {
  _row: number;
};

function parseCsvLine(line: string): string[] {
  const output: string[] = [];
  let quoted = false;
  let value = "";

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      output.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  output.push(value.trim());
  return output;
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

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function buildReference(
  personType: string,
  value: unknown,
  rowNumber: number
): string {
  const reference = normalizeText(value);

  if (reference) return reference;

  if (personType === "student") {
    throw new Error(
      `Row ${rowNumber}: student reference_number is required`
    );
  }

  return `USR-${Date.now().toString(36).toUpperCase()}-${rowNumber}`;
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<any | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 20; page += 1) {
    const result = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (result.error) {
      throw result.error;
    }

    const users = (result.data.users ?? []) as any[];
    const match = users.find(
      (user: any) =>
        String(user.email ?? "").trim().toLowerCase() === normalizedEmail
    );

    if (match) return match;
    if (users.length < perPage) break;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireProfile(["admin", "regcom", "vip"]);
    const formData = await req.formData();
    const file = formData.get("file");

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
      header.trim().toLowerCase()
    );

    for (const requiredColumn of [
      "full_name",
      "email",
      "person_type",
      "role",
    ]) {
      if (!headers.includes(requiredColumn)) {
        return NextResponse.json(
          { error: `Missing required column: ${requiredColumn}` },
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
        const row: CsvRow = { _row: index + 2 };

        headers.forEach((header, columnIndex) => {
          row[header] = values[columnIndex]?.trim() || "";
        });

        return row;
      })
      .filter((row) => row.full_name || row.email);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "The CSV contains no valid user rows." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const [
      collegeQuery,
      degreeQuery,
      programQuery,
      existingDirectoryQuery,
    ] = await Promise.all([
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
      admin
        .from("people_directory")
        .select("id,profile_id,email,reference_number")
        .eq("organization_id", profile.organization_id),
    ]);

    if (
      collegeQuery.error ||
      degreeQuery.error ||
      programQuery.error ||
      existingDirectoryQuery.error
    ) {
      throw new Error(
        collegeQuery.error?.message ||
          degreeQuery.error?.message ||
          programQuery.error?.message ||
          existingDirectoryQuery.error?.message ||
          "Unable to load import reference data."
      );
    }

    const byName = (items: any[]) =>
      new Map(
        items.map((item) => [
          String(item.name ?? "").trim().toLowerCase(),
          item,
        ])
      );

    const collegeMap = byName(collegeQuery.data || []);
    const degreeMap = byName(degreeQuery.data || []);
    const programMap = byName(programQuery.data || []);

    const existingByEmail = new Map<string, ExistingPerson>();
    const existingByReference = new Map<string, ExistingPerson>();

    for (const person of (
      existingDirectoryQuery.data ?? []
    ) as ExistingPerson[]) {
      const storedEmail = normalizeEmail(person.email);
      const storedReference = normalizeText(person.reference_number);

      if (storedEmail) existingByEmail.set(storedEmail, person);
      if (storedReference) {
        existingByReference.set(storedReference, person);
      }
    }

    const seenEmails = new Set<string>();
    const seenReferences = new Set<string>();

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const rowErrors: Array<{ row: number; message: string }> = [];

    for (const row of rows) {
      const rowNumber = Number(row._row);

      try {
        const fullName = normalizeText(row.full_name);
        const personType = normalizeText(row.person_type).toLowerCase();
        const primaryRole = normalizeText(row.role).toLowerCase();
        const email = normalizeEmail(row.email);
        const reference = buildReference(
          personType,
          row.reference_number,
          rowNumber
        );

        if (!fullName) {
          throw new Error("full_name is required");
        }

        if (!VALID_TYPES.includes(personType)) {
          throw new Error(`invalid person_type '${personType}'`);
        }

        if (!VALID_ROLES.includes(primaryRole)) {
          throw new Error(`invalid role '${primaryRole}'`);
        }

        if (personType === "student") {
          if (!email) {
            throw new Error("email is required for students");
          }

          if (!normalizeText(row.college)) {
            throw new Error("college is required for students");
          }

          if (!normalizeText(row.degree)) {
            throw new Error("degree is required for students");
          }

          if (!normalizeText(row.program)) {
            throw new Error("program is required for students");
          }

          if (!normalizeText(row.gender)) {
            throw new Error("gender is required for students");
          }
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

        const additionalRoles = normalizeText(row.additional_roles)
          .split(/[|;]/)
          .map((role) => role.trim().toLowerCase())
          .filter(Boolean);

        for (const role of additionalRoles) {
          if (!VALID_ROLES.includes(role)) {
            throw new Error(`invalid additional role '${role}'`);
          }
        }

        const collegeName = normalizeText(row.college).toLowerCase();
        const degreeName = normalizeText(row.degree).toLowerCase();
        const programName = normalizeText(row.program).toLowerCase();

        const college = collegeName ? collegeMap.get(collegeName) : null;
        const degree = degreeName ? degreeMap.get(degreeName) : null;
        const program = programName ? programMap.get(programName) : null;

        if (collegeName && !college) {
          throw new Error(
            `college '${row.college}' does not match Settings`
          );
        }

        if (degreeName && !degree) {
          throw new Error(
            `degree '${row.degree}' does not match Settings`
          );
        }

        if (programName && !program) {
          throw new Error(
            `program '${row.program}' does not match Settings`
          );
        }

        if (program && college && program.college_id !== college.id) {
          throw new Error(
            "program does not belong to the selected college"
          );
        }

        if (program && degree && program.degree_level_id !== degree.id) {
          throw new Error(
            "program does not belong to the selected degree"
          );
        }

        const existingFromEmail = email
          ? existingByEmail.get(email)
          : undefined;
        const existingFromReference = existingByReference.get(reference);

        if (
          existingFromEmail &&
          existingFromReference &&
          existingFromEmail.id !== existingFromReference.id
        ) {
          throw new Error(
            `email '${email}' belongs to reference ` +
              `'${existingFromEmail.reference_number}', while reference ` +
              `'${reference}' belongs to another person`
          );
        }

        const existingPerson =
          existingFromEmail ?? existingFromReference ?? null;

        let profileId: string | null =
          existingPerson?.profile_id ?? null;

        if (isYes(row.create_login)) {
          if (!email) {
            throw new Error(
              "email is required when create_login=yes"
            );
          }

          if (!row.password || String(row.password).length < 8) {
            throw new Error(
              "password must be at least 8 characters"
            );
          }

          if (!profileId) {
            const created = await admin.auth.admin.createUser({
              email,
              password: String(row.password),
              email_confirm: true,
              user_metadata: { full_name: fullName },
            });

            if (created.error) {
              if (
                created.error.message.toLowerCase().includes("already")
              ) {
                const authUser = await findAuthUserByEmail(admin, email);

                if (!authUser) {
                  throw new Error(
                    "authentication user already exists but could not be resolved"
                  );
                }

                profileId = authUser.id;
              } else {
                throw created.error;
              }
            } else {
              profileId = created.data.user.id;
            }
          }

          const profileUpsert = await admin.from("profiles").upsert(
            {
              id: profileId,
              organization_id: profile.organization_id,
              email,
              full_name: fullName,
              role: primaryRole,
              person_type: personType,
              reference_number: reference,
              phone: normalizeText(row.phone) || null,
              active: true,
            },
            { onConflict: "id" }
          );

          if (profileUpsert.error) {
            throw profileUpsert.error;
          }
        }

        const payload = {
          organization_id: profile.organization_id,
          profile_id: profileId,
          email,
          full_name: fullName,
          person_type: personType,
          role: primaryRole,
          reference_number: reference,
          college_id: college?.id || null,
          degree_level_id:
            personType === "student" ? degree?.id || null : null,
          program_id:
            personType === "student" ? program?.id || null : null,
          phone: normalizeText(row.phone) || null,
          gender: normalizeText(row.gender) || null,
          active: true,
        };

        let savedPerson: ExistingPerson;

        if (existingPerson) {
          const update = await admin
            .from("people_directory")
            .update(payload)
            .eq("id", existingPerson.id)
            .select("id,profile_id,email,reference_number")
            .single();

          if (update.error) throw update.error;

          savedPerson = update.data as ExistingPerson;
          updated += 1;
        } else {
          const insert = await admin
            .from("people_directory")
            .insert(payload)
            .select("id,profile_id,email,reference_number")
            .single();

          if (insert.error) throw insert.error;

          savedPerson = insert.data as ExistingPerson;
          inserted += 1;
        }

        const savedEmail = normalizeEmail(savedPerson.email);
        const savedReference = normalizeText(
          savedPerson.reference_number
        );

        if (savedEmail) existingByEmail.set(savedEmail, savedPerson);
        if (savedReference) {
          existingByReference.set(savedReference, savedPerson);
        }

        if (profileId) {
          const allRoles = Array.from(
            new Set([primaryRole, ...additionalRoles])
          );

          const deleteRoles = await admin
            .from("profile_roles")
            .delete()
            .eq("profile_id", profileId);

          if (deleteRoles.error) throw deleteRoles.error;

          if (allRoles.length > 0) {
            const rolesInsert = await admin
              .from("profile_roles")
              .insert(
                allRoles.map((role) => ({
                  organization_id: profile.organization_id,
                  profile_id: profileId,
                  role,
                }))
              );

            if (rolesInsert.error) throw rolesInsert.error;
          }
        }
      } catch (rowError: any) {
        rowErrors.push({
          row: rowNumber,
          message: rowError?.message || "Unknown row import error",
        });
      }
    }

    return NextResponse.json({
      ok: rowErrors.length === 0,
      imported: inserted + updated,
      inserted,
      updated,
      skipped,
      failed: rowErrors.length,
      processed: inserted + updated + skipped + rowErrors.length,
      errors: rowErrors.slice(0, 50),
      message:
        `Import completed: ${inserted} inserted, ` +
        `${updated} updated, ${skipped} skipped, ` +
        `${rowErrors.length} failed.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Import failed" },
      { status: 400 }
    );
  }
}