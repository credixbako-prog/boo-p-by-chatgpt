/**
 * BOO-P — Authentification Supabase de la Phase 1.
 *
 * Seule la clé publique est utilisée dans le navigateur. Les mots de passe
 * sont transmis directement à Supabase et ne sont jamais stockés par BOO-P.
 */
window.BT = window.BT || {};

BT.auth = (function () {
  'use strict';

  const STORAGE_KEY = 'boop_supabase_auth_v1';
  const PERSISTENCE_KEY = 'boop_auth_persistence_v1';
  const LEGACY_SESSION_KEY = 'boop_auth_session_v1';
  const GUEST_KEY = 'boop_guest_mode_v1';
  const RECOVERY_KEY = 'boop_password_recovery_v1';
  const recoveryURL = new URLSearchParams(window.location.hash.slice(1));
  const recoveryRequested = new URLSearchParams(window.location.search).get('auth') === 'recovery' || recoveryURL.get('type') === 'recovery';
  const recoveryLinkError = recoveryURL.has('error') || recoveryURL.has('error_code');
  const AVATAR_BUCKET = 'profile-avatars';
  const MAX_AVATAR_INPUT_BYTES = 15 * 1024 * 1024;
  const AVATAR_EDGE = 512;
  const config = window.BOOP_SUPABASE_CONFIG;
  const avatarUrlCache = new Map();

  let client = null;
  let currentSession = null;
  let currentProfile = null;
  let initializationError = null;

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function validateName(name) {
    const value = String(name || '').trim();
    if (value.length < 2) throw new Error('Indiquez votre prénom ou votre nom.');
    if (value.length > 80) throw new Error('Le nom ne peut pas dépasser 80 caractères.');
    return value;
  }

  function validateEmail(email) {
    const value = normalizeEmail(email);
    if (!/^\S+@\S+\.\S+$/.test(value)) throw new Error('Indiquez une adresse e-mail valide.');
    return value;
  }

  function validatePassword(password) {
    const value = String(password || '');
    if (value.length < 8) throw new Error('Choisissez un mot de passe d’au moins 8 caractères.');
    return value;
  }

  function normalizeHandle(value, userId = '') {
    const base = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 22);
    const safe = base.length >= 3 ? base : 'lecteur';
    const suffix = String(userId).replace(/-/g, '').slice(0, 6);
    return (suffix && safe.endsWith(`-${suffix}`) ? safe : `${safe}-${suffix}`).slice(0, 30);
  }

  function setPersistence(persistent) {
    localStorage.removeItem(PERSISTENCE_KEY);
    sessionStorage.removeItem(PERSISTENCE_KEY);
    (persistent ? localStorage : sessionStorage).setItem(PERSISTENCE_KEY, persistent ? 'persistent' : 'session');
  }

  function shouldPersist() {
    if (sessionStorage.getItem(PERSISTENCE_KEY) === 'session') return false;
    return localStorage.getItem(PERSISTENCE_KEY) === 'persistent';
  }

  function enterGuestMode() {
    sessionStorage.setItem(GUEST_KEY, 'true');
  }

  function leaveGuestMode() {
    sessionStorage.removeItem(GUEST_KEY);
  }

  function isGuest() {
    return sessionStorage.getItem(GUEST_KEY) === 'true';
  }

  const flexibleStorage = {
    getItem(key) {
      return sessionStorage.getItem(key) || localStorage.getItem(key);
    },
    setItem(key, value) {
      const target = shouldPersist() ? localStorage : sessionStorage;
      const other = target === localStorage ? sessionStorage : localStorage;
      other.removeItem(key);
      target.setItem(key, value);
    },
    removeItem(key) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  };

  function friendlyError(error, fallback = 'Une erreur est survenue. Réessayez dans un instant.') {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    if (code.includes('invalid_credentials') || message.includes('invalid login credentials')) {
      return new Error('Adresse e-mail ou mot de passe incorrect.');
    }
    if (code.includes('email_not_confirmed') || message.includes('email not confirmed')) {
      return new Error('Confirmez d’abord votre adresse e-mail grâce au message envoyé par BOO-P.');
    }
    if (code.includes('user_already_exists') || message.includes('already registered')) {
      return new Error('Un compte existe déjà avec cette adresse. Connectez-vous.');
    }
    if (code.includes('weak_password') || message.includes('password')) {
      return new Error(error?.message || 'Le mot de passe ne respecte pas les règles de sécurité.');
    }
    if (message.includes('rate limit') || error?.status === 429) {
      return new Error('Trop de tentatives rapprochées. Patientez quelques minutes avant de réessayer.');
    }
    if (message.includes('failed to fetch') || message.includes('network')) {
      return new Error('Connexion au service d’authentification impossible. Vérifiez votre accès à Internet.');
    }
    return new Error(error?.message || fallback);
  }

  async function decodeAvatarImage(file) {
    try {
      if ('createImageBitmap' in window) return await createImageBitmap(file, { imageOrientation:'from-image' });
    } catch { /* fallback below */ }
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Cette photo ne peut pas être lue sur cet appareil.')); };
      image.src = url;
    });
  }

  function avatarCanvasBlob(canvas, quality) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('La photo de profil ne peut pas être préparée.')), 'image/jpeg', quality));
  }

  async function prepareAvatar(file) {
    if (!file?.size) throw new Error('Choisissez une photo de profil.');
    const inputType = String(file.type || '').toLowerCase();
    const inputExtension = String(file.name || '').split('.').pop().toLowerCase();
    const allowed = ['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(inputType)
      || ['jpg','jpeg','png','webp','heic','heif'].includes(inputExtension);
    if (!allowed) throw new Error('Choisissez une photo JPEG, PNG, WebP ou HEIC.');
    if (file.size > MAX_AVATAR_INPUT_BYTES) throw new Error('Cette photo dépasse 15 Mo. Choisissez une image moins lourde.');

    let source;
    try { source = await decodeAvatarImage(file); }
    catch {
      if (['image/heic','image/heif'].includes(inputType) || ['heic','heif'].includes(inputExtension)) {
        throw new Error('Cette photo HEIC ne peut pas être convertie par ce navigateur. Sur iPhone, choisissez une photo compatible ou utilisez le format « Le plus compatible ».');
      }
      throw new Error('Cette photo ne peut pas être lue. Essayez une image JPEG ou PNG.');
    }

    const width = source.width || source.naturalWidth;
    const height = source.height || source.naturalHeight;
    const side = Math.min(width, height);
    const sourceX = Math.max(0, (width - side) / 2);
    const sourceY = Math.max(0, (height - side) / 2);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_EDGE;
    canvas.height = AVATAR_EDGE;
    const context = canvas.getContext('2d', { alpha:false });
    context.fillStyle = '#f6f1e8';
    context.fillRect(0, 0, AVATAR_EDGE, AVATAR_EDGE);
    context.drawImage(source, sourceX, sourceY, side, side, 0, 0, AVATAR_EDGE, AVATAR_EDGE);
    source.close?.();

    let blob = await avatarCanvasBlob(canvas, .84);
    if (blob.size > 1024 * 1024) blob = await avatarCanvasBlob(canvas, .68);
    if (blob.size > 1024 * 1024) throw new Error('La photo reste trop lourde après compression. Choisissez une autre image.');
    return new File([blob], 'avatar.jpg', { type:'image/jpeg', lastModified:Date.now() });
  }

  async function signedAvatarUrl(path) {
    if (!path || !client) return '';
    const cached = avatarUrlCache.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    const { data, error } = await client.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600);
    if (error) { console.warn('Photo de profil BOO-P indisponible', error); return ''; }
    const url = data?.signedUrl || '';
    if (url) avatarUrlCache.set(path, { url, expiresAt:Date.now() + 55 * 60000 });
    return url;
  }

  async function withAvatarUrl(profile) {
    if (!profile) return null;
    const avatarPath = profile.avatar_path || '';
    return { ...profile, avatar_path:avatarPath, avatar_url:await signedAvatarUrl(avatarPath) };
  }

  function redirectUrl(page) {
    if (!['http:', 'https:'].includes(window.location.protocol)) return undefined;
    return new URL(page, window.location.href).href;
  }

  function userFromSession(session = currentSession) {
    const user = session?.user;
    if (!user) return null;
    return {
      id: user.id,
      email: user.email || '',
      name: currentProfile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Lecteur BOO-P',
      emailConfirmed: Boolean(user.email_confirmed_at),
      profile: currentProfile ? { ...currentProfile } : null
    };
  }

  async function ensureProfile(session = currentSession) {
    const user = session?.user;
    if (!user || !client) return null;

    const existing = await client
      .from('profiles')
      .select('user_id, display_name, onboarding_completed, profile_visibility, daily_goal_minutes, interests, avatar_path, created_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing.error) throw friendlyError(existing.error, 'Le profil BOO-P ne peut pas être chargé.');
    if (existing.data) {
      const directory = await ensureDirectory(existing.data, user);
      const shared = await ensureSharedDetails(existing.data, user);
      currentProfile = await withAvatarUrl({ ...existing.data, ...shared, avatar_path:existing.data.avatar_path || shared?.avatar_path || directory?.avatar_path || '', handle:directory?.handle || '' });
      return currentProfile;
    }

    const displayName = String(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Lecteur BOO-P').trim().slice(0, 80);
    const created = await client
      .from('profiles')
      .insert({ user_id: user.id, display_name: displayName.length >= 2 ? displayName : 'Lecteur BOO-P' })
      .select('user_id, display_name, onboarding_completed, profile_visibility, daily_goal_minutes, interests, avatar_path, created_at, updated_at')
      .single();

    if (created.error) throw friendlyError(created.error, 'Le profil BOO-P ne peut pas être créé.');
    const directory = await ensureDirectory(created.data, user);
    const shared = await ensureSharedDetails(created.data, user);
    currentProfile = await withAvatarUrl({ ...created.data, ...shared, avatar_path:created.data.avatar_path || shared?.avatar_path || directory?.avatar_path || '', handle:directory?.handle || '' });
    return currentProfile;
  }

  async function ensureDirectory(profile, user) {
    const existing = await client.from('profile_directory').select('user_id, handle, display_name, profile_visibility, avatar_path').eq('user_id', user.id).maybeSingle();
    if (existing.error) throw friendlyError(existing.error, 'L’annuaire BOO-P ne peut pas être chargé.');
    if (existing.data) return existing.data;
    const handle = normalizeHandle(user.user_metadata?.full_name || profile.display_name, user.id);
    const created = await client.from('profile_directory').insert({ user_id:user.id, handle, display_name:profile.display_name, profile_visibility:profile.profile_visibility || 'private', avatar_path:profile.avatar_path || null }).select().single();
    if (created.error) throw friendlyError(created.error, 'L’annuaire BOO-P ne peut pas être créé.');
    return created.data;
  }

  async function ensureSharedDetails(profile, user) {
    const existing = await client.from('profile_shared_details').select('profile_title, bio, interests, profile_visibility, avatar_path').eq('user_id', user.id).maybeSingle();
    if (existing.error) throw friendlyError(existing.error, 'Les détails du profil BOO-P ne peuvent pas être chargés.');
    if (existing.data) return existing.data;
    const created = await client.from('profile_shared_details').insert({ user_id:user.id, interests:profile.interests || [], profile_visibility:profile.profile_visibility || 'private', avatar_path:profile.avatar_path || null }).select('profile_title, bio, interests, profile_visibility, avatar_path').single();
    if (created.error) throw friendlyError(created.error, 'Les détails du profil BOO-P ne peuvent pas être créés.');
    return created.data;
  }

  async function initialize() {
    try {
      if (!config?.url || !config?.publishableKey) throw new Error('Configuration Supabase BOO-P absente.');
      if (!window.supabase?.createClient) throw new Error('Le module sécurisé de connexion n’a pas pu être chargé.');

      localStorage.removeItem(LEGACY_SESSION_KEY);
      if(recoveryLinkError)sessionStorage.removeItem(RECOVERY_KEY);
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
      if (!localStorage.getItem(PERSISTENCE_KEY) && !sessionStorage.getItem(PERSISTENCE_KEY)) setPersistence(true);

      client = window.supabase.createClient(config.url, config.publishableKey, {
        auth: {
          storage: flexibleStorage,
          storageKey: STORAGE_KEY,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });

      // Subscribe before getSession: recovery can be emitted during URL initialization.
      client.auth.onAuthStateChange((event, session) => {
        currentSession = session;
        if (event === 'PASSWORD_RECOVERY' && session?.user) {
          sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ userId:session.user.id, expires:Date.now()+3600000 }));
          leaveGuestMode();
          window.dispatchEvent(new Event('boop:password-recovery'));
        }
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') sessionStorage.removeItem(RECOVERY_KEY);
        if (!session) currentProfile = null;
        if (session && !recoveryRequested && event !== 'PASSWORD_RECOVERY') window.setTimeout(() => ensureProfile(session).catch(console.error), 0);
      });

      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      currentSession = data.session;
      if (currentSession && !recoveryRequested && !isPasswordRecovery()) await ensureProfile(currentSession);

      return userFromSession();
    } catch (error) {
      initializationError = friendlyError(error, 'Le service d’authentification BOO-P est indisponible.');
      throw initializationError;
    }
  }

  const readyPromise = initialize();

  async function ready() {
    await readyPromise;
    return userFromSession();
  }

  function isAuthenticated() {
    return Boolean(currentSession?.user);
  }

  function getCurrentUser() {
    return userFromSession();
  }

  function getSession() {
    return currentSession;
  }

  function getProfile() {
    return currentProfile ? { ...currentProfile } : null;
  }

  function getClient() {
    return client;
  }

  async function createAccount({ name, email, password }) {
    await readyPromise.catch(() => { throw initializationError; });
    const cleanName = validateName(name);
    const cleanEmail = validateEmail(email);
    const cleanPassword = validatePassword(password);
    leaveGuestMode();
    setPersistence(true);

    const options = { data: { full_name: cleanName } };
    const emailRedirectTo = redirectUrl('onboarding.html');
    if (emailRedirectTo) options.emailRedirectTo = emailRedirectTo;

    const { data, error } = await client.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options
    });
    if (error) throw friendlyError(error, 'Création du compte impossible.');

    currentSession = data.session;
    if (data.session) await ensureProfile(data.session);
    return {
      id: data.user?.id,
      name: cleanName,
      email: cleanEmail,
      requiresEmailConfirmation: !data.session
    };
  }

  async function signIn({ email, password, remember }) {
    await readyPromise.catch(() => { throw initializationError; });
    const cleanEmail = validateEmail(email);
    const cleanPassword = validatePassword(password);
    leaveGuestMode();
    setPersistence(Boolean(remember));

    const { data, error } = await client.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword });
    if (error) throw friendlyError(error, 'Connexion impossible.');
    currentSession = data.session;
    await ensureProfile(data.session);
    return userFromSession();
  }

  async function updateProfile(updates = {}) {
    await readyPromise;
    const user = currentSession?.user;
    if (!user) throw new Error('Votre session a expiré. Reconnectez-vous.');
    const allowed = {};
    if (updates.displayName !== undefined) allowed.display_name = validateName(updates.displayName);
    if (updates.onboardingCompleted !== undefined) allowed.onboarding_completed = Boolean(updates.onboardingCompleted);
    if (updates.profileVisibility !== undefined) allowed.profile_visibility = updates.profileVisibility === 'public' ? 'public' : 'private';
    if (updates.dailyGoalMinutes !== undefined) allowed.daily_goal_minutes = Math.max(5, Math.min(240, Number(updates.dailyGoalMinutes) || 15));
    if (updates.interests !== undefined) allowed.interests = Array.isArray(updates.interests) ? updates.interests.map(String).slice(0, 12) : [];
    if (updates.avatarPath !== undefined) {
      const avatarPath = String(updates.avatarPath || '');
      allowed.avatar_path = avatarPath === `${user.id}/avatar.jpg` ? avatarPath : null;
    }
    allowed.updated_at = new Date().toISOString();

    const { data, error } = await client.from('profiles').update(allowed).eq('user_id', user.id).select().single();
    if (error) throw friendlyError(error, 'Le profil BOO-P ne peut pas être mis à jour.');
    const handle = updates.handle !== undefined ? normalizeHandle(updates.handle, user.id) : (currentProfile?.handle || normalizeHandle(data.display_name, user.id));
    const directory = await client.from('profile_directory').upsert({ user_id:user.id, handle, display_name:data.display_name, profile_visibility:data.profile_visibility, avatar_path:data.avatar_path || null, updated_at:new Date().toISOString() }, { onConflict:'user_id' }).select().single();
    if (directory.error) throw friendlyError(directory.error, 'Le profil public minimal ne peut pas être mis à jour.');
    const shared = await client.from('profile_shared_details').upsert({ user_id:user.id, profile_title:updates.profileTitle ?? currentProfile?.profile_title ?? '', bio:updates.bio ?? currentProfile?.bio ?? '', interests:data.interests || [], profile_visibility:data.profile_visibility, avatar_path:data.avatar_path || null, updated_at:new Date().toISOString() }, { onConflict:'user_id' }).select('profile_title, bio, interests, profile_visibility, avatar_path').single();
    if (shared.error) throw friendlyError(shared.error, 'Les détails partageables du profil ne peuvent pas être mis à jour.');
    currentProfile = await withAvatarUrl({ ...data, ...shared.data, handle:directory.data.handle });
    return { ...currentProfile };
  }

  async function updateAvatar(file) {
    await readyPromise;
    const user = currentSession?.user;
    if (!user) throw new Error('Votre session a expiré. Reconnectez-vous.');
    const avatar = await prepareAvatar(file);
    const path = `${user.id}/avatar.jpg`;
    avatarUrlCache.delete(path);
    const { error } = await client.storage.from(AVATAR_BUCKET).upload(path, avatar, { contentType:'image/jpeg', cacheControl:'3600', upsert:true });
    if (error) throw friendlyError(error, 'La photo de profil ne peut pas être envoyée.');
    return updateProfile({ avatarPath:path });
  }

  async function removeAvatar() {
    await readyPromise;
    const user = currentSession?.user;
    if (!user) throw new Error('Votre session a expiré. Reconnectez-vous.');
    const path = `${user.id}/avatar.jpg`;
    const profile = await updateProfile({ avatarPath:null });
    avatarUrlCache.delete(path);
    const { error } = await client.storage.from(AVATAR_BUCKET).remove([path]);
    if (error && !/not found/i.test(String(error.message || ''))) console.warn('Ancienne photo de profil BOO-P non supprimée', error);
    return profile;
  }

  async function updatePassword(password) {
    await readyPromise;
    if (!currentSession?.user) throw new Error('Votre session a expiré. Reconnectez-vous.');
    const cleanPassword = validatePassword(password);
    const { error } = await client.auth.updateUser({ password: cleanPassword });
    if (error) throw friendlyError(error, 'Le mot de passe ne peut pas être modifié.');
  }

  function isPasswordRecovery() {
    if (recoveryLinkError) return false;
    try { const marker=JSON.parse(sessionStorage.getItem(RECOVERY_KEY)); return Boolean(currentSession?.user && marker?.userId===currentSession.user.id && marker.expires>Date.now()); }
    catch { return false; }
  }

  async function requestPasswordReset(email) {
    await readyPromise;
    const cleanEmail=validateEmail(email);
    if (!['https:','http:'].includes(window.location.protocol)) throw new Error('Ouvrez BOO-P depuis son adresse en ligne pour recevoir un lien de récupération.');
    const redirectTo=new URL('index.html?auth=recovery',window.location.href).href;
    const {error}=await client.auth.resetPasswordForEmail(cleanEmail,{redirectTo});
    if(error?.code==='user_not_found')return;
    if (error) throw friendlyError(error,'Le lien ne peut pas être envoyé pour le moment.');
  }

  async function completePasswordReset(password) {
    await readyPromise;
    if (!isPasswordRecovery()) throw new Error('Ce lien est invalide ou a expiré. Demandez un nouveau lien.');
    await updatePassword(password);
    sessionStorage.removeItem(RECOVERY_KEY);
  }

  async function signOut() {
    await readyPromise.catch(() => null);
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) throw friendlyError(error, 'Déconnexion impossible.');
    }
    currentSession = null;
    currentProfile = null;
    leaveGuestMode();
    flexibleStorage.removeItem(STORAGE_KEY);
  }

  return {
    ready,
    createAccount,
    signIn,
    signOut,
    updatePassword,
    requestPasswordReset,
    completePasswordReset,
    isPasswordRecovery,
    recoveryRequested,
    updateProfile,
    updateAvatar,
    removeAvatar,
    prepareAvatar,
    decodeAvatarImage,
    ensureProfile,
    isAuthenticated,
    getCurrentUser,
    getSession,
    getProfile,
    getClient,
    enterGuestMode,
    leaveGuestMode,
    isGuest,
    backend: 'supabase'
  };
})();
