/** BOO-P — persistance Supabase des Traces, commentaires, encouragements, clubs et photos. */
window.BT = window.BT || {};

BT.community = (() => {
  'use strict';

  const BUCKET = 'community-media';
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
  const MAX_EDGE = 1920;

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
    const { data, error } = await client().storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) { console.warn('Photo BOO-P indisponible', error); return null; }
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
      const upload = await api.storage.from(BUCKET).upload(photoPath, photo, { contentType:photo.type, cacheControl:'3600', upsert:false });
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
    return data;
  }

  return { listPosts, createPost, createComment, toggleEncouragement, createClub, compressPhoto, maxUploadBytes:MAX_UPLOAD_BYTES };
})();
