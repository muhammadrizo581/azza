import { Message } from './supabase';

const DB_NAME = 'azza_chat_db';
const DB_VERSION = 1;
const STORE_NAME = 'messages';

/**
 * IndexedDB bilan xavfsiz va barqaror ulanish o'rnatish
 */
function openChatDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB mavjud emas'));
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('IndexedDB ochilmadi'));
      };
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Xabarni to'liq tekshirish va media_type/media_url ni tiklash
 */
function sanitizeMessage(m: Message): Message {
  let text = m.text || '';
  let media_url = m.media_url === '[cached]' ? undefined : m.media_url;
  let media_urls = m.media_urls;
  let media_type = m.media_type;
  let duration = m.duration;
  let reply_to = m.reply_to;
  let reactions = m.reactions;
  let is_edited = m.is_edited;
  let is_read = Boolean(m.is_read);

  // Agar text ichida maxsus json format saqlangan bo'lsa, xotiradagi buzilgan ma'lumotlarni tiklaymiz
  if (typeof text === 'string' && text.startsWith('__PAYLOAD_JSON__:')) {
    try {
      const parsed = JSON.parse(text.replace('__PAYLOAD_JSON__:', ''));
      text = parsed.text || '';
      if (!media_url && parsed.media_url && parsed.media_url !== '[cached]') {
        media_url = parsed.media_url;
      }
      if (!media_urls && parsed.media_urls) {
        media_urls = parsed.media_urls;
      }
      if (!media_type && parsed.media_type) {
        media_type = parsed.media_type;
      }
      if (duration === undefined && parsed.duration !== undefined) {
        duration = parsed.duration;
      }
      if (!reply_to && parsed.reply_to) {
        reply_to = parsed.reply_to;
      }
      if (!reactions && parsed.reactions) {
        reactions = parsed.reactions;
      }
      if (parsed.is_read !== undefined) {
        is_read = Boolean(parsed.is_read);
      }
    } catch {}
  }

  if (!media_url && Array.isArray(media_urls) && media_urls.length > 0) {
    media_url = media_urls[0];
  }

  if (!media_type) {
    if (media_url?.startsWith('data:audio/') || media_url?.includes('audio/')) {
      media_type = 'voice';
    } else if (media_url?.startsWith('data:image/') || media_url?.includes('image/') || (media_urls && media_urls.length > 0)) {
      media_type = 'image';
    } else if (media_url?.startsWith('data:video/') || media_url?.includes('video/')) {
      media_type = 'video_note';
    }
  }

  return {
    ...m,
    text,
    media_url,
    media_urls,
    media_type,
    duration,
    reply_to,
    reactions,
    is_edited,
    is_read
  };
}

/**
 * Fallback: agar IndexedDB bo'lmasa yoki dastlabki migratsiyada localStorage'dan olish
 */
function getLocalStorageCache(): Message[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('azza_chat_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(sanitizeMessage);
      }
    }
  } catch {}
  return [];
}

/**
 * Xotiradan (IndexedDB) barcha chat xabarlarini bir lahzada yuklash
 */
export async function getCachedMessages(): Promise<Message[]> {
  try {
    const db = await openChatDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = req.result as Message[];
        if (Array.isArray(list) && list.length > 0) {
          const cleaned = list.map(sanitizeMessage);
          cleaned.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          resolve(cleaned);
        } else {
          resolve(getLocalStorageCache());
        }
      };

      req.onerror = () => {
        resolve(getLocalStorageCache());
      };
    });
  } catch {
    return getLocalStorageCache();
  }
}

/**
 * Xabarlarni IndexedDB xotirasiga to'liq va cheklovsiz saqlash
 */
export async function saveMessagesCache(messages: Message[]): Promise<void> {
  if (!Array.isArray(messages)) return;

  // 1. IndexedDB'ga to'liq saqlash (eski o'chirilgan xabarlarni tozalab, faqat mavjudlarini saqlaymiz)
  try {
    const db = await openChatDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.clear();
    for (const msg of messages) {
      if (msg && msg.id) {
        store.put(msg);
      }
    }
  } catch (err) {
    console.warn('IndexedDB saqlashda ogohlantirish:', err);
  }

  // 2. localStorage uchun yangilash
  if (typeof window !== 'undefined') {
    if (messages.length === 0) {
      try {
        localStorage.removeItem('azza_chat_cache');
      } catch {}
    } else {
      try {
        const recentList = messages.slice(-30);
        localStorage.setItem('azza_chat_cache', JSON.stringify(recentList));
      } catch {
        try {
          const lightList = messages.slice(-25).map((m) => {
            if (m.media_url && m.media_url.length > 500) {
              const { media_url, media_urls, ...rest } = m;
              return rest;
            }
            return m;
          });
          localStorage.setItem('azza_chat_cache', JSON.stringify(lightList));
        } catch {}
      }
    }
  }
}

/**
 * Bitta xabarni keshdan butunlay o'chirish
 */
export async function deleteCachedMessage(id: string): Promise<void> {
  try {
    const db = await openChatDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch {}
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('azza_chat_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((m: any) => m.id !== id);
          localStorage.setItem('azza_chat_cache', JSON.stringify(filtered));
        }
      }
    } catch {}
  }
}

/**
 * Lokal va server xabarlarini bir-birini yo'qotmasdan birlashtirish
 */
export function mergeMessageLists(existingList: Message[], incomingList: Message[]): Message[] {
  const map = new Map<string, Message>();

  // 1. Avval mavjud (lokal / keshdagi) xabarlarni joylaymiz
  for (const m of existingList) {
    if (m && m.id) {
      map.set(m.id, sanitizeMessage(m));
    }
  }

  // 2. Serverdan yoki yangi kelgan xabarlar bilan boyitamiz
  for (const rawInc of incomingList) {
    if (!rawInc || !rawInc.id) continue;
    const inc = sanitizeMessage(rawInc);
    const existing = map.get(inc.id);

    if (existing) {
      const mergedText = (inc.text && inc.text.trim()) ? inc.text : existing.text;
      const mergedMediaUrl = (inc.media_url && inc.media_url !== '[cached]')
        ? inc.media_url
        : (existing.media_url && existing.media_url !== '[cached]') ? existing.media_url : inc.media_url;
      const mergedMediaUrls = (inc.media_urls && inc.media_urls.length > 0)
        ? inc.media_urls
        : existing.media_urls;

      let mergedMediaType = inc.media_type || existing.media_type;
      if (!mergedMediaType) {
        if (mergedMediaUrl?.startsWith('data:audio/') || mergedMediaUrl?.includes('audio/')) {
          mergedMediaType = 'voice';
        } else if (mergedMediaUrl?.startsWith('data:image/') || mergedMediaUrl?.includes('image/') || (mergedMediaUrls && mergedMediaUrls.length > 0)) {
          mergedMediaType = 'image';
        } else if (mergedMediaUrl?.startsWith('data:video/') || mergedMediaUrl?.includes('video/')) {
          mergedMediaType = 'video_note';
        }
      }

      map.set(inc.id, {
        ...existing,
        ...inc,
        text: mergedText,
        media_type: mergedMediaType,
        media_url: mergedMediaUrl,
        media_urls: mergedMediaUrls,
        duration: inc.duration !== undefined ? inc.duration : existing.duration,
        is_read: Boolean(inc.is_read || existing.is_read),
        reactions: inc.reactions !== undefined ? inc.reactions : existing.reactions,
        is_edited: inc.is_edited !== undefined ? inc.is_edited : existing.is_edited,
        reply_to: inc.reply_to !== undefined ? inc.reply_to : existing.reply_to
      });
    } else {
      map.set(inc.id, inc);
    }
  }

  const result = Array.from(map.values());
  result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return result;
}

/**
 * Xotirani tozalash (logout qilinganda)
 */
export async function clearChatCache(): Promise<void> {
  try {
    const db = await openChatDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  } catch {}
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('azza_chat_cache');
    } catch {}
  }
}
