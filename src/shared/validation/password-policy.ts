export const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])(?=\S+$).{8,100}$/;

export const PASSWORD_POLICY_MESSAGE =
  'Password must have at least 8 chars, one uppercase letter, one number, and one special character';
