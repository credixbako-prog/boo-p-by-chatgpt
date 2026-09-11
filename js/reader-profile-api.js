window.BT=window.BT || {};
BT.readerProfileApi=(()=>{
  const api=()=>BT.auth.getClient();
  const who=()=>BT.auth.isAuthenticated() && !BT.auth.isGuest()?BT.auth.getCurrentUser()?.id:null;
  async function ready(expected=who()) {await BT.auth.ready();if(!expected || who()!==expected)throw new Error('Reconnectez-vous et rouvrez ce profil.');return expected;}
  function result(r){if(r.error)throw new Error(({42501:'Cet échange n’est plus accessible. Rouvrez le profil pour vérifier vos accès.',23503:'Cet échange a changé. Rouvrez-le avant de répondre.',23505:'Cet encouragement est déjà enregistré. Actualisez l’échange.'})[r.error.code] || r.error.message || 'Le profil ne peut pas être chargé.');return r.data;}
  async function identity(id){const viewer=await ready();const p=result(await api().from('profile_directory').select('user_id,display_name,handle,profile_visibility').eq('user_id',id).maybeSingle());if(!p)return null;
    const f=id===viewer?null:result(await api().from('friendships').select('id,requester_id,status').or(`and(requester_id.eq.${viewer},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${viewer})`).maybeSingle());
    return {id:p.user_id,name:p.display_name,handle:'@'+p.handle,profileVisibility:p.profile_visibility,initials:p.display_name.split(/\s+/).map(s=>s[0]).slice(0,2).join(''),isRemote:true,friendshipId:f?.id,friendState:!f?'none':f.status==='accepted'?'friend':f.requester_id===viewer?'sent':'received'};}
  async function preferences(id){await ready();return result(await api().from('reader_preferences').select('welcome,show_current,featured').eq('user_id',id).maybeSingle()) || {welcome:'',show_current:true,featured:[]};}
  async function savePreferences(p,expected){const id=await ready(expected);return result(await api().from('reader_preferences').upsert({user_id:id,welcome:p.welcome.trim(),show_current:p.show_current,featured:p.featured}).select().single());}
  async function books(id,shelf='all',after='',bookId=''){await ready();return result(await api().rpc('get_reader_profile_books',{target_user:id,shelf,after_id:after,book_id:bookId}));}
  async function publications(id,kind='all',offset=0,bookId=null){await ready();let q=api().from('community_posts').select('id,author_id,author_name,book_title,body,visibility,reading_kind,reading_source_id,activity_type,created_at',{count:'exact'}).eq('author_id',id).in('visibility',['public','friends']).order('created_at',{ascending:false}).order('id').range(offset,offset+11);if(kind==='notebook')q=q.eq('reading_kind','notebook');else if(kind!=='all')q=q.eq('reading_kind',kind);if(bookId)q=q.eq('reading_source_id',bookId).in('reading_kind',['notebook','debut','fin']);const r=await q;return {rows:result(r)||[],count:r.count};}
  async function publication(id){await BT.auth.ready();return result(await api().from('community_posts').select('id,author_id,author_name,book_title,body,visibility,reading_kind,reading_source_id,reading_content').eq('id',id).maybeSingle());}
  async function thread(target,offset=0){const user=await ready();
    if(target.post){const post=await publication(target.post);if(!post)throw new Error('Cette publication n’est plus accessible.');
      const [traces,likes,mine]=await Promise.all([
        api().from('community_comments').select('id,author_id,author_name,body,parent_id,created_at',{count:'exact'}).eq('post_id',target.post).order('created_at').order('id').range(offset,offset+49),
        api().from('community_encouragements').select('user_id',{count:'exact',head:true}).eq('post_id',target.post),
        api().from('community_encouragements').select('user_id').eq('post_id',target.post).eq('user_id',user).maybeSingle()]);
      result(likes);return {rows:result(traces)||[],total:traces.count,count:likes.count,mine:!!result(mine),owner:post.author_id,audience:post.visibility==='public'?'Public · visible même sans compte':post.visibility==='friends'?'Visible par les amis de l’auteur':'Visible par l’auteur'};
    }
    const book=await books(target.owner,'all','',target.book);if(!book.available || !book.books.length)throw new Error('Cette lecture n’est plus accessible.');
    const base=()=>api().from('reader_book_interactions');
    const [traces,likes,mine]=await Promise.all([
      base().select('id,author_id,body,parent_id,created_at',{count:'exact'}).eq('owner_id',target.owner).eq('book_id',target.book).eq('kind','trace').order('created_at').order('id').range(offset,offset+49),
      base().select('id',{count:'exact',head:true}).eq('owner_id',target.owner).eq('book_id',target.book).eq('kind','encouragement'),
      base().select('id').eq('owner_id',target.owner).eq('book_id',target.book).eq('kind','encouragement').eq('author_id',user).maybeSingle()]);
    const rows=result(traces)||[];result(likes);const ids=[...new Set(rows.map(r=>r.author_id))];
    const names=ids.length?result(await api().from('profile_directory').select('user_id,display_name').in('user_id',ids)):[];
    return {rows:rows.map(r=>({...r,author_name:names.find(n=>n.user_id===r.author_id)?.display_name || 'Lecteur BOO-P'})),total:traces.count,count:likes.count,mine:result(mine)?.id || null,owner:target.owner,audience:'Visible par ce lecteur et ses amis acceptés'};
  }
  async function trace(target,text,parent,expected){const id=await ready(expected),body=String(text).trim();if(!body || body.length>1200)throw new Error('Écrivez une Trace de 1 à 1 200 caractères.');
    const record=target.post?{post_id:target.post,author_id:id,author_name:BT.auth.getCurrentUser().name,body,parent_id:parent || null}:{owner_id:target.owner,book_id:target.book,author_id:id,kind:'trace',body,parent_id:parent || null};
    return result(await api().from(target.post?'community_comments':'reader_book_interactions').insert(record).select('id').single());
  }
  async function encourage(target,mine,expected){const id=await ready(expected);
    if(target.post){const q=api().from('community_encouragements');return result(await(mine?q.delete().eq('post_id',target.post).eq('user_id',id):q.insert({post_id:target.post,user_id:id})));}
    const q=api().from('reader_book_interactions');return result(await(mine?q.delete().eq('id',mine).eq('author_id',id):q.insert({owner_id:target.owner,book_id:target.book,author_id:id,kind:'encouragement',body:'Bonne lecture !'})));
  }
  async function removeTrace(target,id,expected){await ready(expected);let query=api().from(target.post?'community_comments':'reader_book_interactions').delete().eq('id',id);query=target.post?query.eq('post_id',target.post):query.eq('owner_id',target.owner).eq('book_id',target.book).eq('kind','trace');const rows=result(await query.select('id'));if(!rows?.length)throw new Error('Cette Trace ne peut plus être supprimée.');}
  return {identity,preferences,savePreferences,books,publications,publication,thread,trace,encourage,removeTrace};
})();
