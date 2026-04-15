 // ── Toggle password visibility ──
  document.getElementById('togglePw').addEventListener('click', function() {
    const pw = document.getElementById('password');
    const isText = pw.type === 'text';
    pw.type = isText ? 'password' : 'text';
    this.textContent = isText ? '👁' : '🙈';
  });

  // ── Form validation & submit ──
  document.getElementById('submitBtn').addEventListener('click', function() {
    const email    = document.getElementById('email');
    const password = document.getElementById('password');
    const emailErr = document.getElementById('emailErr');
    const pwErr    = document.getElementById('pwErr');
    const alert    = document.getElementById('alert');
    let valid = true;

    // Reset errors
    [email, password].forEach(el => el.classList.remove('error'));
    [emailErr, pwErr].forEach(el => el.style.display = 'none');
    alert.style.display = 'none';

    // Validate email
    if (!email.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      email.classList.add('error');
      emailErr.style.display = 'block';
      valid = false;
    }

    // Validate password
    if (!password.value || password.value.length < 8) {
      password.classList.add('error');
      pwErr.style.display = 'block';
      valid = false;
    }

    if (!valid) return;

    // Simulate login request (replace with real auth call)
    const btn     = document.getElementById('submitBtn');
    const label   = document.getElementById('submitLabel');
    const spinner = document.getElementById('spinner');

    btn.disabled = true;
    label.textContent = 'Logging in…';
    spinner.style.display = 'block';

    setTimeout(() => {
      // ── Replace this block with your real auth API call ──
      // On success:  window.location.href = 'index.html';
      // On failure:  show alert.error with message from server

      btn.disabled = false;
      label.textContent = 'Log in';
      spinner.style.display = 'none';

      // Demo: show success and redirect after 1s
      alert.className = 'alert success';
      alert.textContent = '✓ Login successful — redirecting…';
      alert.style.display = 'block';
      setTimeout(() => { window.location.href = 'index.html'; }, 1200);
    }, 1500);
  });

  // ── Google OAuth placeholder ──
  document.getElementById('googleBtn').addEventListener('click', function(e) {
    e.preventDefault();
    // TODO: initiate Google OAuth flow
    // e.g. window.location.href = '/auth/google';
    alert('Google OAuth — connect your auth provider here.');
  });

  // ── Allow Enter key to submit ──
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('submitBtn').click();
  });