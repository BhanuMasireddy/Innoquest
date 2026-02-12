import XLSX from "xlsx";

export interface ExcelParticipant {
  name: string;
  email: string;
  team: string;
  lab: string;
}

export function parseParticipantExcel(buffer: Buffer): ExcelParticipant[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Validate headers
  const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
  const requiredHeaders = ["name", "email", "team", "lab"];

  const normalizedHeaders = headerRow.map(h => h.toLowerCase().trim());
  for (const header of requiredHeaders) {
    if (!normalizedHeaders.includes(header)) {
      throw new Error(
        `Missing required column "${header}". Expected columns: name, email, team, lab`
      );
    }
  }

  // Parse rows
  const data = XLSX.utils.sheet_to_json(worksheet) as any[];

  return data
    .map(row => ({
      name: String(row.name || "").trim(),
      email: String(row.email || "").trim().toLowerCase(),
      team: String(row.team || "").trim(),
      lab: String(row.lab || "").trim(),
    }))
    .filter(
      p =>
        p.name.length > 0 &&
        p.email.length > 0 &&
        p.team.length > 0 &&
        p.lab.length > 0
    );
}
