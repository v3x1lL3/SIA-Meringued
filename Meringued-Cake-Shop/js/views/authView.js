// Auth view: minimal helpers to interact with the existing auth modal.

export function getLoginFormValues() {
  const email = document.getElementById('loginEmail')?.value.trim() || '';
  const password = document.getElementById('loginPassword')?.value || '';
  return { email, password };
}

export function getSignupFormValues() {
  const fullName = document.getElementById('signupName')?.value.trim() || '';
  const email = document.getElementById('signupEmail')?.value.trim() || '';
  const password = document.getElementById('signupPassword')?.value || '';
  const confirmPassword =
    document.getElementById('signupConfirmPassword')?.value || '';

  return { fullName, email, password, confirmPassword };
}

export function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('active');
}

