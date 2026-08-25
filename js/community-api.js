/** BOO-P — persistance Supabase des Traces, commentaires, encouragements, clubs et photos. */
window.BT = window.BT || {};

BT.community = (() => {
  'use strict';

  const BUCKET = 'community-media';
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
  const MAX_EDGE = 1920;
  const signedUrlCache = new Map();

  const extensionFromType = type => ({
    'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp',
    'image/heic':'heic', 'image/heif':'heif'
  })[String(type || '').toLowerCase()] || '';

  function client() {
    const value = window.BT.auth?.getClient?.();
    if (!value) throw new Error('La connexion à la base BOO-P n’est pas prête.');
    return value;
  }

  function currentUser() {
    const value = window.BT.auth?.getCurrentUser?.();
    if (!value) throw new Error('Votre session a expiré. Reconnectez-vous.');
    return value;
  }

  function friendly(error, fallback) {
    console.error('BOO-P Supabase community', error);
    const message = String(error?.message || '');
    if (/row-level security|permission denied/i.test(message)) return new Error('Cette action n’est pas autorisée pour ce compte.');
    if (/failed to fetch|network/i.test(message)) return new Error('Connexion à BOO-P impossible. Vérifiez votre accès à Internet.');
    return new Error(message || fallback);
  }

  async function decodeImage(file) {
    try {
      if ('createImageBitmap' in window) return await createImageBitmap(file, { imageOrientation:'from-image' });
    } catch { /* fallback below */ }
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Cette photo ne peut pas être lue par votre navigateur.')); };
      image.src = url;
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('La photo ne peut pas être compressée.')), type, quality));
  }

  async function compressPhoto(file) {
    if (!file) return null;
    const inferredType = String(file.type || '').toLowerCase();
    const inferredExtension = String(file.name || '').split('.').pop().toLowerCase();
    const allowedInput = ['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(inferredType) || ['jpg','jpeg','png','webp','heic','heif'].includes(inferredExtension);
    if (!allowedInput) throw new Error('Choisissez une photo JPEG, PNG, WebP ou HEIC.');

    let source;
    try { source = await decodeImage(file); }
    catch {
      if (['image/heic','image/heif'].includes(inferredType) || ['heic','heif'].includes(inferredExtension)) {
        throw new Error('Cette photo HEIC ne peut pas être convertie ici. Sur iPhone, partagez-la en JPEG ou utilisez Réglages > Appareil photo > Formats > Le plus compatible.');
      }
      throw new Error('Cette photo ne peut pas être lue. Essayez une image JPEG ou PNG.');
    }

    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;
    const attempts = [
      { edge:MAX_EDGE, quality:.82 }, { edge:1600, quality:.76 },
      { edge:1400, quality:.7 }, { edge:1200, quality:.64 }
    ];
    let blob = null;
    for (const attempt of attempts) {
      const ratio = Math.min(1, attempt.edge / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
      canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
      const context = canvas.getContext('2d', { alpha:false });
      context.fillStyle = '#f6f1e8';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      blob = await canvasBlob(canvas, 'image/jpeg', attempt.quality);
      if (blob.size <= MAX_UPLOAD_BYTES) break;
    }
    source.close?.();
    if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error('La photo reste trop lourde après compression. Choisissez une image moins grande.');

    const baseName = String(file.name || 'trace').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'trace';
    return new File([blob], `${baseName}.jpg`, { type:'image/jpeg', lastModified:Date.now() });
  }

  function nestComments(rows = []) {
    const roots = [], byId = new Map();
    rows.forEach(row => byId.set(row.id, {
      id:row.id, authorId:row.author_id, authorName:row.author_name,
      text:row.body, date:row.created_at, replies:[]
    }));
    rows.forEach(row => {
      const comment = byId.get(row.id);
      if (row.parent_id && byId.has(row.parent_id)) byId.get(row.parent_id).replies.push(comment);
      else roots.push(comment);
    });
    return roots;
  }

  async function signedPhotoUrl(path) {
    if (!path) return null;
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    const { data, error } = await client().storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) { console.warn('Photo BOO-P indisponible', error); return null; }
    signedUrlCache.set(path, { url:data.signedUrl, expiresAt:Date.now() + 55 * 60000 });
    return data.signedUrl;
  }

  async function listPosts() {
    await window.BT.auth.ready();
    const user = currentUser();
    const api = client();
    const { data:posts, error } = await api
      .from('community_posts')
      .select('id, author_id, author_name, author_initials, activity_type, book_title, body, visibility, photo_path, created_at, community_comments(id, post_id, author_id, author_name, parent_id, body, created_at)')
      .order('created_at', { ascending:false })
      .limit(50);
    if (error) throw friendly(error, 'Le fil partagé ne peut pas être chargé.');

    const postIds = posts.map(post => post.id);
    let encouragementRows = [];
    if (postIds.length) {
      const result = await api.from('community_encouragements').select('post_id, user_id').in('post_id', postIds);
      if (result.error) throw friendly(result.error, 'Les encouragements ne peuvent pas être chargés.');
      encouragementRows = result.data || [];
    }

    const encouragementsByPost = new Map();
    encouragementRows.forEach(row => {
      const value = encouragementsByPost.get(row.post_id) || { count:0, mine:false };
      value.count += 1; value.mine ||= row.user_id === user.id; encouragementsByPost.set(row.post_id, value);
    });

    return await Promise.all(posts.map(async post => {
      const encouragement = encouragementsByPost.get(post.id) || { count:0, mine:false };
      return {
        id:post.id, remoteId:post.id, authorId:post.author_id === user.id ? 'me' : post.author_id,
        authorName:post.author_name, initials:post.author_initials, type:post.activity_type,
        bookTitle:post.book_title, text:post.body, visibility:post.visibility,
        photoPath:post.photo_path, photoUrl:await signedPhotoUrl(post.photo_path), date:post.created_at,
        encouraged:encouragement.mine, encouragements:encouragement.count,
        comments:nestComments(post.community_comments || []), isRemote:true
      };
    }));
  }

  async function createPost({ type, bookTitle, text, visibility, file }) {
    await window.BT.auth.ready();
    const user = currentUser();
    const api = client();
    const postId = crypto.randomUUID();
    const photo = file?.size ? await compressPhoto(file) : null;
    let photoPath = null;

    if (photo) {
      photoPath = `${user.id}/${postId}/${crypto.randomUUID()}.${extensionFromType(photo.type) || 'jpg'}`;
      const upload = await api.storage.from(BUCKET).upload(photoPath, photo, { contentType:photo.type, cacheControl:'86400', upsert:false });
      if (upload.error) throw friendly(upload.error, 'La photo ne peut pas être envoyée.');
    }

    const record = {
      id:postId, author_id:user.id, author_name:user.name,
      author_initials:String(user.name || 'B').split(/\s+/).map(part => part[0]).slice(0,2).join('').toUpperCase(),
      activity_type:type || 'trace', book_title:String(bookTitle || ''), body:String(text || '').trim(),
      visibility:visibility || 'me', photo_path:photoPath
    };
    const result = await api.from('community_posts').insert(record).select().single();
    if (result.error) {
      if (photoPath) await api.storage.from(BUCKET).remove([photoPath]);
      throw friendly(result.error, 'La Trace ne peut pas être enregistrée.');
    }
    return (await listPosts()).find(post => post.id === postId);
  }

  async function createComment(postId, text, parentId = null) {
    await window.BT.auth.ready();
    const user = currentUser();
    const { data, error } = await client().from('community_comments').insert({
      post_id:postId, author_id:user.id, author_name:user.name,
      parent_id:parentId || null, body:String(text || '').trim()
    }).select().single();
    if (error) throw friendly(error, 'La Trace ne peut pas être envoyée.');
    return data;
  }

  async function toggleEncouragement(postId, encouraged) {
    await window.BT.auth.ready();
    const user = currentUser();
    const api = client();
    const result = encouraged
      ? await api.from('community_encouragements').delete().eq('post_id', postId).eq('user_id', user.id)
      : await api.from('community_encouragements').insert({ post_id:postId, user_id:user.id });
    if (result.error) throw friendly(result.error, 'L’encouragement ne peut pas être enregistré.');
  }

  async function createClub(club) {
    await window.BT.auth.ready();
    const user = currentUser();
    const { data, error } = await client().from('reading_clubs').insert({
      owner_id:user.id, name:club.name, description:club.description || '',
      visibility:club.visibility || 'private', access_mode:club.access || 'approval',
      book_title:club.bookTitle || '', color:club.color || '#6f927c'
    }).select().single();
    if (error) throw friendly(error, 'Le club ne peut pas être créé.');
    if (String(club.bookTitle || '').trim()) {
      await addClubBook({ clubId:data.id, title:club.bookTitle, status:'current' });
    }
    return data;
  }

  async function directoryNames(userIds) {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return new Map();
    const { data, error } = await client().from('profile_directory')
      .select('user_id, display_name, handle')
      .in('user_id', ids);
    if (error) throw friendly(error, 'Les membres ne peuvent pas être chargés.');
    return new Map((data || []).map(row => [row.user_id, { name:row.display_name, handle:`@${row.handle}` }]));
  }

  async function listClubs() {
    await window.BT.auth.ready();
    const user = currentUser();
    const { data, error } = await client().from('reading_clubs')
      .select('id, owner_id, name, description, visibility, access_mode, book_title, color, created_at, updated_at, reading_club_members(user_id, role, status, created_at)')
      .order('updated_at', { ascending:false });
    if (error) throw friendly(error, 'Les clubs ne peuvent pas être chargés.');
    const memberships = (data || []).flatMap(club => club.reading_club_members || []);
    const names = await directoryNames(memberships.map(member => member.user_id).concat((data || []).map(club => club.owner_id)));
    return (data || []).map(club => {
      const members = (club.reading_club_members || []).map(member => ({
        userId:member.user_id,
        name:names.get(member.user_id)?.name || (member.user_id === user.id ? user.name : 'Lecteur BOO-P'),
        handle:names.get(member.user_id)?.handle || '',
        role:member.role, status:member.status, joinedAt:member.created_at
      }));
      const mine = members.find(member => member.userId === user.id);
      const role = club.owner_id === user.id ? 'owner' : mine?.status === 'active' ? mine.role : null;
      return {
        id:club.id, remoteId:club.id, ownerId:club.owner_id, name:club.name,
        description:club.description, visibility:club.visibility, access:club.access_mode,
        bookTitle:club.book_title, color:club.color, members,
        membersCount:members.filter(member => member.status === 'active').length,
        joined:mine?.status === 'active' || club.owner_id === user.id,
        membershipStatus:mine?.status || (club.owner_id === user.id ? 'active' : null),
        role, isRemote:true
      };
    });
  }

  async function updateClub(clubId, updates) {
    await window.BT.auth.ready();
    const payload = {};
    if (updates.name != null) payload.name = String(updates.name).trim();
    if (updates.description != null) payload.description = String(updates.description).trim();
    if (updates.visibility != null) payload.visibility = updates.visibility;
    if (updates.access != null) payload.access_mode = updates.access;
    if (updates.bookTitle != null) payload.book_title = String(updates.bookTitle).trim();
    if (updates.color != null) payload.color = updates.color;
    const { data, error } = await client().from('reading_clubs').update(payload).eq('id', clubId).select().single();
    if (error) throw friendly(error, 'Le club ne peut pas être modifié.');
    if (updates.bookTitle != null && String(updates.bookTitle).trim()) {
      await syncClubCurrentBook(clubId, updates.bookTitle);
    }
    return data;
  }

  async function syncClubCurrentBook(clubId, title) {
    const user = currentUser(), api = client(), cleanTitle = String(title || '').trim();
    if (!cleanTitle) return null;
    const existing = await api.from('reading_club_books')
      .select('id, title, status')
      .eq('club_id', clubId)
      .ilike('title', cleanTitle)
      .limit(1);
    if (existing.error) throw friendly(existing.error, 'La lecture du club ne peut pas être synchronisée.');
    let record = existing.data?.[0] || null;
    if (record) {
      const update = await api.from('reading_club_books').update({ status:'current', completed_at:null }).eq('id', record.id).select().single();
      if (update.error) throw friendly(update.error, 'La lecture du club ne peut pas être mise à jour.');
      record = update.data;
    } else {
      const insert = await api.from('reading_club_books').insert({ club_id:clubId, added_by:user.id, title:cleanTitle, status:'current' }).select().single();
      if (insert.error) throw friendly(insert.error, 'La lecture du club ne peut pas être ajoutée.');
      record = insert.data;
    }
    const demote = await api.from('reading_club_books').update({ status:'planned', completed_at:null })
      .eq('club_id', clubId).eq('status', 'current').neq('id', record.id);
    if (demote.error) throw friendly(demote.error, 'L’ancienne lecture du club ne peut pas être archivée.');
    return record;
  }

  async function addClubBook({ clubId, title, status = 'planned' }) {
    await window.BT.auth.ready();
    const user = currentUser(), api = client(), cleanTitle = String(title || '').trim();
    const safeStatus = ['planned','current','read'].includes(status) ? status : 'planned';
    if (!cleanTitle) throw new Error('Indiquez le titre du livre.');
    if (safeStatus === 'current') {
      const record = await syncClubCurrentBook(clubId, cleanTitle);
      const clubUpdate = await api.from('reading_clubs').update({ book_title:cleanTitle }).eq('id', clubId);
      if (clubUpdate.error) throw friendly(clubUpdate.error, 'Le livre actuel du club ne peut pas être enregistré.');
      return record;
    }
    const result = await api.from('reading_club_books').insert({
      club_id:clubId, added_by:user.id, title:cleanTitle, status:safeStatus,
      completed_at:safeStatus === 'read' ? new Date().toISOString() : null
    }).select().single();
    if (result.error) throw friendly(result.error, 'Le livre ne peut pas être ajouté au club.');
    return result.data;
  }

  async function updateClubBook(bookId, clubId, updates) {
    await window.BT.auth.ready();
    const api = client(), payload = {};
    if (updates.status != null) {
      payload.status = ['planned','current','read'].includes(updates.status) ? updates.status : 'planned';
      payload.completed_at = payload.status === 'read' ? new Date().toISOString() : null;
    }
    const result = await api.from('reading_club_books').update(payload).eq('id', bookId).eq('club_id', clubId).select().single();
    if (result.error) throw friendly(result.error, 'Le statut de cette lecture ne peut pas être modifié.');
    if (payload.status === 'current') {
      await syncClubCurrentBook(clubId, result.data.title);
      const clubUpdate = await api.from('reading_clubs').update({ book_title:result.data.title }).eq('id', clubId);
      if (clubUpdate.error) throw friendly(clubUpdate.error, 'Le livre actuel du club ne peut pas être mis à jour.');
    } else if (payload.status === 'read') {
      const club = await api.from('reading_clubs').select('book_title').eq('id', clubId).single();
      if (!club.error && String(club.data.book_title).toLocaleLowerCase('fr') === String(result.data.title).toLocaleLowerCase('fr')) {
        await api.from('reading_clubs').update({ book_title:'' }).eq('id', clubId);
      }
    }
    return result.data;
  }

  async function getClubSpace(clubId, clubs = null, salons = null) {
    await window.BT.auth.ready();
    const user = currentUser(), clubList = clubs || await listClubs();
    const club = clubList.find(item => item.id === clubId);
    if (!club) throw new Error('Ce club est introuvable ou n’est pas accessible.');
    if (!club.joined) return { club, locked:true, books:[], posts:[], salons:[] };
    const api = client();
    const [bookResult, postResult, salonList] = await Promise.all([
      api.from('reading_club_books')
        .select('id, club_id, added_by, title, status, completed_at, created_at, updated_at')
        .eq('club_id', clubId).order('updated_at', { ascending:false }),
      api.from('reading_club_posts')
        .select('id, club_id, author_id, post_type, body, created_at, updated_at, reading_club_comments(id, post_id, author_id, body, created_at), reading_club_encouragements(user_id, created_at)')
        .eq('club_id', clubId).order('created_at', { ascending:false }).limit(60),
      salons || listSalons(clubList)
    ]);
    if (bookResult.error) throw friendly(bookResult.error, 'Les lectures du club ne peuvent pas être chargées.');
    if (postResult.error) throw friendly(postResult.error, 'Les annonces du club ne peuvent pas être chargées.');
    const userIds = (postResult.data || []).flatMap(post => [post.author_id, ...(post.reading_club_comments || []).map(comment => comment.author_id)]);
    const names = await directoryNames(userIds);
    const posts = (postResult.data || []).map(post => {
      const encouragements = post.reading_club_encouragements || [];
      return {
        id:post.id, clubId:post.club_id, authorId:post.author_id,
        authorName:names.get(post.author_id)?.name || (post.author_id === user.id ? user.name : 'Lecteur BOO-P'),
        type:post.post_type, text:post.body, date:post.created_at,
        encouraged:encouragements.some(item => item.user_id === user.id), encouragements:encouragements.length,
        comments:(post.reading_club_comments || []).sort((a,b) => new Date(a.created_at) - new Date(b.created_at)).map(comment => ({
          id:comment.id, authorId:comment.author_id,
          authorName:names.get(comment.author_id)?.name || (comment.author_id === user.id ? user.name : 'Lecteur BOO-P'),
          text:comment.body, date:comment.created_at
        }))
      };
    });
    return {
      club, locked:false, books:bookResult.data || [], posts,
      salons:(salonList || []).filter(salon => salon.clubId === clubId)
    };
  }

  async function createClubPost(clubId, text, type = 'discussion') {
    await window.BT.auth.ready();
    const user = currentUser(), safeType = type === 'announcement' ? 'announcement' : 'discussion';
    const { data, error } = await client().from('reading_club_posts').insert({
      club_id:clubId, author_id:user.id, post_type:safeType, body:String(text || '').trim()
    }).select().single();
    if (error) throw friendly(error, safeType === 'announcement' ? 'L’annonce ne peut pas être publiée.' : 'Le message ne peut pas être publié.');
    return data;
  }

  async function createClubComment(postId, text) {
    await window.BT.auth.ready();
    const user = currentUser();
    const { data, error } = await client().from('reading_club_comments').insert({
      post_id:postId, author_id:user.id, body:String(text || '').trim()
    }).select().single();
    if (error) throw friendly(error, 'Le commentaire ne peut pas être envoyé.');
    return data;
  }

  async function toggleClubPostEncouragement(postId, encouraged) {
    await window.BT.auth.ready();
    const user = currentUser(), api = client();
    const result = encouraged
      ? await api.from('reading_club_encouragements').delete().eq('post_id', postId).eq('user_id', user.id)
      : await api.from('reading_club_encouragements').insert({ post_id:postId, user_id:user.id });
    if (result.error) throw friendly(result.error, 'L’encouragement ne peut pas être enregistré.');
  }

  async function toggleClubMembership(clubId, joined) {
    await window.BT.auth.ready();
    const user = currentUser(), api = client();
    if (joined) {
      const { error } = await api.from('reading_club_members').delete().eq('club_id', clubId).eq('user_id', user.id);
      if (error) throw friendly(error, 'Vous ne pouvez pas quitter ce club.');
      return { joined:false, status:null };
    }
    const club = await api.from('reading_clubs').select('access_mode').eq('id', clubId).single();
    if (club.error) throw friendly(club.error, 'Ce club ne peut pas être ouvert.');
    const status = club.data.access_mode === 'open' ? 'active' : 'pending';
    const { error } = await api.from('reading_club_members').insert({ club_id:clubId, user_id:user.id, role:'member', status });
    if (error) throw friendly(error, 'La demande d’adhésion ne peut pas être envoyée.');
    return { joined:status === 'active', status };
  }

  async function addClubMember(clubId, userId, role = 'member') {
    await window.BT.auth.ready();
    const user = currentUser();
    const { error } = await client().from('reading_club_members').upsert({
      club_id:clubId, user_id:userId, role:['moderator','member'].includes(role) ? role : 'member',
      status:'active', invited_by:user.id
    }, { onConflict:'club_id,user_id' });
    if (error) throw friendly(error, 'Ce membre ne peut pas être ajouté.');
  }

  async function removeClubMember(clubId, userId) {
    await window.BT.auth.ready();
    const { error } = await client().from('reading_club_members').delete().eq('club_id', clubId).eq('user_id', userId);
    if (error) throw friendly(error, 'Ce membre ne peut pas être retiré.');
  }

  async function listSalons(clubs = null) {
    await window.BT.auth.ready();
    const user = currentUser();
    const { data, error } = await client().from('reading_salons')
      .select('id, club_id, created_by, title, book_title, scheduled_at, status, created_at, updated_at, reading_salon_participants(user_id, status, share_pages, reading_minutes, joined_at), reading_salon_messages(id, author_id, body, created_at)')
      .order('scheduled_at', { ascending:false });
    if (error) throw friendly(error, 'Les salons ne peuvent pas être chargés.');
    const rows = data || [];
    const userIds = rows.flatMap(salon => (salon.reading_salon_participants || []).map(item => item.user_id)
      .concat((salon.reading_salon_messages || []).map(item => item.author_id)));
    const names = await directoryNames(userIds);
    const clubById = new Map((clubs || await listClubs()).map(club => [club.id, club]));
    return rows.map(salon => {
      const participants = (salon.reading_salon_participants || []).map(item => ({
        userId:item.user_id, name:names.get(item.user_id)?.name || (item.user_id === user.id ? user.name : 'Lecteur BOO-P'),
        status:item.status, sharePages:item.share_pages, minutes:item.reading_minutes
      }));
      const mine = participants.find(item => item.userId === user.id);
      const club = clubById.get(salon.club_id);
      return {
        id:salon.id, remoteId:salon.id, clubId:salon.club_id, clubName:club?.name || 'Club BOO-P',
        title:salon.title, bookTitle:salon.book_title, scheduledAt:salon.scheduled_at,
        status:salon.status, joined:Boolean(mine), myStatus:mine?.status || 'waiting',
        sharePages:Boolean(mine?.sharePages), participants,
        messages:(salon.reading_salon_messages || []).sort((a,b) => new Date(a.created_at) - new Date(b.created_at)).map(message => ({
          id:message.id, authorId:message.author_id,
          authorName:names.get(message.author_id)?.name || (message.author_id === user.id ? user.name : 'Lecteur BOO-P'),
          text:message.body, date:message.created_at
        })),
        canManage:Boolean(club && ['owner','moderator'].includes(club.role)), isRemote:true
      };
    });
  }

  async function createSalon(salon) {
    await window.BT.auth.ready();
    const user = currentUser();
    const { data, error } = await client().from('reading_salons').insert({
      club_id:salon.clubId, created_by:user.id, title:String(salon.title).trim(),
      book_title:String(salon.bookTitle || '').trim(), scheduled_at:salon.scheduledAt,
      status:salon.status || 'scheduled'
    }).select().single();
    if (error) throw friendly(error, 'Le salon ne peut pas être créé.');
    return data;
  }

  async function updateSalon(salonId, updates) {
    await window.BT.auth.ready();
    const payload = {};
    if (updates.title != null) payload.title = String(updates.title).trim();
    if (updates.bookTitle != null) payload.book_title = String(updates.bookTitle).trim();
    if (updates.scheduledAt != null) payload.scheduled_at = updates.scheduledAt;
    if (updates.status != null) payload.status = updates.status;
    const { data, error } = await client().from('reading_salons').update(payload).eq('id', salonId).select().single();
    if (error) throw friendly(error, 'Le salon ne peut pas être modifié.');
    return data;
  }

  async function toggleSalonMembership(salonId, joined) {
    await window.BT.auth.ready();
    const user = currentUser(), api = client();
    const result = joined
      ? await api.from('reading_salon_participants').delete().eq('salon_id', salonId).eq('user_id', user.id)
      : await api.from('reading_salon_participants').insert({ salon_id:salonId, user_id:user.id, status:'waiting' });
    if (result.error) throw friendly(result.error, joined ? 'Le salon ne peut pas être quitté.' : 'Le salon ne peut pas être rejoint.');
  }

  async function updateSalonPresence(salonId, updates) {
    await window.BT.auth.ready();
    const user = currentUser(), payload = {};
    if (updates.status != null) payload.status = updates.status;
    if (updates.sharePages != null) payload.share_pages = Boolean(updates.sharePages);
    if (updates.readingMinutes != null) payload.reading_minutes = Math.max(0, Number(updates.readingMinutes) || 0);
    const { error } = await client().from('reading_salon_participants').update(payload)
      .eq('salon_id', salonId).eq('user_id', user.id);
    if (error) throw friendly(error, 'Votre présence ne peut pas être mise à jour.');
  }

  async function createSalonMessage(salonId, text) {
    await window.BT.auth.ready();
    const user = currentUser();
    const { data, error } = await client().from('reading_salon_messages').insert({
      salon_id:salonId, author_id:user.id, body:String(text || '').trim()
    }).select().single();
    if (error) throw friendly(error, 'Le message ne peut pas être envoyé.');
    return data;
  }

  async function searchReaders(query = '') {
    await window.BT.auth.ready();
    const user = currentUser(), api = client(), clean = String(query || '').trim().slice(0, 80);
    const base = () => api.from('profile_directory').select('user_id, handle, display_name, profile_visibility').neq('user_id', user.id).limit(30);
    const searches = clean
      ? [base().ilike('display_name', `%${clean.replace(/[%_]/g, '')}%`), base().ilike('handle', `%${clean.toLowerCase().replace(/[^a-z0-9_.-]/g, '')}%`)]
      : [base().order('display_name')];
    const results = await Promise.all(searches);
    const failed = results.find(result => result.error);
    if (failed) throw friendly(failed.error, 'La recherche de lecteurs ne peut pas être chargée.');

    const directory = new Map();
    results.flatMap(result => result.data || []).forEach(row => directory.set(row.user_id, row));
    const relationResult = await api.from('friendships')
      .select('id, requester_id, addressee_id, status, created_at, updated_at')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    if (relationResult.error) throw friendly(relationResult.error, 'Les demandes d’amitié ne peuvent pas être chargées.');
    const relationByUser = new Map();
    (relationResult.data || []).forEach(relation => {
      const otherId = relation.requester_id === user.id ? relation.addressee_id : relation.requester_id;
      relationByUser.set(otherId, relation);
    });
    return [...directory.values()].map(row => {
      const relation = relationByUser.get(row.user_id);
      const friendState = !relation ? 'none' : relation.status === 'accepted' ? 'friend' : relation.requester_id === user.id ? 'sent' : 'received';
      return { id:row.user_id, name:row.display_name, handle:`@${row.handle}`, initials:String(row.display_name || 'B').split(/\s+/).map(part => part[0]).slice(0,2).join('').toUpperCase(), bio:'', profileVisibility:row.profile_visibility, friendState, isRemote:true, friendshipId:relation?.id || null };
    }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  async function updateFriend(userId, action) {
    await window.BT.auth.ready();
    const user = currentUser(), api = client();
    const current = await api.from('friendships')
      .select('id, requester_id, addressee_id, status')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`)
      .maybeSingle();
    if (current.error) throw friendly(current.error, 'La relation d’amitié ne peut pas être chargée.');
    let result;
    if (action === 'send') result = await api.from('friendships').insert({ requester_id:user.id, addressee_id:userId, status:'pending' });
    else if (action === 'accept' && current.data) result = await api.from('friendships').update({ status:'accepted', updated_at:new Date().toISOString() }).eq('id', current.data.id);
    else if (['cancel','refuse','remove'].includes(action) && current.data) result = await api.from('friendships').delete().eq('id', current.data.id);
    else return;
    if (result.error) throw friendly(result.error, 'La demande d’amitié ne peut pas être mise à jour.');
  }

  async function getReaderProfile(userId) {
    await window.BT.auth.ready();
    const { data, error } = await client().from('profile_shared_details')
      .select('profile_title, bio, interests, profile_visibility, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw friendly(error, 'Ce profil ne peut pas être ouvert.');
    return data || null;
  }

  return {
    listPosts, createPost, createComment, toggleEncouragement,
    createClub, listClubs, updateClub, toggleClubMembership, addClubMember, removeClubMember,
    getClubSpace, addClubBook, updateClubBook, createClubPost, createClubComment, toggleClubPostEncouragement,
    listSalons, createSalon, updateSalon, toggleSalonMembership, updateSalonPresence, createSalonMessage,
    searchReaders, updateFriend, getReaderProfile, compressPhoto, maxUploadBytes:MAX_UPLOAD_BYTES
  };
})();
