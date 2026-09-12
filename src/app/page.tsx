'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Smile, 
  MoreVertical, 
  CheckCheck, 
  Sparkles, 
  X, 
  Lock, 
  RefreshCw,
  LogOut,
  KeyRound,
  ShieldAlert,
  Trash2,
  Edit3,
  Copy,
  Image as ImageIcon,
  Mic,
  Play,
  Pause,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase, isSupabaseConfigured, Message } from '@/lib/supabase';

export default function ChatApp() {
  const [currentUser, setCurrentUser] = useState<'guest' | 'me' | 'partner'>('guest');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // TELEGRAM USLUBIDAGI ACTION MENU
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);

  // VOICE RECORDING
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // AUDIO PLAYING
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Ekran ochilishi bilan xotiradan login va keshdagi xabarlarni lahzada (instant) yuklash
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('azza_auth_user');
      if (savedUser === 'me' || savedUser === 'partner') {
        setCurrentUser(savedUser);
      }
      const cached = localStorage.getItem('azza_chat_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Xabarlar har o'zgarganda keshni yangilab borish
  const updateMessagesState = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    setMessages((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('azza_chat_cache', JSON.stringify(next));
      } catch (err) {
        // Agar xotira to'lsa (katta rasm/audioda)
        console.warn('Cache quota exceeded:', err);
      }
      return next;
    });
  };

  // Xabarni parse qilish (oddiy text yoki maxsus json media/edit ma'lumotlari)
  const parseIncomingMsg = (raw: any): Message => {
    let text = raw.text || '';
    let media_url = raw.media_url || undefined;
    let media_type = raw.media_type || undefined;
    let is_edited = raw.is_edited || false;

    // Agar text ichida maxsus json format saqlangan bo'lsa
    if (typeof text === 'string' && text.startsWith('__PAYLOAD_JSON__:')) {
      try {
        const parsed = JSON.parse(text.replace('__PAYLOAD_JSON__:', ''));
        text = parsed.text || '';
        media_url = parsed.media_url || media_url;
        media_type = parsed.media_type || media_type;
        is_edited = parsed.is_edited !== undefined ? parsed.is_edited : is_edited;
      } catch {}
    }

    return {
      id: raw.id,
      sender_id: raw.sender_id,
      text,
      media_url,
      media_type,
      is_edited,
      is_read: raw.is_read || false,
      created_at: raw.created_at
    };
  };

  // 2. Xabarlarni Supabase orqali yuklash (Ultra-fast)
  const loadMessages = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(200);

      if (!error && data) {
        const parsedList = data.map(parseIncomingMsg);
        updateMessagesState(parsedList);
      }
    } catch (e) {
      console.error('Fetch error:', e);
    }
  };

  useEffect(() => {
    if (currentUser !== 'guest') {
      loadMessages();
    }
  }, [currentUser]);

  // 3. Supabase Realtime (INSERT, UPDATE, DELETE)
  useEffect(() => {
    const client = supabase;
    if (!client || currentUser === 'guest') return;

    const channel = client
      .channel('chat_room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = parseIncomingMsg(payload.new);
          updateMessagesState((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedMsg = parseIncomingMsg(payload.new);
          updateMessagesState((prev) => {
            return prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m));
          });
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as { id: string }).id;
          updateMessagesState((prev) => {
            return prev.filter((m) => m.id !== deletedId);
          });
        }
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [currentUser]);

  // Pastga scroll qilish
  useEffect(() => {
    if (currentUser !== 'guest' && !editingMessage) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, currentUser, editingMessage]);

  // Parol tekshirish
  const handleLogin = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const cleanPass = passwordInput.trim().toLowerCase();

    if (cleanPass === 's0nd') {
      setCurrentUser('me');
      try { localStorage.setItem('azza_auth_user', 'me'); } catch {}
      setAuthError('');
    } else if (cleanPass === 'aziza') {
      setCurrentUser('partner');
      try { localStorage.setItem('azza_auth_user', 'partner'); } catch {}
      setAuthError('');
    } else {
      setAuthError('Noto‘g‘ri parol! Parol faqat: aziza yoki s0nd');
    }
  };

  const handleLogout = () => {
    try { localStorage.removeItem('azza_auth_user'); } catch {}
    setCurrentUser('guest');
    setPasswordInput('');
    setAuthError('');
    setShowProfileDrawer(false);
  };

  // Yangi xabar jo'natish
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmed = inputText.trim();
    if (!trimmed || currentUser === 'guest') return;

    const newMsg: Message = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sender_id: currentUser as 'me' | 'partner',
      text: trimmed,
      is_read: false,
      created_at: new Date().toISOString()
    };

    updateMessagesState((prev) => [...prev, newMsg]);
    setInputText('');

    if (supabase) {
      await supabase.from('messages').insert([
        {
          id: newMsg.id,
          sender_id: newMsg.sender_id,
          text: newMsg.text,
          created_at: newMsg.created_at,
          is_read: false
        }
      ]);
    }

    if (trimmed.includes('❤️') || trimmed.toLowerCase().includes('sevaman') || trimmed.toLowerCase().includes('love')) {
      try {
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.8 } });
      } catch {}
    }

    inputRef.current?.focus();
  };

  // XABARNI BOSIB TURISH (LONG PRESS)
  const handleTouchStart = (msg: Message) => {
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMessage(msg);
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(40);
      }
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // XABARNI O'CHIRISH (DELETE)
  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    const targetId = selectedMessage.id;
    setSelectedMessage(null);

    // UI'dan tezkor o'chirish va keshni yangilash
    updateMessagesState((prev) => prev.filter((m) => m.id !== targetId));

    if (supabase) {
      await supabase.from('messages').delete().eq('id', targetId);
    }
  };

  // XABARNI NUSXALASH (COPY)
  const handleCopyText = () => {
    if (!selectedMessage?.text) return;
    navigator.clipboard.writeText(selectedMessage.text);
    setSelectedMessage(null);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  // XABARNI TAHRIRLASHNI BOSHLASH
  const handleStartEdit = () => {
    if (!selectedMessage) return;
    setEditingMessage(selectedMessage);
    setEditText(selectedMessage.text || '');
    setSelectedMessage(null);
    setTimeout(() => {
      editInputRef.current?.focus();
    }, 100);
  };

  // TAHRIRNI SAQLASH (EDIT SAVE)
  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!editingMessage) return;
    const newText = editText.trim();
    if (!newText) return;

    const targetId = editingMessage.id;

    // 1. UI va keshda darhol ko'rsatish
    updateMessagesState((prev) => 
      prev.map((m) => (m.id === targetId ? { ...m, text: newText, is_edited: true } : m))
    );

    // Tozalash
    setEditingMessage(null);
    setEditText('');

    // 2. Supabase'ga yozish (har qanday schema bilan xatosiz ishlashi uchun)
    if (supabase) {
      const payloadText = `__PAYLOAD_JSON__:${JSON.stringify({ text: newText, is_edited: true })}`;
      await supabase
        .from('messages')
        .update({ text: payloadText })
        .eq('id', targetId);
    }
  };

  // RASM YUKLASH (IMAGE)
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || currentUser === 'guest') return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Url = reader.result as string;

      const newMsg: Message = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        sender_id: currentUser as 'me' | 'partner',
        text: '',
        media_url: base64Url,
        media_type: 'image',
        is_read: false,
        created_at: new Date().toISOString()
      };

      updateMessagesState((prev) => [...prev, newMsg]);

      if (supabase) {
        const payloadText = `__PAYLOAD_JSON__:${JSON.stringify({
          text: '',
          media_url: base64Url,
          media_type: 'image'
        })}`;

        await supabase.from('messages').insert([
          {
            id: newMsg.id,
            sender_id: newMsg.sender_id,
            text: payloadText,
            created_at: newMsg.created_at,
            is_read: false
          }
        ]);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // OVOZ YOZISH (VOICE / GOLOS) - iOS Safari va Android uchun to'liq moslangan
  const handleStartRecording = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      alert('Brauzeringiz mikrofonga ruxsat bermayapti (HTTPS yoki Safari sozlamalarini tekshiring)');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const selectedType = mimeType || mediaRecorder.mimeType || 'audio/mp4';
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;

          const newMsg: Message = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            sender_id: currentUser as 'me' | 'partner',
            text: `🎤 Ovozli xabar (${recordingDuration || 1}s)`,
            media_url: base64Audio,
            media_type: 'voice',
            is_read: false,
            created_at: new Date().toISOString()
          };

          updateMessagesState((prev) => [...prev, newMsg]);

          if (supabase) {
            const payloadText = `__PAYLOAD_JSON__:${JSON.stringify({
              text: `🎤 Ovozli xabar (${recordingDuration || 1}s)`,
              media_url: base64Audio,
              media_type: 'voice'
            })}`;

            await supabase.from('messages').insert([
              {
                id: newMsg.id,
                sender_id: newMsg.sender_id,
                text: payloadText,
                created_at: newMsg.created_at,
                is_read: false
              }
            ]);
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      // Har 250ms da audio bo'laklarini yig'ish (kesilib qolmasligi uchun)
      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.error("Mic error:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`Mikrofon xatosi: ${errorMsg}. iOS Safari sozlamalarida "Microphone"ga ruxsat yoqilganligini tekshiring.`);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const handleTogglePlayAudio = (msgId: string, url?: string) => {
    if (!url) return;

    if (playingAudio === msgId) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      setPlayingAudio(msgId);
      audio.onended = () => {
        setPlayingAudio(null);
      };
    }
  };

  // ==========================================
  // 1. LOGIN EKRANI
  // ==========================================
  if (currentUser === 'guest') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] w-full bg-[#0e1621] px-5 select-none">
        <div className="w-full max-w-sm bg-[#17212b] border border-[#242f3d] rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
          
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-600 flex items-center justify-center shadow-lg mb-4 ring-4 ring-pink-500/20">
            <Lock className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-xl font-bold text-white mb-1">Maxfiy Joy</h1>
          <p className="text-xs text-[#7f91a4] mb-6">
            Kirish uchun parolingizni kiriting
          </p>

          <form onSubmit={handleLogin} className="w-full space-y-4">
            <div>
              <input 
                type="text"
                placeholder="Parolni yozing..."
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (authError) setAuthError('');
                }}
                className="w-full bg-[#242f3d] text-white text-center text-base rounded-2xl py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-[#6ab2f2] placeholder-[#7f91a4]"
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
              />
            </div>

            {authError && (
              <div className="flex items-center justify-center space-x-1.5 text-xs text-red-400 bg-red-500/10 py-2.5 px-3 rounded-xl border border-red-500/20">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-[#6ab2f2] active:bg-[#529cd8] text-white font-semibold py-3.5 rounded-2xl shadow-lg transition active:scale-[0.98] cursor-pointer"
            >
              Kirish
            </button>
          </form>

          <div className="mt-6 flex items-center space-x-1.5 text-[11px] text-[#7f91a4]">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Faqat ikkingiz uchun xavfsiz</span>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // 2. ASOSIY TELEGRAM CHAT EKRANI
  // ==========================================
  const partnerDisplayName = currentUser === 'me' ? 'Aziza 🤍' : 'Sizning Yoringiz 🤍';

  // Tanlangan xabar faqat o'zinikimi? (Faqat o'zinikini edit/delete qilish uchun)
  const isSelectedMsgMine = selectedMessage ? selectedMessage.sender_id === currentUser : false;

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto bg-[#0e1621] text-white overflow-hidden shadow-2xl relative">
      
      {/* HEADER */}
      <header className="safe-top shrink-0 bg-[#17212b] border-b border-[#202b36] px-3 py-2.5 flex items-center justify-between z-30 shadow">
        <div 
          onClick={() => setShowProfileDrawer(true)}
          className="flex items-center space-x-2.5 cursor-pointer active:opacity-80"
        >
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center font-bold text-base text-white shadow-md">
            <span>{partnerDisplayName[0]}</span>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#17212b] rounded-full"></span>
          </div>
          <div>
            <div className="flex items-center space-x-1">
              <span className="font-semibold text-sm sm:text-base leading-tight">{partnerDisplayName}</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-xs text-emerald-400 font-medium">onlayn</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#242f3d] text-[#6ab2f2] border border-[#3b4b5e]">
            {currentUser === 'me' ? 'Men' : 'Aziza'}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              loadMessages().finally(() => setIsRefreshing(false));
            }}
            className="p-2 text-[#7f91a4] hover:text-white active:bg-[#242f3d] rounded-full"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#6ab2f2]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowProfileDrawer(true)}
            className="p-2 text-[#7f91a4] hover:text-white active:bg-[#242f3d] rounded-full"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CHAT XABARLARI */}
      <main className="flex-1 overflow-y-auto px-3 py-3 tg-chat-bg space-y-2.5 overscroll-contain">
        
        <div className="flex justify-center my-1 select-none">
          <span className="px-3 py-0.5 bg-[#182533]/90 text-[11px] text-[#7f91a4] rounded-full">
            Bugun
          </span>
        </div>

        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUser;
          const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isMsgSelected = selectedMessage?.id === msg.id;

          return (
            <div 
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-0.5`}
            >
              {/* Xabar pufakchasi (Telegram smooth touch) */}
              <div 
                onTouchStart={() => handleTouchStart(msg)}
                onTouchEnd={handleTouchEnd}
                onMouseDown={() => handleTouchStart(msg)}
                onMouseUp={handleTouchEnd}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelectedMessage(msg);
                }}
                className={`relative max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm cursor-pointer select-none transition-all duration-200 ${
                  isMsgSelected ? 'ring-2 ring-[#6ab2f2] scale-[0.98]' : 'active:scale-[0.98]'
                } ${
                  isMe 
                    ? 'bg-[#2b5278] text-white rounded-br-xs' 
                    : 'bg-[#182533] text-white rounded-bl-xs'
                }`}
              >
                {/* RASM KO'RINISHI */}
                {msg.media_type === 'image' && msg.media_url && (
                  <div className="mb-1 rounded-xl overflow-hidden max-h-72">
                    <img 
                      src={msg.media_url} 
                      alt="rasm" 
                      className="w-full h-auto object-cover rounded-xl"
                    />
                  </div>
                )}

                {/* GOLOS (OVOZ) KO'RINISHI */}
                {msg.media_type === 'voice' && msg.media_url && (
                  <div className="flex items-center space-x-3 py-1 pr-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePlayAudio(msg.id, msg.media_url);
                      }}
                      className="w-10 h-10 rounded-full bg-[#6ab2f2] text-white flex items-center justify-center shrink-0 shadow active:scale-95 transition"
                    >
                      {playingAudio === msg.id ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 ml-0.5" />
                      )}
                    </button>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-white/90">Ovozli xabar</span>
                      <div className="flex items-center space-x-1 mt-0.5">
                        <span className="w-1 h-3 bg-[#6ab2f2] rounded-full animate-pulse"></span>
                        <span className="w-1 h-5 bg-[#6ab2f2] rounded-full animate-pulse"></span>
                        <span className="w-1 h-2 bg-[#6ab2f2] rounded-full animate-pulse"></span>
                        <span className="w-1 h-4 bg-[#6ab2f2] rounded-full animate-pulse"></span>
                        <span className="text-[11px] text-white/60 ml-2">
                          {playingAudio === msg.id ? 'Eshitilmoqda...' : '0:05'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* MATN */}
                {msg.text && (
                  <div className="break-words select-text">
                    {msg.text}
                  </div>
                )}

                {/* VAQT, EDITED VA STATUS */}
                <div className="flex items-center justify-end space-x-1 mt-1 text-[10px] text-white/60 float-right ml-2.5">
                  {msg.is_edited && (
                    <span className="italic text-[#8bb8e4] text-[9.5px] mr-0.5">tahrirlangan</span>
                  )}
                  <span>{time}</span>
                  {isMe && <CheckCheck className="w-3 h-3 text-[#6ab2f2]" />}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </main>

      {/* COPIED TOAST BILDIRISHNOMA */}
      {copiedToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-[#182533]/95 border border-[#2b394a] text-white text-xs px-4 py-2 rounded-full shadow-2xl z-40 flex items-center space-x-1.5 animate-in fade-in zoom-in-95 duration-150">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Xabar nusxalandi</span>
        </div>
      )}

      {/* EMOJI BAR */}
      {showEmojiPicker && (
        <div className="bg-[#17212b] border-t border-[#202b36] px-2 py-2 flex items-center justify-around text-xl">
          {['❤️', '😍', '🥰', '😘', '🔥', '✨', '🥺', '🌸'].map((emoji) => (
            <button 
              key={emoji}
              type="button"
              onClick={() => {
                if (editingMessage) {
                  setEditText(prev => prev + emoji);
                } else {
                  setInputText(prev => prev + emoji);
                }
                setShowEmojiPicker(false);
              }}
              className="p-1 active:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* TAHRIRLASH (EDIT) PANEL - KAFOLATLANGAN VA ISHONCHLI */}
      {editingMessage ? (
        <footer className="safe-bottom shrink-0 bg-[#17212b] border-t border-[#202b36] p-2.5 animate-in slide-in-from-bottom duration-150">
          <div className="flex items-center justify-between pb-1 px-2 text-xs text-[#6ab2f2]">
            <div className="flex items-center space-x-1.5 truncate">
              <Edit3 className="w-3.5 h-3.5 shrink-0" />
              <span className="font-semibold">Xabarni tahrirlash</span>
            </div>
            <button 
              type="button"
              onClick={() => { setEditingMessage(null); setEditText(''); }}
              className="text-[#7f91a4] hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveEdit} className="flex items-center space-x-2 mt-1">
            <input 
              ref={editInputRef}
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Xabarni o'zgartiring..."
              className="flex-1 min-w-0 bg-[#242f3d] text-white text-[15px] rounded-full px-4 py-2.5 focus:outline-none focus:ring-1.5 focus:ring-[#6ab2f2]"
              autoComplete="off"
            />
            <button 
              type="submit"
              disabled={!editText.trim()}
              className="w-10 h-10 rounded-full bg-emerald-500 active:bg-emerald-600 text-white shadow-md flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer"
              title="Saqlash"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
            </button>
          </form>
        </footer>
      ) : isRecording ? (
        /* OVOZ YOZISH REJIMI */
        <footer className="safe-bottom shrink-0 bg-[#17212b] border-t border-[#202b36] p-3 flex items-center justify-between z-20 animate-in slide-in-from-bottom">
          <div className="flex items-center space-x-2.5">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
            <span className="text-sm font-medium text-red-400">
              Ovoz yozilmoqda... {recordingDuration}s
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleCancelRecording}
              className="text-xs text-[#7f91a4] hover:text-white px-2 py-1"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={handleStopRecording}
              className="p-2.5 bg-[#6ab2f2] text-white rounded-full active:scale-95 shadow"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </footer>
      ) : (
        /* STANDART INPUT PANEL */
        <footer className="safe-bottom shrink-0 bg-[#17212b] border-t border-[#202b36] p-2.5">
          <form 
            onSubmit={handleSendMessage}
            className="flex items-center space-x-1.5 sm:space-x-2"
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageSelect}
            />

            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[#7f91a4] hover:text-white active:bg-[#242f3d] rounded-full shrink-0"
              title="Rasm yuborish"
            >
              <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <button 
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-[#7f91a4] hover:text-[#6ab2f2] active:bg-[#242f3d] rounded-full shrink-0"
            >
              <Smile className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <input 
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Xabar yozing..."
              className="flex-1 min-w-0 bg-[#242f3d] text-white text-[15px] rounded-full px-4 py-2.5 focus:outline-none focus:ring-1.5 focus:ring-[#6ab2f2] placeholder-[#7f91a4]"
              autoComplete="off"
              autoCorrect="off"
            />

            {inputText.trim() ? (
              <button 
                type="submit"
                className="w-10 h-10 rounded-full bg-[#6ab2f2] active:bg-[#529cd8] text-white shadow-md flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer"
                title="Yuborish"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleStartRecording}
                className="w-10 h-10 rounded-full bg-[#242f3d] active:bg-[#2f3f52] text-[#6ab2f2] shadow-md flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer"
                title="Ovozli xabar yozish"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </form>
        </footer>
      )}

      {/* TELEGRAM iOS USLUBIDAGI SMOOTH ACTION SHEET (XABARNI BOSIB TURGANDA) */}
      {selectedMessage && (
        <div 
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex flex-col justify-end p-3 animate-in fade-in duration-150"
          onClick={() => setSelectedMessage(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm mx-auto space-y-2 animate-in slide-in-from-bottom duration-200"
          >
            {/* Tanlangan xabar preview kartasi */}
            <div className="bg-[#17212b]/95 backdrop-blur-md border border-[#2b394a] rounded-2xl p-3 px-4 shadow-xl">
              <span className="text-[11px] text-[#7f91a4] font-medium block mb-0.5">
                {isSelectedMsgMine ? 'Sizning xabaringiz' : `${partnerDisplayName} xabari`}
              </span>
              <p className="text-sm text-white/90 line-clamp-2">
                {selectedMessage.text || (selectedMessage.media_type === 'image' ? '📷 Rasm' : '🎤 Ovozli xabar')}
              </p>
            </div>

            {/* Asosiy amallar bloki */}
            <div className="bg-[#17212b]/95 backdrop-blur-md border border-[#2b394a] rounded-2xl overflow-hidden shadow-2xl divide-y divide-[#242f3d]">
              
              {/* Nusxalash */}
              {selectedMessage.text && (
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="w-full flex items-center justify-between px-4 py-3.5 active:bg-[#242f3d] text-sm text-white font-medium transition"
                >
                  <span>Nusxalash (Copy)</span>
                  <Copy className="w-4 h-4 text-[#7f91a4]" />
                </button>
              )}

              {/* Tahrirlash (FAQAT O'ZINING XABARI VA TEXT BO'LSA) */}
              {isSelectedMsgMine && selectedMessage.text && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="w-full flex items-center justify-between px-4 py-3.5 active:bg-[#242f3d] text-sm text-[#6ab2f2] font-medium transition"
                >
                  <span>Tahrirlash (Edit)</span>
                  <Edit3 className="w-4 h-4 text-[#6ab2f2]" />
                </button>
              )}

              {/* O'chirish (FAQAT O'ZINING XABARI BO'LSA) */}
              {isSelectedMsgMine && (
                <button
                  type="button"
                  onClick={handleDeleteMessage}
                  className="w-full flex items-center justify-between px-4 py-3.5 active:bg-red-500/20 text-sm text-red-400 font-medium transition"
                >
                  <span>O‘chirish (Delete)</span>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              )}

              {/* Agar birovning xabari bo'lsa ma'lumot berish */}
              {!isSelectedMsgMine && (
                <div className="px-4 py-3 text-xs text-[#7f91a4] text-center italic">
                  Siz faqat o‘zingiz yozgan xabarlarni tahrirlay yoki o‘chira olasiz
                </div>
              )}
            </div>

            {/* Yopish tugmasi (iOS Style) */}
            <button
              type="button"
              onClick={() => setSelectedMessage(null)}
              className="w-full py-3.5 rounded-2xl bg-[#242f3d] active:bg-[#2e3e52] text-sm font-semibold text-white text-center shadow-lg transition"
            >
              Bekor qilish
            </button>
          </div>
        </div>
      )}

      {/* PROFIL VA CHIQISH (LOGOUT) */}
      {showProfileDrawer && (
        <div className="absolute inset-0 bg-[#17212b] z-50 flex flex-col animate-in slide-in-from-right duration-200 safe-top safe-bottom">
          <div className="px-4 py-3 border-b border-[#202b36] flex items-center justify-between">
            <span className="font-semibold text-white">Profil va Sozlamalar</span>
            <button 
              type="button"
              onClick={() => setShowProfileDrawer(false)}
              className="p-1 text-[#7f91a4] hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="flex flex-col items-center py-4 bg-[#242f3d]/50 rounded-2xl border border-[#2f3f52]">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-500 flex items-center justify-center font-bold text-3xl shadow-xl">
                <span>{currentUser === 'me' ? 'S' : 'A'}</span>
              </div>
              <h3 className="font-bold text-lg mt-2">
                {currentUser === 'me' ? 'Siz (Admin)' : 'Aziza'}
              </h3>
              <span className="text-xs text-emerald-400 mt-0.5">Xavfsiz ulanish faol</span>
            </div>

            <div className="bg-[#242f3d]/60 rounded-2xl p-4 border border-[#2f3f52] space-y-2 text-xs">
              <span className="text-[#7f91a4] block">Supabase Realtime:</span>
              <span className={isSupabaseConfigured ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                {isSupabaseConfigured ? '✓ Jonli serverga ulangan' : 'Lokal xotira'}
              </span>
            </div>

            <button 
              type="button"
              onClick={handleLogout}
              className="w-full py-3 rounded-2xl bg-red-500/10 active:bg-red-500/20 text-red-400 border border-red-500/20 text-sm font-semibold flex items-center justify-center space-x-2 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Akkauntdan chiqish (Logout)</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
