export function createMeter() {
  const seen=new Set(), responses=[], transcriptions=[];
  return {
    add(event) {
      const response=event.type==='response.done' ? event.response : null;
      const transcription=event.type==='conversation.item.input_audio_transcription.completed';
      const id=response?.id || (transcription && event.item_id);
      if(!id || seen.has(id)) return;
      seen.add(id);
      if(response) responses.push({id,status:response.status,usage:response.usage || null});
      else transcriptions.push({id,usage:event.usage || null});
    },
    snapshot() {
      const sum=(items,path)=>items.reduce((total,item)=>{const value=path.reduce((v,k)=>v?.[k],item);return total===null || !Number.isFinite(value)?null:total+value;},0);
      const inputAudio=sum(responses,['usage','input_token_details','audio_tokens']);
      const inputText=sum(responses,['usage','input_token_details','text_tokens']);
      const outputAudio=sum(responses,['usage','output_token_details','audio_tokens']);
      const outputText=sum(responses,['usage','output_token_details','text_tokens']);
      const cachedAudio=sum(responses,['usage','input_token_details','cached_tokens_details','audio_tokens']);
      const cachedText=sum(responses,['usage','input_token_details','cached_tokens_details','text_tokens']);
      const values=[inputAudio,inputText,outputAudio,outputText,cachedAudio,cachedText];
      const estimatedResponseUSD=responses.length && values.every(v=>v!==null) && cachedAudio<=inputAudio && cachedText<=inputText
        ? ((inputAudio-cachedAudio)*32+cachedAudio*.4+(inputText-cachedText)*4+cachedText*.4+outputAudio*64+outputText*24)/1e6 : null;
      return {model:'gpt-realtime-2.1',pricingDate:'2026-09-09',responses:structuredClone(responses),transcriptions:structuredClone(transcriptions),inputAudio,inputText,outputAudio,outputText,cachedAudio,cachedText,estimatedResponseUSD,notice:'Événements reçus par ce navigateur ; estimation hors transcription, taxes et événements éventuellement perdus. Vérifier la facture OpenAI.'};
    }
  };
}
