function loginView(app) {
  let signup = false;
  document.title = 'Log in · repairhub';
  app.innerHTML = `
  <div class="login-wrap">
    <div class="logo"><span class="mark">⌁</span>repairhub</div>
    <h1 style="margin:.3rem 0 .4rem">Find the right repair shop.</h1>
    <p class="muted" style="margin-bottom:1.2rem">Search any device or vehicle, see who repairs it, check availability, then book and pay.</p>
    <section class="panel">
      <h2 id="lt" style="font-size:1.1rem">Log in</h2>
      <form id="lf" style="margin-top:.8rem">
        <div class="field" id="nameRow" hidden><label for="name">Name</label><input id="name" autocomplete="name"></div>
        <div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email"></div>
        <div class="field"><label for="password">Password</label><input id="password" type="password" autocomplete="current-password"></div>
        <div class="field" id="roleRow" hidden><label for="role">I am a</label>
          <select id="role"><option value="customer">Customer looking for repairs</option><option value="owner">Shop owner</option></select></div>
        <button class="btn primary block" id="go">Log in</button>
      </form>
      <p style="margin-top:1rem"><a href="#" id="swap">New here? Create an account</a></p>
    </section>
    <p class="muted small">Demo logins, password <span class="mono">password123</span>: <span class="mono">customer@demo.com</span>, <span class="mono">owner4@demo.com</span></p>
  </div>`;
  const $ = (id) => document.getElementById(id);
  $('swap').onclick = (e) => {
    e.preventDefault(); signup = !signup;
    $('lt').textContent = $('go').textContent = signup ? 'Create account' : 'Log in';
    $('nameRow').hidden = $('roleRow').hidden = !signup;
    $('swap').textContent = signup ? 'Already have an account? Log in' : 'New here? Create an account';
  };
  $('lf').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const body = { email: $('email').value, password: $('password').value };
      if (signup) { body.name = $('name').value; body.role = $('role').value; }
      const d = await api(signup ? '/auth/register' : '/auth/login', { method: 'POST', body });
      Auth.save(d); await loadMeta(); renderHeader();
      location.hash = d.user.role === 'owner' ? '#/dashboard' : '#/';
    } catch (err) { toast(err.message, true); }
  };
}
