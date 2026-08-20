(() => {
  const header = document.querySelector('[data-header]');
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  const loginDialog = document.querySelector('[data-login-dialog]');
  const signupDialog = document.querySelector('[data-signup-dialog]');
  const loginButtons = document.querySelectorAll('[data-login-open]');
  const signupButtons = document.querySelectorAll('[data-signup-open]');
  const loginForm = document.querySelector('[data-login-form]');
  const signupForm = document.querySelector('[data-signup-form]');
  const loginMessage = document.querySelector('[data-login-message]');
  const signupMessage = document.querySelector('[data-signup-message]');

  const updateHeader = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 24);
  };

  const closeMenu = () => {
    menu?.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  };

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  menuToggle?.addEventListener('click', () => {
    const willOpen = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(willOpen));
    menu?.classList.toggle('is-open', willOpen);
    document.body.classList.toggle('menu-open', willOpen);
  });

  menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

  const closeDialog = (dialog) => {
    if (dialog?.open) dialog.close();
  };

  const showDialog = (dialog) => {
    closeMenu();
    if (dialog && typeof dialog.showModal === 'function' && !dialog.open) {
      dialog.showModal();
      window.setTimeout(() => dialog.querySelector('input')?.focus(), 80);
    }
  };

  const openProtectedArea = () => {
    window.location.href = 'app.html';
  };

  const openLogin = async () => {
    try { await BT.auth?.ready?.(); }
    catch (error) { loginMessage.textContent = error.message; }
    BT.auth?.isAuthenticated() ? openProtectedArea() : showDialog(loginDialog);
  };
  const openSignup = async () => {
    try { await BT.auth?.ready?.(); }
    catch (error) { signupMessage.textContent = error.message; }
    BT.auth?.isAuthenticated() ? openProtectedArea() : showDialog(signupDialog);
  };

  loginButtons.forEach((button) => button.addEventListener('click', openLogin));
  signupButtons.forEach((button) => button.addEventListener('click', openSignup));
  document.querySelector('[data-login-close]')?.addEventListener('click', () => closeDialog(loginDialog));
  document.querySelector('[data-signup-close]')?.addEventListener('click', () => closeDialog(signupDialog));

  document.querySelector('[data-switch-signup]')?.addEventListener('click', () => {
    closeDialog(loginDialog);
    showDialog(signupDialog);
  });

  document.querySelector('[data-switch-login]')?.addEventListener('click', () => {
    closeDialog(signupDialog);
    showDialog(loginDialog);
  });

  const closeOnBackdrop = (dialog, event) => {
    const bounds = dialog.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) dialog.close();
  };

  loginDialog?.addEventListener('click', (event) => closeOnBackdrop(loginDialog, event));
  signupDialog?.addEventListener('click', (event) => closeOnBackdrop(signupDialog, event));

  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;
      const willShow = input.type === 'password';
      input.type = willShow ? 'text' : 'password';
      input.classList.toggle('password-input-visible', willShow);
      button.textContent = willShow ? 'Masquer' : 'Voir';
      button.setAttribute('aria-pressed', String(willShow));
      button.setAttribute('aria-label', willShow ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    });
  });

  const resetPasswordVisibility = (form) => form?.querySelectorAll('[data-password-toggle]').forEach((button) => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (input) { input.type = 'password'; input.classList.remove('password-input-visible'); }
    button.textContent = 'Voir'; button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', 'Afficher le mot de passe');
  });

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginMessage.textContent = '';
    loginMessage.classList.remove('is-info');
    if (!loginForm.checkValidity()) {
      loginForm.reportValidity();
      return;
    }
    const submit = loginForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await BT.auth.signIn({
        email: loginForm.elements.email.value,
        password: loginForm.elements.password.value,
        remember: loginForm.elements.remember.checked
      });
      window.location.href = 'app.html';
    } catch (error) {
      loginMessage.textContent = error.message || 'Connexion impossible.';
      submit.disabled = false;
    }
  });

  signupForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    signupMessage.textContent = '';
    signupMessage.classList.remove('is-info', 'is-confirmation');
    if (!signupForm.checkValidity()) {
      signupForm.reportValidity();
      return;
    }
    if (signupForm.elements.password.value !== signupForm.elements.confirm.value) {
      signupMessage.textContent = 'Les deux mots de passe ne correspondent pas.';
      signupForm.elements.confirm.focus();
      return;
    }
    const submit = signupForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const account = await BT.auth.createAccount({
        name: signupForm.elements.name.value,
        email: signupForm.elements.email.value,
        password: signupForm.elements.password.value
      });
      if (account.requiresEmailConfirmation) {
        signupMessage.textContent = `Votre sentier attend son premier pas. Un lien vient d’être envoyé à ${account.email}. Ouvrez votre boîte mail, validez votre adresse, puis revenez vous connecter à BOO-P. Pensez aussi aux courriers indésirables.`;
        signupMessage.classList.add('is-info', 'is-confirmation');
        signupForm.reset();
        resetPasswordVisibility(signupForm);
        submit.disabled = false;
        return;
      }
      window.location.href = 'onboarding.html';
    } catch (error) {
      signupMessage.textContent = error.message || 'Création du compte impossible.';
      submit.disabled = false;
    }
  });

  async function initializeAuthUI() {
    try {
      await BT.auth?.ready?.();
    } catch (error) {
      loginMessage.textContent = error.message || 'Le service de connexion est indisponible.';
      signupMessage.textContent = loginMessage.textContent;
    }

    if (BT.auth?.isAuthenticated()) {
      loginButtons.forEach(button => { button.textContent = 'Ouvrir l’application'; });
      signupButtons.forEach(button => { button.textContent = 'Continuer mon sentier'; });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedAuth = params.get('auth');
    if (requestedAuth === 'signup') showDialog(signupDialog);
    if (requestedAuth === 'login') {
      if (params.get('reason') === 'protected') {
        loginMessage.textContent = 'Connectez-vous pour accéder à votre espace de lecture.';
        loginMessage.classList.add('is-info');
      }
      showDialog(loginDialog);
    }
    if (window.location.protocol === 'file:' && requestedAuth) {
      const message = requestedAuth === 'signup' ? signupMessage : loginMessage;
      message.textContent = 'Ouvrez BOO-P depuis son adresse locale sécurisée pour utiliser les confirmations par e-mail.';
      message.classList.add('is-info');
    }
  }
  initializeAuthUI();

  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -40px' });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }
})();
