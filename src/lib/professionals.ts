import { whatsappUrl } from "./format";

export type Professional = {
  id: string;
  name: string;
  phone: string;
  active: boolean;
};

export const DEFAULT_PROFESSIONALS: Professional[] = [
  { id: "professional-1", name: "Tiago", phone: "5531982368541", active: true },
  { id: "professional-2", name: "Heitor", phone: "553192531495", active: true },
];

const STORAGE_KEY = "motocar-professionals-v1";

export function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length > 2 && digits.startsWith("55")) return digits;
  if (digits.length === 11) return `55${digits}`;
  return digits;
}

export function isValidWhatsAppNumber(value: string) {
  const normalized = normalizeWhatsAppNumber(value);
  return normalized.length >= 12 && /^55\d{10,11}$/.test(normalized);
}

export function readProfessionals(): Professional[] {
  if (typeof window === "undefined") return DEFAULT_PROFESSIONALS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      writeProfessionals(DEFAULT_PROFESSIONALS);
      return DEFAULT_PROFESSIONALS;
    }

    const parsed = JSON.parse(raw) as Professional[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      writeProfessionals(DEFAULT_PROFESSIONALS);
      return DEFAULT_PROFESSIONALS;
    }

    const stored = parsed.map((professional, index) => ({
      id: professional.id || `professional-${index + 1}`,
      name: professional.name || `Profissional ${index + 1}`,
      phone: normalizeWhatsAppNumber(professional.phone || ""),
      active: professional.active !== false,
    }));

    const migrated = stored.map((professional, index) => {
      const defaultProfessional = DEFAULT_PROFESSIONALS[index];
      const legacyName = `Profissional ${index + 1}`;
      if (
        defaultProfessional &&
        professional.id === defaultProfessional.id &&
        professional.name === legacyName
      ) {
        return { ...defaultProfessional, active: professional.active };
      }
      return professional;
    });

    for (const defaultProfessional of DEFAULT_PROFESSIONALS) {
      if (!migrated.some((professional) => professional.id === defaultProfessional.id)) {
        migrated.push(defaultProfessional);
      }
    }

    if (JSON.stringify(stored) !== JSON.stringify(migrated)) writeProfessionals(migrated);
    return migrated;
  } catch {
    writeProfessionals(DEFAULT_PROFESSIONALS);
    return DEFAULT_PROFESSIONALS;
  }
}

export function writeProfessionals(professionals: Professional[]) {
  if (typeof window === "undefined") return;

  const normalized = professionals.map((professional, index) => ({
    id: professional.id || `professional-${index + 1}`,
    name: professional.name || `Profissional ${index + 1}`,
    phone: normalizeWhatsAppNumber(professional.phone || ""),
    active: professional.active !== false,
  }));

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function getActiveProfessionals() {
  return readProfessionals().filter(
    (professional) => professional.active && isValidWhatsAppNumber(professional.phone),
  );
}

export function professionalWhatsAppUrl(professional: Professional, message: string) {
  if (!professional.active || !isValidWhatsAppNumber(professional.phone)) return null;
  return whatsappUrl(normalizeWhatsAppNumber(professional.phone), message);
}
