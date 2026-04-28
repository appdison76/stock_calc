import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { DART_OPEN_API_BASE } from './dartConfig';
import { fetchWithTimeout } from './dartHttp';

const CORP_ZIP_TIMEOUT_MS = 120_000;

/** 캐시 버전 bump 시 이전 잘못된 소량 캐시 무시 */
const CACHE_NAME = 'dart_corp_stock_map_v3.json';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** 상장 6자리 매핑이 이보다 적으면 응답·파싱 오류로 간주 (대략 국내 상장 수 백~천 단위) */
const MIN_VALID_LISTED_MAP_SIZE = 200;

/** XML 스캔 중 UI 양보 주기 (거대 corpCode.xml 대응) */
const PARSE_YIELD_EVERY = 600;

function corpMapCachePath(): string | null {
  const base = FileSystem.cacheDirectory;
  return base ? `${base}${CACHE_NAME}` : null;
}

interface CorpMapFile {
  savedAt: number;
  map: Record<string, string>;
}

let memoryMap: Map<string, string> | null = null;

async function readDiskCache(): Promise<Map<string, string> | null> {
  const path = corpMapCachePath();
  if (!path) return null;
  try {
    const raw = await FileSystem.readAsStringAsync(path);
    const o = JSON.parse(raw) as CorpMapFile;
    if (!o.map || typeof o.savedAt !== 'number') return null;
    if (Date.now() - o.savedAt > CACHE_MAX_AGE_MS) return null;
    const map = new Map(Object.entries(o.map));
    if (map.size < MIN_VALID_LISTED_MAP_SIZE) return null;
    return map;
  } catch {
    return null;
  }
}

async function writeDiskCache(map: Map<string, string>): Promise<void> {
  const path = corpMapCachePath();
  if (!path) return;
  if (map.size < MIN_VALID_LISTED_MAP_SIZE) return;
  try {
    const body: CorpMapFile = {
      savedAt: Date.now(),
      map: Object.fromEntries(map),
    };
    await new Promise((r) => setTimeout(r, 0));
    await FileSystem.writeAsStringAsync(path, JSON.stringify(body));
  } catch (e) {
    console.warn('[DartCorpCode] 캐시 저장 실패:', e);
  }
}

function stripBom(s: string): string {
  if (s.length > 0 && s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

/** 속성·CDATA·닫는 태그 공백 허용 (`<stock_code type="abc">` 등) */
function tagInnerDigits(inner: string, tag: string, digits: number): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i');
  const m = re.exec(inner);
  if (!m) return null;
  const t = m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/\s/g, '');
  if (!new RegExp(`^\\d{${digits}}$`).test(t)) return null;
  return t;
}

function normalizeListedStock6(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (d.length < 1 || d.length > 6) return null;
  return d.padStart(6, '0');
}

/** `<corp>...</corp>` 내부 — CDATA·공백·종목코드 앞자리 0 누락 허용 */
function extractStockCorpFromInner(inner: string): [string, string] | null {
  const cc = tagInnerDigits(inner, 'corp_code', 8);
  const scRaw = (() => {
    const re = /<stock_code[^>]*>([\s\S]*?)<\/stock_code\s*>/i;
    const m = re.exec(inner);
    if (!m) return null;
    return m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
  })();
  if (!cc || !scRaw) return null;
  const sc = normalizeListedStock6(scRaw);
  if (!sc) return null;
  return [sc, cc];
}

/**
 * OpenDART CORPCODE.xml: 행 단위가 `<list>...</list>` 이고 그 안에 corp_code·stock_code 가 옴.
 * (구문서/예제의 `<corp>` 래퍼는 실제 ZIP과 다를 수 있어 둘 다 스캔)
 */
async function scanBlockRows(
  xml: string,
  openNeedle: string,
  closeNeedle: string
): Promise<Map<string, string>> {
  const raw = stripBom(xml);
  const lower = raw.toLowerCase();
  const map = new Map<string, string>();
  let pos = 0;
  let scanned = 0;
  const closeLower = closeNeedle.toLowerCase();
  const closeLen = closeLower.length;

  while (pos < lower.length) {
    const open = lower.indexOf(openNeedle, pos);
    if (open < 0) break;
    const openEnd = raw.indexOf('>', open);
    if (openEnd < 0) break;
    const close = lower.indexOf(closeLower, openEnd);
    if (close < 0) break;
    const inner = raw.slice(openEnd + 1, close);
    const pair = extractStockCorpFromInner(inner);
    if (pair) map.set(pair[0], pair[1]);
    pos = close + closeLen;
    scanned++;
    if (scanned % PARSE_YIELD_EVERY === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return map;
}

async function parseCorpXmlStreamingIncremental(xml: string): Promise<Map<string, string>> {
  const fromList = await scanBlockRows(xml, '<list', '</list>');
  if (fromList.size >= MIN_VALID_LISTED_MAP_SIZE) {
    return fromList;
  }
  const fromCorp = await scanBlockRows(xml, '<corp', '</corp>');
  return new Map([...fromList, ...fromCorp]);
}

function isZipBuffer(u8: Uint8Array): boolean {
  return u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04;
}

function decodeUtf8(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  } catch {
    return '';
  }
}

function pickCorpXmlEntryFromZip(names: string[]): string | null {
  const corp = names.filter((n) => /(^|\/)CORPCODE\.xml$/i.test(n) && !n.endsWith('/'));
  if (corp.length === 0) return null;
  corp.sort((a, b) => a.length - b.length);
  return corp[0];
}

/** corpCode API: ZIP 또는 일부 환경에서 평문 XML — JSON이면 오류 응답 */
export async function loadDartStockCorpMap(apiKey: string): Promise<Map<string, string>> {
  if (memoryMap && memoryMap.size >= MIN_VALID_LISTED_MAP_SIZE) return memoryMap;

  const disk = await readDiskCache();
  if (disk && disk.size >= MIN_VALID_LISTED_MAP_SIZE) {
    memoryMap = disk;
    return memoryMap;
  }

  const url = `${DART_OPEN_API_BASE}/corpCode.xml?crtfc_key=${encodeURIComponent(apiKey)}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, CORP_ZIP_TIMEOUT_MS);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`corpCode.xml 다운로드 시간 초과(${CORP_ZIP_TIMEOUT_MS / 1000}초). 네트워크를 확인해 주세요.`);
    }
    throw e;
  }
  if (!res.ok) {
    throw new Error(`corpCode.xml HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  const u8 = new Uint8Array(buf);
  await new Promise((r) => setTimeout(r, 0));

  let xml: string;

  const head = decodeUtf8(buf.slice(0, Math.min(500, buf.byteLength))).trimStart();
  if (head.startsWith('{')) {
    const body = decodeUtf8(buf);
    let j: { status?: string; message?: string };
    try {
      j = JSON.parse(body) as { status?: string; message?: string };
    } catch {
      throw new Error('corpCode 응답이 JSON 형태이나 파싱에 실패했습니다. 인증키를 확인하세요.');
    }
    throw new Error(
      j.message?.trim() ||
        (j.status ? `DART 오류 코드 ${j.status} (인증키·IP 제한·일일 한도 등)` : 'DART corpCode API 오류')
    );
  }

  if (isZipBuffer(u8)) {
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    const xmlEntry = pickCorpXmlEntryFromZip(names);
    if (!xmlEntry) {
      throw new Error(`ZIP 안에서 CORPCODE.xml을 찾지 못했습니다. (파일 수: ${names.length})`);
    }
    xml = await zip.files[xmlEntry].async('string');
  } else {
    xml = decodeUtf8(buf);
    if (!xml.includes('<corp') && !xml.includes('<CORP')) {
      throw new Error('corpCode 응답이 ZIP도 아니고 기업 목록 XML도 아닙니다.');
    }
  }

  await new Promise((r) => setTimeout(r, 0));
  const map = await parseCorpXmlStreamingIncremental(xml);
  if (map.size < MIN_VALID_LISTED_MAP_SIZE) {
    throw new Error(
      `고유번호·종목코드 매핑이 너무 적습니다(파싱 ${map.size}건, 정상 시 수백 건 이상). ` +
        `앱 캐시를 지운 뒤 다시 시도하거나, opendart.fss.or.kr 에서 인증키·일일 한도를 확인해 주세요.`
    );
  }

  memoryMap = map;
  void writeDiskCache(map);
  return map;
}

export async function resolveDartCorpCode(apiKey: string, stockCode6: string): Promise<string | null> {
  const code = stockCode6.trim().replace(/\.(KS|KQ)$/i, '');
  if (!/^\d{6}$/.test(code)) return null;
  const m = await loadDartStockCorpMap(apiKey);
  return m.get(code) ?? null;
}
