export const PASSWORD_MIN_LENGTH = 8;

export function isValidEmail(email) {
  return typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email);
}

export function isStrongPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= PASSWORD_MIN_LENGTH &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

export function isValidPhone(phone) {
  return typeof phone !== 'string' || /^[0-9+\-\s]{6,15}$/.test(phone);
}
