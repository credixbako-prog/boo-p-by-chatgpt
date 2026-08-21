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
  const config = window.BOOP_SUPABASE_CONFIG;

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
      .select('user_id, display_name, onboarding_completed, profile_visibility, daily_goal_minutes, interests, created_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing.error) throw friendlyError(existing.error, 'Le profil BOO-P ne peut pas être chargé.');
    if (existing.data) {
      const directory = await ensureDirectory(existing.data, user);
      const shared = await ensureSharedDetails(existing.data, user);
      currentProfile = { ...existing.data, ...shared, handle:directory?.handle || '' };
      return currentProfile;
    }

    const displayName = String(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Lecteur BOO-P').trim().slice(0, 80);
    const created = await client
      .from('profiles')
      .insert({ user_id: user.id, display_name: displayName.length >= 2 ? displayName : 'Lecteur BOO-P' })
      .select('user_id, display_name, onboarding_completed, profile_visibility, daily_goal_minutes, interests, created_at, updated_at')
      .single();

    if (created.error) throw friendlyError(created.error, 'Le profil BOO-P ne peut pas être créé.');
    const directory = await ensureDirectory(created.data, user);
    const shared = await ensureSharedDetails(created.data, user);
    currentProfile = { ...created.data, ...shared, handle:directory?.handle || '' };
    return currentProfile;
  }

  async function ensureDirectory(profile, user) {
    const existing = await client.from('profile_directory').select('user_id, handle, display_name, profile_visibility').eq('user_id', user.id).maybeSingle();
    if (existing.error) throw friendlyError(existing.error, 'L’annuaire BOO-P ne peut pas être chargé.');
    if (existing.data) return existing.data;
    const handle = normalizeHandle(user.user_metadata?.full_name || profile.display_name, user.id);
    const created = await client.from('profile_directory').insert({ user_id:user.id, handle, display_name:profile.display_name, profile_visibility:profile.profile_visibility || 'private' }).select().single();
    if (created.error) throw friendlyError(created.error, 'L’annuaire BOO-P ne peut pas être créé.');
    return created.data;
  }

  async function ensureSharedDetails(profile, user) {
    const existing = await client.from('profile_shared_details').select('profile_title, bio, interests, profile_visibility').eq('user_id', user.id).maybeSingle();
    if (existing.error) throw friendlyError(existing.error, 'Les détails du profil BOO-P ne peuvent pas être chargés.');
    if (existing.data) return existing.data;
    const created = await client.from('profile_shared_details').insert({ user_id:user.id, interests:profile.interests || [], profile_visibility:profile.profile_visibility || 'private' }).select('profile_title, bio, interests, profile_visibility').single();
    if (created.error) throw friendlyError(created.error, 'Les détails du profil BOO-P ne peuvent pas être créés.');
    return created.data;
  }

  async function initialize() {
    try {
      if (!config?.url || !config?.publishableKey) throw new Error('Configuration Supabase BOO-P absente.');
      if (!window.supabase?.createClient) throw new Error('Le module sécurisé de connexion n’a pas pu être chargé.');

      localStorage.removeItem(LEGACY_SESSION_KEY);
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

      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      currentSession = data.session;
      if (currentSession) await ensureProfile(currentSession);

      client.auth.onAuthStateChange((_event, session) => {
        currentSession = session;
        if (!session) currentProfile = null;
        if (session) window.setTimeout(() => ensureProfile(session).catch(console.error), 0);
      });

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
    allowed.updated_at = new Date().toISOString();

    const { data, error } = await client.from('profiles').update(allowed).eq('user_id', user.id).select().single();
    if (error) throw friendlyError(error, 'Le profil BOO-P ne peut pas être mis à jour.');
    const handle = updates.handle !== undefined ? normalizeHandle(updates.handle, user.id) : (currentProfile?.handle || normalizeHandle(data.display_name, user.id));
    const directory = await client.from('profile_directory').upsert({ user_id:user.id, handle, display_name:data.display_name, profile_visibility:data.profile_visibility, updated_at:new Date().toISOString() }, { onConflict:'user_id' }).select().single();
    if (directory.error) throw friendlyError(directory.error, 'Le profil public minimal ne peut pas être mis à jour.');
    const shared = await client.from('profile_shared_details').upsert({ user_id:user.id, profile_title:updates.profileTitle ?? currentProfile?.profile_title ?? '', bio:updates.bio ?? currentProfile?.bio ?? '', interests:data.interests || [], profile_visibility:data.profile_visibility, updated_at:new Date().toISOString() }, { onConflict:'user_id' }).select('profile_title, bio, interests, profile_visibility').single();
    if (shared.error) throw friendlyError(shared.error, 'Les détails partageables du profil ne peuvent pas être mis à jour.');
    currentProfile = { ...data, ...shared.data, handle:directory.data.handle };
    return { ...currentProfile };
  }

  async function updatePassword(password) {
    await readyPromise;
    if (!currentSession?.user) throw new Error('Votre session a expiré. Reconnectez-vous.');
    const cleanPassword = validatePassword(password);
    const { error } = await client.auth.updateUser({ password: cleanPassword });
    if (error) throw friendlyError(error, 'Le mot de passe ne peut pas être modifié.');
  }

  async function signOut() {
    await readyPromise.catch(() => null);
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) throw friendlyError(error, 'Déconnexion impossible.');
    }
    currentSession = null;
    currentProfile = null;
    flexibleStorage.removeItem(STORAGE_KEY);
  }

  return {
    ready,
    createAccount,
    signIn,
    signOut,
    updatePassword,
    updateProfile,
    ensureProfile,
    isAuthenticated,
    getCurrentUser,
    getSession,
    getProfile,
    getClient,
    backend: 'supabase'
  };
})();
