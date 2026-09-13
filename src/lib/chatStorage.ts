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
 * Fallback: agar IndexedDB bo'lmasa yoki dastlabki migratsiyada localStorage'dan olish
 */
function getLocalStorageCache(): Message[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('azza_chat_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
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
          // Vaqti bo'yicha saralaymiz
          list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          resolve(list);
        } else {
          // Agar IndexedDB hali bo'sh bo'lsa, localStorage'dagi eski xabarlarni olamiz
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

  // 1. IndexedDB'ga to'liq saqlash (rasmlar, videolar, ovozli xabarlar bilan 1GB+ joy)
  try {
    const db = await openChatDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Eski xabarlarni tozalab, barchasini to'liq yangilaymiz
    store.clear();
    for (const msg of messages) {
      store.put(msg);
    }
  } catch (err) {
    console.warn('IndexedDB saqlashda ogohlantirish:', err);
  }

  // 2. localStorage uchun yengil zaxira nusxa
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('azza_chat_cache', JSON.stringify(messages));
    } catch {
      // Agar 5MB kvota to'lsa, katta base64 medialarsiz matnli qismini saqlaymiz
      try {
        const lightList = messages.map((m) => {
          if (m.media_url && m.media_url.length > 500) {
            return { ...m, media_url: '[cached]', media_urls: undefined };
          }
          return m;
        });
        localStorage.setItem('azza_chat_cache', JSON.stringify(lightList));
      } catch {}
    }
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
      map.set(m.id, m);
    }
  }

  // 2. Serverdan yoki yangi kelgan xabarlar bilan boyitamiz
  for (const inc of incomingList) {
    if (!inc || !inc.id) continue;
    const existing = map.get(inc.id);
    if (existing) {
      // Agar lokalda og'ir media yuklangan bo'lsa-yu, server payloadida qisqartirilgan bo'lsa
      map.set(inc.id, {
        ...existing,
        ...inc,
        media_url: inc.media_url || existing.media_url,
        media_urls: (inc.media_urls && inc.media_urls.length > 0) ? inc.media_urls : existing.media_urls,
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
