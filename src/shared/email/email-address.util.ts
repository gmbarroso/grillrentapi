const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmailAddress = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

export const isValidEmailAddress = (value: string): boolean => EMAIL_REGEX.test(value);

export const composeFromHeader = (fromName: string | null | undefined, fromEmail: string | null): string | null => {
  if (!fromEmail) return null;
  const normalizedName = fromName?.trim() || '';
  if (!normalizedName) return fromEmail;
  return `${normalizedName} <${fromEmail}>`;
};
