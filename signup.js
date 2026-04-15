  // ── Password visibility toggles ──
  function setupToggle(btnId, inputId) {
    document.getElementById(btnId).addEventListener('click', function() {
      const el = document.getElementById(inputId);
      const isText = el.type === 'text';
      el.type = isText ? 'password' : 'text';
      this.textContent = isText ? '👁' : '🙈';
    });
  }
  setupToggle('togglePw', 'password');
  setupToggle('togglePw2', 'confirmPw');

  // ── Password strength meter ──
  const colors = { 1:'#ff6b6b', 2:'#f5a623', 3:'#7c6bff', 4:'#2dd4a0' };
  const labels = { 0:'Enter a password', 1:'Weak', 2:'Fair', 3:'Good', 4:'Strong' };

  function scorePassword(pw) {
    let s = 0;
    if (pw.length >= 8)  s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }

  document.getElementById('password').addEventListener('input', function() {
    const score = this.value.length ? scorePassword(this.value) : 0;
    for (let i = 1; i <= 4; i++) {
      const seg = document.getElementById(`s${i}`);
      seg.style.background = i <= score ? colors[score] : 'var(--surface3)';
    }
    document.getElementById('strengthLabel').textContent = labels[score];
    document.getElementById('strengthLabel').style.color = score ? colors[score] : 'var(--muted)';
  });

  // ── Validation ──
  function showErr(id, errId) {
    document.getElementById(id).classList.add('error');
    document.getElementById(errId).style.display = 'block';
  }
  function clearErr(id, errId) {
    document.getElementById(id).classList.remove('error');
    document.getElementById(errId).style.display = 'none';
  }

  document.getElementById('submitBtn').addEventListener('click', function() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName  = document.getElementById('lastName').value.trim();
    const email     = document.getElementById('email').value.trim();
    const pw        = document.getElementById('password').value;
    const cpw       = document.getElementById('confirmPw').value;
    const terms     = document.getElementById('terms').checked;
    const alert     = document.getElementById('alert');
    let valid = true;

    // Reset
    ['firstName','lastName','email','password','confirmPw'].forEach(id => {
      document.getElementById(id).classList.remove('error');
    });
    ['firstNameErr','lastNameErr','emailErr','pwErr','confirmPwErr'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
    alert.style.display = 'none';

    if (!firstName) { showErr('firstName','firstNameErr'); valid = false; }
    if (!lastName)  { showErr('lastName','lastNameErr');   valid = false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr('email','emailErr'); valid = false; }
    if (pw.length < 8) { showErr('password','pwErr'); valid = false; }
    if (pw !== cpw)  { showErr('confirmPw','confirmPwErr'); valid = false; }

    if (!terms) {
      alert.className = 'alert error';
      alert.textContent = 'Please accept the terms and privacy policy to continue.';
      alert.style.display = 'block';
      valid = false;
    }

    if (!valid) return;

    // Save home currency preference
    localStorage.setItem('xchange_homeCur', document.getElementById('homeCur').value);

    // Simulate account creation (replace with real API call)
    const btn     = document.getElementById('submitBtn');
    const label   = document.getElementById('submitLabel');
    const spinner = document.getElementById('spinner');

    btn.disabled = true;
    label.textContent = 'Creating account…';
    spinner.style.display = 'block';

    setTimeout(() => {
      // ── Replace this block with your real signup API call ──
      // On success:  window.location.href = 'index.html';
      // On failure:  show alert.error with server message

      btn.disabled = false;
      label.textContent = 'Create account';
      spinner.style.display = 'none';

      // Demo: show success + redirect
      alert.className = 'alert success';
      alert.textContent = `✓ Account created for ${firstName}! Redirecting…`;
      alert.style.display = 'block';
      setTimeout(() => { window.location.href = 'index.html'; }, 1400);
    }, 1600);
  });

  // ── Google OAuth ──
  document.getElementById('googleBtn').addEventListener('click', function(e) {
    e.preventDefault();
    // TODO: initiate Google OAuth flow
    alert('Google OAuth — connect your auth provider here.');
  });

  // ── Enter key ──
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('submitBtn').click();
  });