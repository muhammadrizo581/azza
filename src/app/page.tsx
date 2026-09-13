'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Video,
  Play,
  Pause,
  Check,
  Volume2,
  VolumeX,
  Reply
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase, isSupabaseConfigured, Message } from '@/lib/supabase';

// VAQTNI FORMATLASH (0:05, 1:24)
function formatDuration(sec?: number) {
  if (!sec || isNaN(sec) || sec <= 0) return '0:01';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// OXIRGI KIRGAN VAQTNI TELEGRAM USLUBIDA FORMATLASH
function formatLastSeen(isoString?: string | null): string {
  if (!isoString) return 'oxirgi marta yaqinda';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'oxirgi marta yaqinda';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'online';

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffMin < 1) return 'hozirgina chiqdi';
    if (diffMin < 2) return '1 daqiqa oldin onlayn edi';
    if (diffMin < 5) return `${diffMin} daqiqa oldin onlayn edi`;

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `oxirgi marta bugun ${timeStr} da`;
    }
    if (isYesterday) {
      return `oxirgi marta kecha ${timeStr} da`;
    }

    const day = date.getDate();
    const months = [
      'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
      'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
    ];
    const monthStr = months[date.getMonth()];
    return `oxirgi marta ${day}-${monthStr} ${timeStr} da`;
  } catch {
    return 'oxirgi marta yaqinda';
  }
}

// TELEGRAM YUMALOQ VIDEO NOTE KOMPONENTI (TORTBURCHAKSIZ, BORDERSIZ, TOZA YUMALOQ)
function TelegramVideoNote({
  msg,
  isMe,
  time,
  isSelected,
  onTouchStart,
  onTouchEnd,
  onContextMenu,
  partnerDisplayName,
  currentUser,
  onReplyClick,
  isHighlighted,
  onDoubleClick,
  onToggleReaction,
}: {
  msg: Message;
  isMe: boolean;
  time: string;
  isSelected: boolean;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  partnerDisplayName?: string;
  currentUser?: string;
  onReplyClick?: (replyId: string) => void;
  isHighlighted?: boolean;
  onDoubleClick?: () => void;
  onToggleReaction?: (msgId: string, emoji: string) => void;
}) {
  const [isPlayingWithSound, setIsPlayingWithSound] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoSource, setVideoSource] = useState<string>('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // iOS Safari va boshqa mobil brauzerlar data: URL videolarni AVPlayer orqali o'qiy olmaydi (qora ekran bo'lib qoladi).
  // Shuning uchun data: URL ni darhol toza Blob URL ga aylantiramiz!
  useEffect(() => {
    if (!msg.media_url) return;

    if (msg.media_url.startsWith('data:')) {
      try {
        const parts = msg.media_url.split(',');
        const header = parts[0];
        const base64Data = parts[1];
        if (!base64Data) {
          setVideoSource(msg.media_url);
          return;
        }

        const mimeMatch = header.match(/data:(.*?)(;base64)?$/);
        let mime = mimeMatch ? mimeMatch[1] : 'video/mp4';
        if (mime.includes(';')) {
          mime = mime.split(';')[0];
        }

        const binary = atob(base64Data);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mime || 'video/mp4' });
        const url = URL.createObjectURL(blob);
        setVideoSource(url);

        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (err) {
        console.error('Blob URL creation error:', err);
        setVideoSource(msg.media_url);
      }
    } else {
      setVideoSource(msg.media_url);
    }
  }, [msg.media_url]);

  // Video elementiga xususiyatlarni to'g'ridan-to'g'ri biriktirish va autoplay qilish
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSource) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    video.src = videoSource;
    video.load();

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsVideoPlaying(true);
        })
        .catch(() => {
          // Agar avtomatik o'ynatish cheklangan bo'lsa, birinchi kadrni chiqarish uchun currentTime suriladi
          try {
            video.currentTime = 0.001;
          } catch {}
          setIsVideoPlaying(false);
        });
    }
  }, [videoSource]);

  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (isPlayingWithSound) {
      video.muted = true;
      setIsPlayingWithSound(false);
      setIsExpanded(false);
    } else {
      video.muted = false;
      video.currentTime = 0;
      video.play().then(() => {
        setIsVideoPlaying(true);
      }).catch(() => {});
      setIsPlayingWithSound(true);
      setIsExpanded(true);
    }
  };

  return (
    <div 
      id={`msg-${msg.id}`}
      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2 select-none transition-all duration-300 ${
        isHighlighted ? 'p-1.5 rounded-3xl bg-[#6ab2f2]/20 ring-2 ring-[#6ab2f2]' : ''
      }`}
    >
      {/* JAVOB BERILGAN XABAR KVOTASI (REPLY QUOTE) */}
      {msg.reply_to && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onReplyClick?.(msg.reply_to!.id);
          }}
          className="mb-1.5 max-w-[200px] flex items-stretch space-x-2 px-2.5 py-1 rounded-lg bg-[#182533]/90 border-l-[3px] border-[#6ab2f2] shadow-md cursor-pointer select-none active:opacity-75"
        >
          <div className="min-w-0 flex-1 text-left py-0.5">
            <div className="text-[11px] font-bold text-[#6ab2f2] leading-tight truncate">
              {msg.reply_to.sender_id === currentUser ? 'Siz' : (partnerDisplayName || 'Partner')}
            </div>
            <div className="text-[12px] text-white/85 leading-tight truncate">
              {msg.reply_to.text || (msg.reply_to.media_type === 'image' ? '📷 Rasm' : msg.reply_to.media_type === 'voice' ? '🎤 Ovozli xabar' : msg.reply_to.media_type === 'video_note' ? '📹 Dumaloq video' : 'Xabar')}
            </div>
          </div>
        </div>
      )}

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onTouchStart}
        onMouseUp={onTouchEnd}
        onContextMenu={onContextMenu}
        onDoubleClick={onDoubleClick}
        onClick={handleToggleSound}
        className={`relative cursor-pointer transition-all duration-300 ${
          isExpanded ? 'w-60 h-60 sm:w-68 sm:h-68' : 'w-44 h-44 sm:w-48 sm:h-48'
        } ${isSelected ? 'ring-3 ring-[#6ab2f2] rounded-full' : ''}`}
      >
        {/* YUMALOQ VIDEO — BORDERSIZ TOZA OVERFLOW-HIDDEN ICHIDA */}
        <div className="w-full h-full rounded-full overflow-hidden shadow-2xl bg-[#17212b] relative flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            loop
            playsInline
            muted
            preload="auto"
            className="w-full h-full object-cover rounded-full"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              v.muted = !isPlayingWithSound;
              if (v.paused) {
                try { v.currentTime = 0.001; } catch {}
              }
              v.play().then(() => setIsVideoPlaying(true)).catch(() => {});
            }}
            onCanPlay={(e) => {
              const v = e.currentTarget;
              v.muted = !isPlayingWithSound;
              v.play().then(() => setIsVideoPlaying(true)).catch(() => {});
            }}
          />

          {/* O'ynatish belgisi (agar video avtomatik boshlanmagan bo'lsa) */}
          {!isVideoPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center shadow-lg border border-white/10">
                <Play className="w-5 h-5 text-white ml-0.5 fill-current" />
              </div>
            </div>
          )}
        </div>

        {/* OVOZ HOLATI (TOP RIGHT) — OVERFLOWDAN TASHQARIDA, KESILIB KETMAYDI */}
        <div className="absolute top-0 right-0 z-10 bg-black/65 backdrop-blur-md p-1.5 rounded-full text-white shadow-lg pointer-events-none border border-white/10">
          {isPlayingWithSound ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-white/70" />
          )}
        </div>

        {/* VAQT VA STATUS (BOTTOM RIGHT) — OVERFLOWDAN TASHQARIDA, KESILIB KETMAYDI */}
        <div className="absolute bottom-0 right-0 z-10 bg-black/65 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center space-x-1 text-[10px] text-white font-medium shadow-lg pointer-events-none border border-white/10">
          <span>{time}</span>
          {isMe && <CheckCheck className="w-3 h-3 text-[#6ab2f2]" />}
        </div>
      </div>

      {/* REAKSIYALAR (REACTIONS) */}
      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
        <div className={`flex flex-wrap items-center gap-1 mt-1 z-10 select-none ${isMe ? 'justify-end' : 'justify-start'}`}>
          {Object.entries(msg.reactions).map(([emoji, users]) => {
            const hasReacted = Boolean(currentUser && users.includes(currentUser as any));
            return (
              <button
                key={emoji}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleReaction?.(msg.id, emoji);
                }}
                className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs transition-all active:scale-90 cursor-pointer shadow-md ${
                  hasReacted
                    ? 'bg-[#2b5278] border border-[#6ab2f2] text-white'
                    : 'bg-[#182533]/90 border border-[#2b394a] text-white/80'
                }`}
              >
                <span className="text-sm leading-none">{emoji}</span>
                {users.length > 1 && (
                  <span className="text-[11px] font-medium text-white/90">{users.length}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ChatApp() {
  const [currentUser, setCurrentUser] = useState<'guest' | 'me' | 'partner'>('guest');
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // INPUT TURI (mic yoki video note - Telegram kabi bitta bossa almashadi)
  const [inputMode, setInputMode] = useState<'voice' | 'video'>('voice');

  // TELEGRAM USLUBIDAGI ACTION MENU
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);

  // JAVOB BERISH (REPLY)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const replyingToRef = useRef<Message | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [swipingMsgId, setSwipingMsgId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const touchStartPosRef = useRef<{ x: number; y: number; msgId: string } | null>(null);

  // ONLAYN VA TYPING STATUS (JONLI KUZATISH)
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);

  // VOICE RECORDING
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef<boolean>(false);
  const isStartingRecordingRef = useRef<boolean>(false);
  const shouldStopRecordingOnReadyRef = useRef<boolean>(false);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioCancelledRef = useRef<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingDurationRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // TELEGRAM YUMALOQ VIDEO RECORDING VA QULF (LOCK) — FAQAT OLD KAMERA (USER)
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoRecordingDuration, setVideoRecordingDuration] = useState(0);
  const videoRecordingDurationRef = useRef<number>(0);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [isRecordLocked, setIsRecordLocked] = useState(false);
  const isRecordLockedRef = useRef<boolean>(false);
  const recordTouchStartYRef = useRef<number>(0);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const liveVideoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const isVideoRecordingRef = useRef<boolean>(false);
  const isStartingVideoRef = useRef<boolean>(false);
  const shouldSendOnReadyRef = useRef<boolean>(false);
  const videoCancelledRef = useRef<boolean>(false);

  // TELEGRAM YUMALOQ VIDEO CHATDA BOSILGANDA KATTALASHISH (EXPAND & SOUND)
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);

  // AUDIO PLAYING
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pressTriggerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRecordRef = useRef<boolean>(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTouchTriggeredRef = useRef<boolean>(false);
  const lastTouchEndTimeRef = useRef<number>(0);
  const lastModeToggleTimeRef = useRef<number>(0);

  // VIDEO STREAM ni DOM dagi <video> elementga darhol va ishonchli ulash
  const setLiveVideoPreviewRef = useCallback((el: HTMLVideoElement | null) => {
    liveVideoPreviewRef.current = el;
    if (el) {
      el.muted = true;
      el.defaultMuted = true;
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      const activeStream = videoStreamRef.current;
      if (activeStream && el.srcObject !== activeStream) {
        el.srcObject = activeStream;
      }
      el.play().catch(() => {});
    }
  }, []);

  // VIDEO STREAM o'zgarganda prevyuni yangilash
  useEffect(() => {
    if (isVideoRecording && videoStream && liveVideoPreviewRef.current) {
      const el = liveVideoPreviewRef.current;
      el.muted = true;
      el.defaultMuted = true;
      el.playsInline = true;
      if (el.srcObject !== videoStream) {
        el.srcObject = videoStream;
      }
      el.play().catch(() => {});
    }
  }, [isVideoRecording, videoStream]);

  // 1. Ekran ochilishi bilan xotiradan login va keshdagi xabarlarni lahzada (instant) yuklash
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('azza_auth_user');
      if (savedUser === 'me' || savedUser === 'partner') {
        setCurrentUser(savedUser);
        const partnerKey = savedUser === 'me' ? 'partner' : 'me';
        const savedLastSeen = localStorage.getItem(`azza_last_seen_${partnerKey}`);
        if (savedLastSeen) {
          setPartnerLastSeen(savedLastSeen);
        }
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
    } finally {
      setIsAuthChecking(false);
    }
  }, []);

  // Oxirgi kirgan vaqtni har 30 soniyada yangilab turish (masalan: "hozirgina chiqdi" -> "1 daqiqa oldin...")
  const [, setLastSeenTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setLastSeenTick((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(timer);
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

  // Xabarni parse qilish (oddiy text yoki maxsus json media/edit/reply ma'lumotlari)
  const parseIncomingMsg = (raw: any): Message => {
    let text = raw.text || '';
    let media_url = raw.media_url || undefined;
    let media_urls = raw.media_urls || undefined;
    let media_type = raw.media_type || undefined;
    let duration = raw.duration || undefined;
    let is_edited = raw.is_edited || false;
    let reply_to = raw.reply_to || undefined;
    let reactions = raw.reactions || undefined;

    // Agar text ichida maxsus json format saqlangan bo'lsa
    if (typeof text === 'string' && text.startsWith('__PAYLOAD_JSON__:')) {
      try {
        const parsed = JSON.parse(text.replace('__PAYLOAD_JSON__:', ''));
        text = parsed.text || '';
        media_url = parsed.media_url || media_url;
        media_urls = parsed.media_urls || media_urls;
        media_type = parsed.media_type || media_type;
        duration = parsed.duration !== undefined ? parsed.duration : duration;
        is_edited = parsed.is_edited !== undefined ? parsed.is_edited : is_edited;
        reply_to = parsed.reply_to !== undefined ? parsed.reply_to : reply_to;
        reactions = parsed.reactions !== undefined ? parsed.reactions : reactions;
      } catch {}
    }

    return {
      id: raw.id,
      sender_id: raw.sender_id,
      text,
      media_url,
      media_urls,
      media_type,
      duration,
      reply_to,
      reactions,
      is_edited,
      is_read: raw.is_read || false,
      created_at: raw.created_at
    };
  };

  // 2. Xabarlarni Supabase orqali yuklash (Ultra-fast)
  const loadMessages = async () => {
    if (!supabase || currentUser === 'guest') return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(200);

      if (!error && data) {
        const partnerKey = currentUser === 'me' ? 'partner' : 'me';

        // Sherikning oxirgi ko'ringan vaqtini olish
        const statusRow = data.find((r: any) => 
          r.id === `status_${partnerKey}` || 
          (typeof r.text === 'string' && r.text.startsWith('__STATUS__:') && r.sender_id === partnerKey)
        );
        if (statusRow) {
          try {
            const parsed = JSON.parse(statusRow.text.replace('__STATUS__:', ''));
            if (parsed.last_seen) {
              setPartnerLastSeen(parsed.last_seen);
              try { localStorage.setItem(`azza_last_seen_${partnerKey}`, parsed.last_seen); } catch {}
            }
          } catch {}
        }

        // Status qatorlarini chat xabarlaridan chiqarib tashlaymiz
        const chatRows = data.filter((r: any) => 
          !r.id?.startsWith('status_') && 
          !(typeof r.text === 'string' && r.text.startsWith('__STATUS__:'))
        );
        const parsedList = chatRows.map(parseIncomingMsg);
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

  // 3. Supabase Realtime (Presence, Broadcast Typing, va DB Changes)
  useEffect(() => {
    const client = supabase;
    if (!client || currentUser === 'guest') return;

    const partnerKey = currentUser === 'me' ? 'partner' : 'me';

    // O'zimizning statusimizni Supabase'ga yozish (oxirgi ko'ringan vaqt)
    const updateMyStatus = async () => {
      const nowIso = new Date().toISOString();
      try {
        await client.from('messages').upsert({
          id: `status_${currentUser}`,
          sender_id: currentUser,
          text: `__STATUS__:${JSON.stringify({ last_seen: nowIso })}`,
          created_at: nowIso,
          is_read: true
        });
      } catch {}
    };

    updateMyStatus();
    const heartbeatTimer = setInterval(updateMyStatus, 35000);

    const channel = client.channel('chat_room', {
      config: {
        presence: {
          key: currentUser
        }
      }
    });
    realtimeChannelRef.current = channel;

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        const record = (payload.new || payload.old) as any;
        if (record && (record.id?.startsWith('status_') || (typeof record.text === 'string' && record.text.startsWith('__STATUS__:')))) {
          if (payload.eventType !== 'DELETE' && record.id === `status_${partnerKey}`) {
            try {
              const parsed = JSON.parse(record.text.replace('__STATUS__:', ''));
              if (parsed.last_seen) {
                setPartnerLastSeen(parsed.last_seen);
              }
            } catch {}
          }
          return;
        }

        if (payload.eventType === 'INSERT') {
          const newMsg = parseIncomingMsg(payload.new);
          if (newMsg.sender_id === partnerKey) {
            setIsPartnerOnline(true);
            setIsPartnerTyping(false);
          }
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
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const isPresent = Boolean(state[partnerKey] && state[partnerKey].length > 0);
        setIsPartnerOnline(isPresent);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key === partnerKey) {
          setIsPartnerOnline(true);
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key === partnerKey) {
          setIsPartnerOnline(false);
          setIsPartnerTyping(false);
          const nowIso = new Date().toISOString();
          setPartnerLastSeen(nowIso);
          try { localStorage.setItem(`azza_last_seen_${partnerKey}`, nowIso); } catch {}
        }
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload?.payload?.user === partnerKey) {
          const isTyping = Boolean(payload.payload.isTyping);
          setIsPartnerTyping(isTyping);
          if (isTyping) {
            setIsPartnerOnline(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
              setIsPartnerTyping(false);
            }, 3500);
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user: currentUser,
            online_at: new Date().toISOString()
          });
        }
      });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateMyStatus();
      } else {
        updateMyStatus();
        channel.track({
          user: currentUser,
          online_at: new Date().toISOString()
        }).catch(() => {});
      }
    };

    const handleBeforeUnload = () => {
      updateMyStatus();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatTimer);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updateMyStatus();
      client.removeChannel(channel);
      realtimeChannelRef.current = null;
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

  const partnerDisplayName = currentUser === 'me' ? 'azza ❤️' : 's0nd ❤️';

  const getReplySnippet = (msg: Message | null | undefined) => {
    if (!msg) return '';
    if (msg.text && msg.text.trim()) return msg.text;
    if (msg.media_type === 'image') return '📷 Rasm';
    if (msg.media_type === 'voice') return '🎤 Ovozli xabar';
    if (msg.media_type === 'video_note') return '📹 Dumaloq video';
    return 'Xabar';
  };

  // XABARGA JAVOB BERISH (REPLY)
  const handleStartReply = (msg: Message) => {
    setReplyingTo(msg);
    replyingToRef.current = msg;
    setSelectedMessage(null);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    replyingToRef.current = null;
  };

  const scrollToMessage = (targetId: string) => {
    const el = document.getElementById(`msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(targetId);
      setTimeout(() => {
        setHighlightedMsgId((prev) => (prev === targetId ? null : prev));
      }, 1600);
    }
  };

  // Yangi xabar jo'natish (Reply bilan)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmed = inputText.trim();
    if (!trimmed || currentUser === 'guest') return;

    const currentReply = replyingToRef.current || replyingTo;
    const replyData = currentReply ? {
      id: currentReply.id,
      sender_id: currentReply.sender_id,
      text: getReplySnippet(currentReply),
      media_type: currentReply.media_type
    } : null;

    const newMsg: Message = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sender_id: currentUser as 'me' | 'partner',
      text: trimmed,
      reply_to: replyData,
      is_read: false,
      created_at: new Date().toISOString()
    };

    updateMessagesState((prev) => [...prev, newMsg]);
    setInputText('');
    setReplyingTo(null);
    replyingToRef.current = null;

    // Yozishni to'xtatish haqida darhol xabar berish
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user: currentUser, isTyping: false }
      }).catch(() => {});
    }

    if (supabase) {
      const payloadText = replyData
        ? `__PAYLOAD_JSON__:${JSON.stringify({ text: newMsg.text, reply_to: replyData })}`
        : newMsg.text;

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

    if (trimmed.includes('❤️') || trimmed.toLowerCase().includes('sevaman') || trimmed.toLowerCase().includes('love')) {
      try {
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.8 } });
      } catch {}
    }

    inputRef.current?.focus();
  };

  // Matn yozilayotganda typing statusini jonli uzatish
  const handleInputChange = (val: string) => {
    setInputText(val);

    if (!realtimeChannelRef.current || currentUser === 'guest') return;

    const now = Date.now();
    if (val.trim()) {
      if (now - lastTypingSentRef.current > 1200) {
        lastTypingSentRef.current = now;
        realtimeChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { user: currentUser, isTyping: true }
        }).catch(() => {});
      }
    } else {
      realtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user: currentUser, isTyping: false }
      }).catch(() => {});
    }
  };

  // XABARGA REAKSIYA QOLDIRISH (TELEGRAM REACTION)
  const handleToggleReaction = async (msgId: string, emoji: string) => {
    if (currentUser === 'guest') return;

    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;

    if (window.navigator?.vibrate) window.navigator.vibrate(25);
    if (emoji === '❤️') {
      try {
        confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });
      } catch {}
    }

    const currentReactions: Record<string, ('me' | 'partner')[]> = { ...(msg.reactions || {}) };
    const user = currentUser as 'me' | 'partner';

    const userCurrentEmoji = Object.keys(currentReactions).find((k) =>
      currentReactions[k]?.includes(user)
    );

    if (userCurrentEmoji === emoji) {
      // Reaksiyani olib tashlash (toggle off)
      const filtered = currentReactions[emoji].filter((u) => u !== user);
      if (filtered.length > 0) {
        currentReactions[emoji] = filtered;
      } else {
        delete currentReactions[emoji];
      }
    } else {
      // Eski reaksiyadan foydalanuvchini chiqarish
      if (userCurrentEmoji) {
        const filtered = currentReactions[userCurrentEmoji].filter((u) => u !== user);
        if (filtered.length > 0) {
          currentReactions[userCurrentEmoji] = filtered;
        } else {
          delete currentReactions[userCurrentEmoji];
        }
      }
      // Yangi reaksiyaga qo'shish
      currentReactions[emoji] = [...(currentReactions[emoji] || []), user];
    }

    const updatedReactions = Object.keys(currentReactions).length > 0 ? currentReactions : null;
    const updatedMsg: Message = {
      ...msg,
      reactions: updatedReactions
    };

    updateMessagesState((prev) => prev.map((m) => (m.id === msgId ? updatedMsg : m)));
    setSelectedMessage(null);

    if (supabase) {
      const payloadObj: any = {
        text: msg.text,
        reactions: updatedReactions
      };
      if (msg.media_url) payloadObj.media_url = msg.media_url;
      if (msg.media_urls) payloadObj.media_urls = msg.media_urls;
      if (msg.media_type) payloadObj.media_type = msg.media_type;
      if (msg.duration !== undefined) payloadObj.duration = msg.duration;
      if (msg.reply_to) payloadObj.reply_to = msg.reply_to;
      if (msg.is_edited) payloadObj.is_edited = msg.is_edited;

      const payloadText = `__PAYLOAD_JSON__:${JSON.stringify(payloadObj)}`;
      await supabase.from('messages').update({ text: payloadText }).eq('id', msgId);
    }
  };

  // XABARNI BOSIB TURISH (LONG PRESS) VA SWIPE TO REPLY
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

  const handleBubbleTouchStart = (e: React.TouchEvent, msg: Message) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY, msgId: msg.id };
    handleTouchStart(msg);
  };

  const handleBubbleTouchMove = (e: React.TouchEvent, msg: Message) => {
    if (!touchStartPosRef.current || touchStartPosRef.current.msgId !== msg.id) return;
    const deltaX = e.touches[0].clientX - touchStartPosRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartPosRef.current.y;

    if (Math.abs(deltaY) > 20 && Math.abs(deltaY) > Math.abs(deltaX)) {
      handleTouchEnd();
      setSwipingMsgId(null);
      setSwipeOffset(0);
      return;
    }

    if (deltaX < -10) {
      handleTouchEnd();
      const offset = Math.max(-60, deltaX);
      setSwipingMsgId(msg.id);
      setSwipeOffset(offset);
    }
  };

  const handleBubbleTouchEnd = (msg: Message) => {
    handleTouchEnd();
    if (swipingMsgId === msg.id && swipeOffset <= -40) {
      handleStartReply(msg);
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(35);
      }
    }
    setSwipingMsgId(null);
    setSwipeOffset(0);
    touchStartPosRef.current = null;
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
      const payloadObj: any = { text: newText, is_edited: true };
      if (editingMessage.reply_to) payloadObj.reply_to = editingMessage.reply_to;
      if (editingMessage.media_url) payloadObj.media_url = editingMessage.media_url;
      if (editingMessage.media_urls) payloadObj.media_urls = editingMessage.media_urls;
      if (editingMessage.media_type) payloadObj.media_type = editingMessage.media_type;
      if (editingMessage.duration !== undefined) payloadObj.duration = editingMessage.duration;

      const payloadText = `__PAYLOAD_JSON__:${JSON.stringify(payloadObj)}`;
      await supabase
        .from('messages')
        .update({ text: payloadText })
        .eq('id', targetId);
    }
  };

  // RASMLAR YUKLASH (IMAGE - TELEGRAM USLUBIDA BIR NECHTA RASM YUKLASH)
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || currentUser === 'guest') return;

    const fileList = Array.from(files);
    const readBase64 = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    };

    const base64List = await Promise.all(fileList.map(readBase64));

    const currentReply = replyingToRef.current || replyingTo;
    const replyData = currentReply ? {
      id: currentReply.id,
      sender_id: currentReply.sender_id,
      text: getReplySnippet(currentReply),
      media_type: currentReply.media_type
    } : null;
    setReplyingTo(null);
    replyingToRef.current = null;

    const newMsg: Message = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sender_id: currentUser as 'me' | 'partner',
      text: '',
      media_url: base64List[0],
      media_urls: base64List,
      media_type: 'image',
      reply_to: replyData,
      is_read: false,
      created_at: new Date().toISOString()
    };

    updateMessagesState((prev) => [...prev, newMsg]);

    if (supabase) {
      const payloadText = `__PAYLOAD_JSON__:${JSON.stringify({
        text: '',
        media_url: base64List[0],
        media_urls: base64List,
        media_type: 'image',
        reply_to: replyData
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
    e.target.value = '';
  };

  // OVOZ YOZISH (VOICE / GOLOS)
  const handleStartRecording = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      alert('Brauzeringiz mikrofonga ruxsat bermayapti (HTTPS yoki sozlamalarni tekshiring)');
      return;
    }

    isStartingRecordingRef.current = true;
    shouldStopRecordingOnReadyRef.current = false;
    audioCancelledRef.current = false;
    setIsRecording(true);
    isRecordingRef.current = true;
    recordingDurationRef.current = 0;
    setRecordingDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      audioStreamRef.current = stream;

      // Agar mikrofon ochilguncha bekor qilingan bo'lsa
      if (audioCancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        isStartingRecordingRef.current = false;
        isRecordingRef.current = false;
        setIsRecording(false);
        return;
      }

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
        // MIKROFON TREKLARINI DARHOL VA TO'LIQ TO'XTATISH (ORANGE DOT O'CHISHI UCHUN)
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());

        const isCancelled = audioCancelledRef.current;
        audioCancelledRef.current = false;
        isRecordingRef.current = false;
        setIsRecording(false);

        if (isCancelled || audioChunksRef.current.length === 0) {
          audioChunksRef.current = [];
          return;
        }

        const selectedType = (mimeType || mediaRecorder.mimeType || 'audio/mp4').split(';')[0] || 'audio/mp4';
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedType });
        audioChunksRef.current = [];

        if (audioBlob.size === 0) return;

        const currentReply = replyingToRef.current;
        const replyData = currentReply ? {
          id: currentReply.id,
          sender_id: currentReply.sender_id,
          text: getReplySnippet(currentReply),
          media_type: currentReply.media_type
        } : null;
        setReplyingTo(null);
        replyingToRef.current = null;

        const finalVoiceDuration = Math.max(recordingDurationRef.current, 1);
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;

          const newMsg: Message = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            sender_id: currentUser as 'me' | 'partner',
            text: '',
            media_url: base64Audio,
            media_type: 'voice',
            duration: finalVoiceDuration,
            reply_to: replyData,
            is_read: false,
            created_at: new Date().toISOString()
          };

          updateMessagesState((prev) => [...prev, newMsg]);

          if (supabase) {
            const payloadText = `__PAYLOAD_JSON__:${JSON.stringify({
              text: '',
              media_url: base64Audio,
              media_type: 'voice',
              duration: finalVoiceDuration,
              reply_to: replyData
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
      };

      mediaRecorder.start(250);
      isStartingRecordingRef.current = false;

      // Agar mikrofon ochilguncha foydalanuvchi barmoqni qo'yib yuborgan bo'lsa
      if (shouldStopRecordingOnReadyRef.current) {
        shouldStopRecordingOnReadyRef.current = false;
        setTimeout(() => {
          handleStopRecording();
        }, 300);
      }

      recordingDurationRef.current = 0;
      setRecordingDuration(0);

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      recordingTimerRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration(recordingDurationRef.current);
      }, 1000);
    } catch (err: unknown) {
      console.error("Mic error:", err);
      isStartingRecordingRef.current = false;
      isRecordingRef.current = false;
      setIsRecording(false);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`Mikrofon xatosi: ${errorMsg}. Safari yoki brauzer sozlamalarida mikrofonga ruxsat bering.`);
    }
  };

  const handleStopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (isStartingRecordingRef.current) {
      shouldStopRecordingOnReadyRef.current = true;
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('Stop mic recorder warning:', err);
      }
    }

    // Mikrofon treklarini to'xtatish kafolati
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
  };

  const handleCancelRecording = () => {
    audioCancelledRef.current = true;
    shouldStopRecordingOnReadyRef.current = false;
    isStartingRecordingRef.current = false;
    isRecordingRef.current = false;
    setIsRecording(false);
    audioChunksRef.current = [];

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
  };

  // KAMERA STREAMINI OLISH (TEZKOR VA MOSLASHUVCHAN)
  const getCameraStream = async (facing: 'user' | 'environment') => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 480, max: 720 },
          height: { ideal: 480, max: 720 }
        },
        audio: true
      });
    } catch (err) {
      console.warn('Initial camera constraints failed, fallback to basic:', err);
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: true
      });
    }
  };

  // TELEGRAM YUMALOQ VIDEO (VIDEO NOTE) YOZISH — OLD KAMERA
  const handleStartVideoRecording = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      alert('Brauzeringiz kameraga ruxsat bermayapti');
      return;
    }

    isStartingVideoRef.current = true;
    shouldSendOnReadyRef.current = false;
    videoCancelledRef.current = false;
    setIsVideoRecording(true);
    setVideoRecordingDuration(0);

    try {
      const stream = await getCameraStream('user');
      videoStreamRef.current = stream;
      setVideoStream(stream);

      // Agar kamera ochilguncha bekor qilingan bo'lsa
      if (videoCancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        videoStreamRef.current = null;
        setVideoStream(null);
        setIsVideoRecording(false);
        isStartingVideoRef.current = false;
        isVideoRecordingRef.current = false;
        return;
      }

      // Prevyu video elementiga darhol ulash
      if (liveVideoPreviewRef.current) {
        liveVideoPreviewRef.current.srcObject = stream;
        liveVideoPreviewRef.current.muted = true;
        liveVideoPreviewRef.current.defaultMuted = true;
        liveVideoPreviewRef.current.playsInline = true;
        liveVideoPreviewRef.current.play().catch(() => {});
      }

      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        const testTypes = [
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4',
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp9,opus',
          'video/webm'
        ];
        for (const t of testTypes) {
          if (MediaRecorder.isTypeSupported(t)) {
            mimeType = t;
            break;
          }
        }
      }

      const options: MediaRecorderOptions = {
        mimeType: mimeType || undefined,
        videoBitsPerSecond: 900000, // 900 kbps: ultra yengil, tezkor va ravshan yumaloq video
        audioBitsPerSecond: 64000
      };

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch {
        mediaRecorder = new MediaRecorder(stream);
      }
      videoRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const isCancelled = videoCancelledRef.current;
        videoCancelledRef.current = false;
        isRecordLockedRef.current = false;
        setIsRecordLocked(false);

        // Barcha treklar to'xtatiladi
        if (videoStreamRef.current) {
          videoStreamRef.current.getTracks().forEach((t) => t.stop());
          videoStreamRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        setVideoStream(null);

        if (isCancelled || videoChunksRef.current.length === 0) {
          videoChunksRef.current = [];
          return;
        }

        const selectedType = mimeType || mediaRecorder.mimeType || 'video/mp4';
        const cleanMime = selectedType.split(';')[0] || 'video/mp4';
        const videoBlob = new Blob(videoChunksRef.current, { type: cleanMime });
        videoChunksRef.current = [];

        if (videoBlob.size === 0) return;

        const currentReply = replyingToRef.current;
        const replyData = currentReply ? {
          id: currentReply.id,
          sender_id: currentReply.sender_id,
          text: getReplySnippet(currentReply),
          media_type: currentReply.media_type
        } : null;
        setReplyingTo(null);
        replyingToRef.current = null;

        const finalVideoDuration = Math.max(videoRecordingDurationRef.current, 1);
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Video = reader.result as string;

          const newMsg: Message = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            sender_id: currentUser as 'me' | 'partner',
            text: '',
            media_url: base64Video,
            media_type: 'video_note',
            duration: finalVideoDuration,
            reply_to: replyData,
            is_read: false,
            created_at: new Date().toISOString()
          };

          updateMessagesState((prev) => [...prev, newMsg]);

          if (supabase) {
            const payloadText = `__PAYLOAD_JSON__:${JSON.stringify({
              text: '',
              media_url: base64Video,
              media_type: 'video_note',
              duration: finalVideoDuration,
              reply_to: replyData
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
        reader.readAsDataURL(videoBlob);
      };

      mediaRecorder.start(250);
      isStartingVideoRef.current = false;
      isVideoRecordingRef.current = true;
      videoRecordingDurationRef.current = 0;
      setVideoRecordingDuration(0);

      videoTimerRef.current = setInterval(() => {
        videoRecordingDurationRef.current += 1;
        setVideoRecordingDuration(videoRecordingDurationRef.current);
      }, 1000);

      // Agar foydalanuvchi kamera yuklanayotganda barmog'ini qo'yib yuborgan bo'lsa
      if (shouldSendOnReadyRef.current) {
        shouldSendOnReadyRef.current = false;
        setTimeout(() => {
          handleStopVideoRecording();
        }, 600);
      }
    } catch (err: unknown) {
      console.error("Camera error:", err);
      setIsVideoRecording(false);
      isStartingVideoRef.current = false;
      isVideoRecordingRef.current = false;
      isRecordLockedRef.current = false;
      setIsRecordLocked(false);
      setVideoStream(null);
      videoStreamRef.current = null;
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`Kamera/Mikrofon xatosi: ${errorMsg}. Brauzer sozlamalaridan ruxsat bering.`);
    }
  };

  const handleStopVideoRecording = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
    }
    isHoldingRecordRef.current = false;
    isRecordLockedRef.current = false;
    setIsRecordLocked(false);

    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }

    if (isStartingVideoRef.current) {
      shouldSendOnReadyRef.current = true;
      return;
    }

    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      try {
        videoRecorderRef.current.stop();
      } catch (err) {
        console.warn('Stop recorder warning:', err);
      }
    }

    setIsVideoRecording(false);
    isVideoRecordingRef.current = false;
  };

  const handleCancelVideoRecording = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
    }
    videoCancelledRef.current = true;
    shouldSendOnReadyRef.current = false;
    isHoldingRecordRef.current = false;
    isRecordLockedRef.current = false;
    setIsRecordLocked(false);

    if (pressTriggerTimerRef.current) {
      clearTimeout(pressTriggerTimerRef.current);
      pressTriggerTimerRef.current = null;
    }

    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }

    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      try {
        videoRecorderRef.current.stop();
      } catch {}
    }

    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
    }

    setVideoStream(null);
    setIsVideoRecording(false);
    isVideoRecordingRef.current = false;
    isStartingVideoRef.current = false;
    videoChunksRef.current = [];
  };

  // TELEGRAM USLUBIDAGI MIC/VIDEO TUGMASI: BOSIB TURISH (LONG PRESS) VA BITTA BOSISH
  const handleRecordButtonDown = (e: React.SyntheticEvent) => {
    const isTouch = 'touches' in e || (e as any).type?.startsWith('touch');

    if (isTouch) {
      isTouchTriggeredRef.current = true;
    } else {
      // Agar barmoq bilan tegilgan bo'lsa va brauzer orqasidan sun'iy mousedown yuborayotgan bo'lsa, e'tiborsiz qoldiramiz
      if (isTouchTriggeredRef.current || Date.now() - lastTouchEndTimeRef.current < 600) {
        return;
      }
    }

    isHoldingRecordRef.current = false;
    isRecordLockedRef.current = false;
    setIsRecordLocked(false);

    // Boshlang'ich Y pozitsiyani saqlash (Swipe up qulf uchun)
    const clientY = 'touches' in e && (e as any).touches?.[0]
      ? (e as any).touches[0].clientY
      : 'clientY' in e ? (e as any).clientY : 0;
    recordTouchStartYRef.current = clientY;

    if (pressTriggerTimerRef.current) {
      clearTimeout(pressTriggerTimerRef.current);
    }

    pressTriggerTimerRef.current = setTimeout(() => {
      isHoldingRecordRef.current = true;
      if (window.navigator?.vibrate) window.navigator.vibrate(50);
      if (inputMode === 'voice') {
        handleStartRecording();
      } else {
        handleStartVideoRecording();
      }
    }, 200);
  };

  const handleRecordButtonUp = (e?: React.SyntheticEvent) => {
    const isTouch = e && ('changedTouches' in e || (e as any).type?.startsWith('touch'));

    if (isTouch) {
      lastTouchEndTimeRef.current = Date.now();
      setTimeout(() => {
        isTouchTriggeredRef.current = false;
      }, 600);
    } else if (e) {
      // Agar sun'iy mouseup bo'lsa (touchdan keyingi), e'tiborsiz qoldiramiz
      if (isTouchTriggeredRef.current || Date.now() - lastTouchEndTimeRef.current < 600) {
        return;
      }
    }

    if (pressTriggerTimerRef.current) {
      clearTimeout(pressTriggerTimerRef.current);
      pressTriggerTimerRef.current = null;
    }

    // AGAR QULFLANGAN BO'LSA — BARMOQNI QO'YIB YUBORGANDA YUBORILMAYDI (HANDS-FREE)!
    if (isRecordLockedRef.current) {
      return;
    }

    if (isHoldingRecordRef.current || isStartingRecordingRef.current || isRecordingRef.current || isStartingVideoRef.current || isVideoRecordingRef.current) {
      isHoldingRecordRef.current = false;
      if (inputMode === 'voice') {
        handleStopRecording();
      } else {
        handleStopVideoRecording();
      }
    } else {
      // Shunchaki bitta bosib qo'yib yubordi (click) — rejim almashadi (Mic <-> Video)!
      const now = Date.now();
      if (now - lastModeToggleTimeRef.current > 300) {
        lastModeToggleTimeRef.current = now;
        setInputMode((prev) => (prev === 'voice' ? 'video' : 'voice'));
        if (window.navigator?.vibrate) window.navigator.vibrate(20);
      }
    }
  };

  // BARMOQNI TEPAGA SURGANDA (SWIPE UP) — AVTOMATIK QULFLASH (LOCK)
  const handleTouchMoveRecord = (e: TouchEvent | MouseEvent) => {
    if (!isHoldingRecordRef.current && !isRecordingRef.current && !isVideoRecordingRef.current) return;
    if (isRecordLockedRef.current) return;

    const clientY = 'touches' in e && (e as TouchEvent).touches?.[0]
      ? (e as TouchEvent).touches[0].clientY
      : 'clientY' in e ? (e as MouseEvent).clientY : 0;

    const deltaY = recordTouchStartYRef.current - clientY;
    if (deltaY > 50) {
      isRecordLockedRef.current = true;
      setIsRecordLocked(true);
      isHoldingRecordRef.current = false; // Barmoqni ushlab turishi shart emas!
      if (window.navigator?.vibrate) window.navigator.vibrate([40, 40]);
    }
  };

  // Har qanday joyda barmoqni qo'yib yuborganda yoki harakatlantirganda
  useEffect(() => {
    const handleGlobalWindowRelease = () => {
      if (isRecordLockedRef.current) return;
      if (isHoldingRecordRef.current || isStartingRecordingRef.current || isRecordingRef.current || isStartingVideoRef.current || isVideoRecordingRef.current) {
        handleRecordButtonUp();
      }
    };

    window.addEventListener('mouseup', handleGlobalWindowRelease);
    window.addEventListener('touchend', handleGlobalWindowRelease);
    window.addEventListener('touchmove', handleTouchMoveRecord);
    window.addEventListener('mousemove', handleTouchMoveRecord);

    return () => {
      window.removeEventListener('mouseup', handleGlobalWindowRelease);
      window.removeEventListener('touchend', handleGlobalWindowRelease);
      window.removeEventListener('touchmove', handleTouchMoveRecord);
      window.removeEventListener('mousemove', handleTouchMoveRecord);
    };
  }, []);

  // TELEGRAM OVOZLI XABARLARINI O'YNATISH (IOS SAFARI VA BARCHA BRAUZERLARDA KAFOLATLANGAN)
  const handleTogglePlayAudio = (msgId: string, url?: string) => {
    if (!url) return;

    if (playingAudio === msgId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingAudio(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (activeBlobUrlRef.current) {
      try { URL.revokeObjectURL(activeBlobUrlRef.current); } catch {}
      activeBlobUrlRef.current = null;
    }

    // iOS Safari va boshqa brauzerlar data: URL audiolarni o'qiy olmasligi mumkin.
    // Shuning uchun data: URL ni darhol toza Blob URL ga aylantiramiz!
    let playUrl = url;
    if (url.startsWith('data:')) {
      try {
        const parts = url.split(',');
        const header = parts[0];
        const base64Data = parts[1];
        if (base64Data) {
          const mimeMatch = header.match(/data:(.*?)(;base64)?$/);
          let mime = mimeMatch ? mimeMatch[1] : 'audio/mp4';
          if (mime.includes(';')) {
            mime = mime.split(';')[0];
          }
          const binary = atob(base64Data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: mime || 'audio/mp4' });
          playUrl = URL.createObjectURL(blob);
          activeBlobUrlRef.current = playUrl;
        }
      } catch (err) {
        console.warn('Audio blob conversion error:', err);
      }
    }

    try {
      const audio = new Audio(playUrl);
      audioRef.current = audio;
      audio.volume = 1.0;

      audio.onended = () => {
        setPlayingAudio(null);
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setPlayingAudio(null);
      };

      audio.play()
        .then(() => {
          setPlayingAudio(msgId);
        })
        .catch((err) => {
          console.error('Audio play error:', err);
          setPlayingAudio(null);
        });
    } catch (err) {
      console.error('Audio init error:', err);
      setPlayingAudio(null);
    }
  };

  // Tekshirilayotgan paytda (millisekundlar ichida) login ekrani miltillab ko'rinmasligi uchun
  if (isAuthChecking) {
    return <div className="min-h-[100dvh] w-full bg-[#0e1621]" />;
  }

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
  const myDisplayName = currentUser === 'me' ? 's0nd ❤️' : 'azza ❤️';

  // Tanlangan xabar faqat o'zinikimi? (Faqat o'zinikini edit/delete qilish uchun)
  const isSelectedMsgMine = selectedMessage ? selectedMessage.sender_id === currentUser : false;

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto bg-[#0e1621] text-white overflow-hidden shadow-2xl relative">
      
      {/* HEADER */}
      <header className="safe-top shrink-0 bg-[#17212b] border-b border-[#202b36] px-3 pb-2.5 flex items-center justify-between z-30 shadow">
        <div 
          onClick={() => setShowProfileDrawer(true)}
          className="flex items-center space-x-2.5 cursor-pointer active:opacity-80 min-w-0"
        >
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-rose-500 via-pink-500 to-indigo-500 flex items-center justify-center font-bold text-base text-white shadow-md shrink-0">
            <span>{partnerDisplayName[0].toUpperCase()}</span>
            {isPartnerOnline && (
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#17212b] ${
                isPartnerTyping ? 'bg-[#6ab2f2] animate-ping' : 'bg-emerald-500'
              }`}></span>
            )}
            {isPartnerOnline && isPartnerTyping && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#17212b] bg-[#6ab2f2]"></span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1">
              <span className="font-semibold text-sm sm:text-base leading-tight truncate">{partnerDisplayName}</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            </div>

            {/* STATUS: typing... / online / oxirgi kirgan vaqti */}
            {isPartnerTyping ? (
              <span className="text-xs text-[#6ab2f2] font-medium flex items-center space-x-1 animate-pulse">
                <span>typing...</span>
                <span className="flex space-x-0.5 ml-0.5">
                  <span className="w-1 h-1 bg-[#6ab2f2] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1 h-1 bg-[#6ab2f2] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1 h-1 bg-[#6ab2f2] rounded-full animate-bounce"></span>
                </span>
              </span>
            ) : isPartnerOnline ? (
              <span className="text-xs text-emerald-400 font-medium">online</span>
            ) : (
              <span className="text-xs text-[#7f91a4] font-normal truncate block max-w-[190px]">
                {formatLastSeen(partnerLastSeen)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#242f3d] text-[#6ab2f2] border border-[#3b4b5e]">
            {myDisplayName}
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

          // TELEGRAM YUMALOQ VIDEO (TORTBURCHAKSIZ, TOZA YUMALOQ VA BORDERSIZ)
          if (msg.media_type === 'video_note' && msg.media_url) {
            return (
              <TelegramVideoNote
                key={msg.id}
                msg={msg}
                isMe={isMe}
                time={time}
                isSelected={isMsgSelected}
                partnerDisplayName={partnerDisplayName}
                currentUser={currentUser}
                onReplyClick={scrollToMessage}
                isHighlighted={highlightedMsgId === msg.id}
                onDoubleClick={() => handleToggleReaction(msg.id, '❤️')}
                onToggleReaction={handleToggleReaction}
                onTouchStart={() => handleTouchStart(msg)}
                onTouchEnd={handleTouchEnd}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelectedMessage(msg);
                }}
              />
            );
          }

          // ODDIY XABARLAR (TEXT, RASM, GOLOS) - PUFAKCHA BILAN
          const isSwipingThis = swipingMsgId === msg.id;

          return (
            <div 
              key={msg.id}
              id={`msg-${msg.id}`}
              className={`relative flex flex-col ${isMe ? 'items-end' : 'items-start'} my-0.5 transition-all duration-300 ${
                highlightedMsgId === msg.id ? 'p-1 rounded-2xl bg-[#6ab2f2]/20 ring-2 ring-[#6ab2f2]' : ''
              }`}
            >
              {/* SWIPE TO REPLY BELGISI */}
              {isSwipingThis && (
                <div 
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#6ab2f2] flex items-center justify-center shadow-lg pointer-events-none transition-all"
                  style={{
                    opacity: Math.min(1, Math.abs(swipeOffset) / 35),
                    transform: `translateY(-50%) scale(${Math.min(1, Math.abs(swipeOffset) / 40)})`
                  }}
                >
                  <Reply className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Xabar pufakchasi (Telegram smooth touch va swipe) */}
              <div 
                onTouchStart={(e) => handleBubbleTouchStart(e, msg)}
                onTouchMove={(e) => handleBubbleTouchMove(e, msg)}
                onTouchEnd={() => handleBubbleTouchEnd(msg)}
                onMouseDown={() => handleTouchStart(msg)}
                onMouseUp={handleTouchEnd}
                onDoubleClick={() => handleToggleReaction(msg.id, '❤️')}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelectedMessage(msg);
                }}
                style={{
                  transform: isSwipingThis ? `translateX(${swipeOffset}px)` : undefined,
                  transition: isSwipingThis ? 'none' : 'transform 0.2s ease-out'
                }}
                className={`relative max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm cursor-pointer select-none transition-all duration-200 ${
                  isMsgSelected ? 'ring-2 ring-[#6ab2f2] scale-[0.98]' : 'active:scale-[0.98]'
                } ${
                  isMe 
                    ? 'bg-[#2b5278] text-white rounded-br-xs' 
                    : 'bg-[#182533] text-white rounded-bl-xs'
                }`}
              >
                {/* JAVOB BERILGAN XABAR (REPLY QUOTE) */}
                {msg.reply_to && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollToMessage(msg.reply_to!.id);
                    }}
                    className={`mb-1.5 flex items-stretch space-x-2 px-2.5 py-1 rounded-lg cursor-pointer select-none transition-all active:opacity-75 ${
                      isMe 
                        ? 'bg-[#1e3b56]/80 border-l-[3px] border-[#6ab2f2]' 
                        : 'bg-[#101921]/80 border-l-[3px] border-[#5288c1]'
                    }`}
                  >
                    <div className="min-w-0 flex-1 text-left py-0.5">
                      <div className="text-[11px] font-bold text-[#6ab2f2] leading-tight truncate">
                        {msg.reply_to.sender_id === currentUser ? 'Siz' : partnerDisplayName}
                      </div>
                      <div className="text-[12px] text-white/85 leading-tight truncate">
                        {msg.reply_to.text || (msg.reply_to.media_type === 'image' ? '📷 Rasm' : msg.reply_to.media_type === 'voice' ? '🎤 Ovozli xabar' : msg.reply_to.media_type === 'video_note' ? '📹 Dumaloq video' : 'Xabar')}
                      </div>
                    </div>
                  </div>
                )}
                {/* RASMLAR KO'RINISHI (TELEGRAM USLUBIDA 1 TA YOKI BIR NECHTA RASMLAR ALBOMI) */}
                {msg.media_type === 'image' && (
                  <div className="mb-1 rounded-xl overflow-hidden">
                    {msg.media_urls && msg.media_urls.length > 1 ? (
                      <div className={`grid gap-1 ${msg.media_urls.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                        {msg.media_urls.map((imgSrc, idx) => (
                          <div key={idx} className="relative aspect-square overflow-hidden rounded-lg bg-black/20">
                            <img 
                              src={imgSrc} 
                              alt={`rasm ${idx + 1}`} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-hidden rounded-xl">
                        <img 
                          src={msg.media_url || (msg.media_urls && msg.media_urls[0])} 
                          alt="rasm" 
                          className="w-full h-auto object-cover rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* GOLOS (OVOZ) KO'RINISHI - DURATION DASTURIY VA ANIQ KO'RSATILADI */}
                {msg.media_type === 'voice' && msg.media_url && (
                  <div className="flex items-center space-x-3 py-1 pr-1 select-none">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePlayAudio(msg.id, msg.media_url);
                      }}
                      className="w-10 h-10 rounded-full bg-[#6ab2f2] active:bg-[#529cd8] text-white flex items-center justify-center shrink-0 shadow active:scale-95 transition"
                    >
                      {playingAudio === msg.id ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 ml-0.5 fill-current" />
                      )}
                    </button>
                    <div className="flex flex-col flex-1 justify-center min-w-[120px]">
                      <div className="flex items-center space-x-1">
                        <span className="w-1 h-3 bg-[#6ab2f2] rounded-full"></span>
                        <span className="w-1 h-5 bg-[#6ab2f2] rounded-full"></span>
                        <span className="w-1 h-2 bg-[#6ab2f2] rounded-full"></span>
                        <span className="w-1 h-6 bg-[#6ab2f2] rounded-full"></span>
                        <span className="w-1 h-4 bg-[#6ab2f2] rounded-full"></span>
                        <span className="w-1 h-7 bg-[#6ab2f2] rounded-full"></span>
                        <span className="w-1 h-3 bg-[#6ab2f2] rounded-full"></span>
                        <span className="w-1 h-5 bg-[#6ab2f2] rounded-full"></span>
                        <span className="w-1 h-2 bg-[#6ab2f2] rounded-full"></span>
                        <span className="w-1 h-4 bg-[#6ab2f2] rounded-full"></span>
                      </div>
                      <span className="text-[11px] text-white/70 mt-1 font-mono">
                        {playingAudio === msg.id ? '▶ eshitilmoqda' : formatDuration(msg.duration)}
                      </span>
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

              {/* REAKSIYALAR (REACTIONS) */}
              {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                <div className={`flex flex-wrap items-center gap-1 mt-1 z-10 select-none ${isMe ? 'justify-end mr-1' : 'justify-start ml-1'}`}>
                  {Object.entries(msg.reactions).map(([emoji, users]) => {
                    const hasReacted = Boolean(currentUser && users.includes(currentUser as any));
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleReaction(msg.id, emoji);
                        }}
                        className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs transition-all active:scale-90 cursor-pointer shadow-md ${
                          hasReacted
                            ? 'bg-[#2b5278] border border-[#6ab2f2] text-white'
                            : 'bg-[#182533]/90 border border-[#2b394a] text-white/80'
                        }`}
                      >
                        <span className="text-sm leading-none">{emoji}</span>
                        {users.length > 1 && (
                          <span className="text-[11px] font-medium text-white/90">{users.length}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
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
                  handleInputChange(inputText + emoji);
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
        <footer className="safe-bottom shrink-0 bg-[#17212b] border-t border-[#202b36] px-3 pt-3 flex items-center justify-between z-20 animate-in slide-in-from-bottom">
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
        <footer className="safe-bottom shrink-0 bg-[#17212b] border-t border-[#202b36] px-2.5 pt-2 pb-2">
          {/* JAVOB BERISH (REPLY) PREVIEW PANEL */}
          {replyingTo && (
            <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-[#242f3d] px-1 text-xs animate-in slide-in-from-bottom duration-150">
              <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                <Reply className="w-4 h-4 text-[#6ab2f2] shrink-0" />
                <div className="w-0.5 h-7 bg-[#6ab2f2] rounded-full shrink-0"></div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-[11px] font-bold text-[#6ab2f2] leading-tight truncate">
                    {replyingTo.sender_id === currentUser ? 'Siz' : partnerDisplayName}
                  </div>
                  <div className="text-[12px] text-white/70 leading-tight truncate">
                    {getReplySnippet(replyingTo)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelReply}
                className="p-1.5 text-[#7f91a4] hover:text-white active:scale-90 transition-transform shrink-0 cursor-pointer"
                title="Javobni bekor qilish"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form 
            onSubmit={handleSendMessage}
            className="flex items-center space-x-1.5 sm:space-x-2"
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              onChange={handleImageSelect}
            />

            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[#7f91a4] hover:text-white active:bg-[#242f3d] rounded-full shrink-0"
              title="Bir nechta rasm yuborish"
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
              onChange={(e) => handleInputChange(e.target.value)}
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
                onMouseDown={handleRecordButtonDown}
                onMouseUp={handleRecordButtonUp}
                onTouchStart={handleRecordButtonDown}
                onTouchEnd={handleRecordButtonUp}
                onTouchCancel={handleRecordButtonUp}
                className="w-10 h-10 rounded-full bg-[#242f3d] active:bg-[#2f3f52] text-[#6ab2f2] shadow-md flex items-center justify-center shrink-0 active:scale-95 transition-all select-none cursor-pointer"
                title={inputMode === 'voice' ? "Bosib turing - Ovoz, bir marta bosing - Video" : "Bosib turing - Video, bir marta bosing - Ovoz"}
              >
                {inputMode === 'voice' ? (
                  <Mic className="w-5 h-5 animate-in zoom-in-75 duration-100" />
                ) : (
                  <Video className="w-5 h-5 animate-in zoom-in-75 duration-100 text-emerald-400" />
                )}
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
                {selectedMessage.text || (selectedMessage.media_type === 'image' ? '📷 Rasm' : selectedMessage.media_type === 'voice' ? '🎤 Ovozli xabar' : selectedMessage.media_type === 'video_note' ? '📹 Dumaloq video' : 'Xabar')}
              </p>
            </div>

            {/* REAKSIYALAR PANELI (TELEGRAM USLUBIDA) */}
            <div className="bg-[#17212b]/95 backdrop-blur-md border border-[#2b394a] rounded-2xl p-2 px-3 shadow-xl flex items-center justify-between overflow-x-auto no-scrollbar gap-1.5">
              {['❤️', '🔥', '👍', '👎', '😂', '🥰', '😍', '😭', '👏', '🎉'].map((emoji) => {
                const isSelectedByMe = Boolean(
                  currentUser && selectedMessage.reactions?.[emoji]?.includes(currentUser as any)
                );
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleToggleReaction(selectedMessage.id, emoji)}
                    className={`text-2xl p-2 rounded-xl active:scale-125 transition-all cursor-pointer ${
                      isSelectedByMe ? 'bg-[#2b5278] ring-2 ring-[#6ab2f2] scale-110' : 'hover:bg-white/10 active:bg-white/15'
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

            {/* Asosiy amallar bloki */}
            <div className="bg-[#17212b]/95 backdrop-blur-md border border-[#2b394a] rounded-2xl overflow-hidden shadow-2xl divide-y divide-[#242f3d]">
              
              {/* Javob berish (Reply) */}
              <button
                type="button"
                onClick={() => handleStartReply(selectedMessage)}
                className="w-full flex items-center justify-between px-4 py-3.5 active:bg-[#242f3d] text-sm text-[#6ab2f2] font-semibold transition cursor-pointer"
              >
                <span>Javob berish (Reply)</span>
                <Reply className="w-4 h-4 text-[#6ab2f2]" />
              </button>

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
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-500 to-indigo-500 flex items-center justify-center font-bold text-3xl shadow-xl">
                <span>{currentUser === 'me' ? 'S' : 'A'}</span>
              </div>
              <h3 className="font-bold text-lg mt-2">
                {myDisplayName}
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

      {/* TELEGRAM YUMALOQ VIDEO YOZISH PAYTIDA JONLI KAMERA KO'RINISHI */}
      {isVideoRecording && (
        <div 
          onMouseUp={(e) => {
            if (isRecordLockedRef.current) return;
            handleRecordButtonUp(e);
          }}
          onTouchEnd={(e) => {
            if (isRecordLockedRef.current) return;
            handleRecordButtonUp(e);
          }}
          className="absolute inset-0 z-40 bg-black/92 backdrop-blur-xs flex flex-col items-center justify-center select-none animate-in fade-in duration-200"
        >
          
          {/* TELEGRAM USLUBIDAGI YUMALOQ KAMERA OYNASI */}
          <div className="relative w-68 h-68 sm:w-72 sm:h-72 rounded-full overflow-hidden border-4 border-emerald-400 shadow-[0_0_60px_rgba(52,211,153,0.5)] bg-[#17212b] flex items-center justify-center">
            {/* AGAR STREAM HALI YUKLANAYOTGAN BO'LSA PULSE KO'RINISHI */}
            {!videoStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-400 bg-[#17212b] space-y-2">
                <Video className="w-12 h-12 animate-pulse" />
                <span className="text-xs text-white/80 font-medium">Kamera yoqilmoqda...</span>
              </div>
            )}

            <video 
              ref={setLiveVideoPreviewRef} 
              autoPlay 
              playsInline 
              muted 
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                v.muted = true;
                v.play().catch(() => {});
              }}
              onCanPlay={(e) => {
                const v = e.currentTarget;
                v.muted = true;
                v.play().catch(() => {});
              }}
              className="w-full h-full object-cover -scale-x-100" 
            />

            {/* VAQT SANAGICH */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md px-3.5 py-1 rounded-full text-xs text-white font-mono flex items-center space-x-1.5 shadow-lg border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>{videoRecordingDuration}s</span>
            </div>
          </div>

          {/* QULF HOLATI VA ISHORASI (SWIPE UP TO LOCK / QULFLANGAN) */}
          {!isRecordLocked ? (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                isRecordLockedRef.current = true;
                setIsRecordLocked(true);
                isHoldingRecordRef.current = false;
                if (window.navigator?.vibrate) window.navigator.vibrate(40);
              }}
              className="mt-4 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-white/90 text-xs font-medium animate-bounce shadow-xl cursor-pointer active:scale-95 transition-all"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Tepaga suring — qulflash (qo&apos;lsiz yozish)</span>
            </div>
          ) : (
            <div className="mt-4 flex items-center space-x-2 bg-emerald-500/25 backdrop-blur-md px-4 py-2 rounded-full border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-xl">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Qulflangan — bemalol gapiring</span>
            </div>
          )}

          {!isRecordLocked && (
            <p className="mt-2 text-[11px] text-white/60 font-medium tracking-wide">
              Qo&apos;yib yuborsangiz avtomatik yuboriladi
            </p>
          )}

          {/* PASTKI AMALLAR PANELI — QO'LGA ENG QULAY PASTKI QISMDA */}
          <div 
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="absolute bottom-6 sm:bottom-8 left-0 right-0 px-8 flex items-center justify-between z-50 safe-bottom pointer-events-auto max-w-sm mx-auto w-full"
          >
            {/* BEKOR QILISH TUGMASI (CHAPDA) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelVideoRecording(e);
              }}
              className="flex items-center space-x-2 px-5 py-3 rounded-full bg-red-500/25 active:bg-red-500/45 text-red-300 border border-red-500/40 backdrop-blur-md shadow-xl active:scale-95 transition-all cursor-pointer select-none"
              title="Bekor qilish"
            >
              <Trash2 className="w-5 h-5 shrink-0" />
              <span className="text-xs font-semibold tracking-wide">Bekor qilish</span>
            </button>

            {/* YUBORISH TUGMASI (O'NGDA) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleStopVideoRecording(e);
              }}
              className="flex items-center space-x-2 px-6 py-3 rounded-full bg-emerald-500 active:bg-emerald-600 text-white shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-95 transition-all cursor-pointer select-none font-semibold text-xs tracking-wide"
              title="Yuborish"
            >
              <Send className="w-5 h-5 mr-1" />
              <span>Yuborish</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
