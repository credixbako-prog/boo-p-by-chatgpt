/**
 * BOOP — Speech Recognition (Web Speech API)
 * Module BT.speech : Dictaphone IA avec transcription FR/EN
 */

BT.speech = (function () {
  'use strict';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  let recognition = null;
  let isListening = false;
  let fullTranscript = '';
  let interimTranscript = '';
  let onResultCallback = null;
  let onEndCallback = null;
  let currentLang = 'fr-FR';

  function isSupported() {
    return !!SpeechRecognition;
  }

  function init(options = {}) {
    if (!isSupported()) {
      console.warn('Web Speech API not supported in this browser');
      return false;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = options.lang || currentLang;
    recognition.maxAlternatives = 1;

    recognition.onresult = function (event) {
      interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          fullTranscript += result[0].transcript + ' ';
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      if (onResultCallback) {
        onResultCallback({
          final: fullTranscript.trim(),
          interim: interimTranscript.trim(),
          combined: (fullTranscript + interimTranscript).trim()
        });
      }
    };

    recognition.onerror = function (event) {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        alert('Accès au microphone refusé. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.');
      }
    };

    recognition.onend = function () {
      isListening = false;
      if (onEndCallback) {
        onEndCallback({
          transcript: fullTranscript.trim(),
          lang: currentLang
        });
      }
    };

    return true;
  }

  function start(options = {}) {
    if (!recognition) {
      if (!init(options)) return false;
    }

    if (options.lang && options.lang !== currentLang) {
      currentLang = options.lang;
      recognition.lang = currentLang;
    }

    fullTranscript = '';
    interimTranscript = '';
    isListening = true;

    try {
      recognition.start();
      return true;
    } catch (e) {
      console.warn('Speech start error:', e);
      return false;
    }
  }

  function stop() {
    if (recognition && isListening) {
      recognition.stop();
      isListening = false;
    }
    return fullTranscript.trim();
  }

  function toggleLang() {
    currentLang = currentLang === 'fr-FR' ? 'en-US' : 'fr-FR';
    if (recognition) recognition.lang = currentLang;
    return currentLang;
  }

  function getLang() {
    return currentLang;
  }

  function onResult(cb) { onResultCallback = cb; }
  function onEnd(cb) { onEndCallback = cb; }

  return {
    isSupported,
    init,
    start,
    stop,
    toggleLang,
    getLang,
    onResult,
    onEnd,
    isListening: function () { return isListening; }
  };
})();
