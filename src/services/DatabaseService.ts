import * as SQLite from 'expo-sqlite';
import { Account } from '../models/Account';
import { Stock } from '../models/Stock';
import { AveragingRecord } from '../models/AveragingRecord';
import { TradingRecord } from '../models/TradingRecord';
import { Currency } from '../models/Currency';

const DB_NAME = 'stock_calculator.db';
const DB_VERSION = 1;

let db: SQLite.SQLiteDatabase | null = null;
let isInitializing = false;

/**
 * 데이터베이스 초기화 및 연결
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  // 이미 초기화 중이면 대기
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (db) return db;
  }

  try {
    isInitializing = true;
    db = await SQLite.openDatabaseAsync(DB_NAME);
    
    // 외래키 제약조건 활성화 (SQLite는 기본적으로 비활성화되어 있음)
    await db.execAsync('PRAGMA foreign_keys = ON;');
    
    // 스키마 생성
    await createTables(db);
    
    // 디버그: 데이터베이스 파일 경로 로그 출력
    console.log('📊 SQLite 데이터베이스 초기화 완료');
    console.log('📁 데이터베이스 파일명:', DB_NAME);
    console.log('💡 Android 경로: /data/data/com.neovisioning.stockcalc/databases/' + DB_NAME);
    console.log('💡 확인 방법: adb pull /data/data/com.neovisioning.stockcalc/databases/' + DB_NAME + ' ./');
    
    return db;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * 테이블 생성
 */
async function createTables(database: SQLite.SQLiteDatabase): Promise<void> {
  // accounts 테이블
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT NOT NULL CHECK(currency IN ('KRW', 'USD')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // stocks 테이블 생성 (스키마가 안정화되었으므로 IF NOT EXISTS만 사용)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS stocks (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      ticker TEXT NOT NULL,
      name TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      average_price REAL NOT NULL DEFAULT 0,
      current_price REAL,
      currency TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );
  `);

  // averaging_records 테이블 (매수/매도 통합 거래 기록)
  // 스키마가 안정화되었으므로 IF NOT EXISTS만 사용
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS averaging_records (
      id TEXT PRIMARY KEY,
      stock_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      currency TEXT NOT NULL CHECK(currency IN ('KRW', 'USD')),
      exchange_rate REAL,
      average_price_before REAL,
      average_price_after REAL,
      average_price_at_sell REAL,
      profit REAL,
      total_quantity_before INTEGER NOT NULL,
      total_quantity_after INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE
    );
  `);
  
  // 기존 백업 테이블 정리 (더 이상 사용하지 않음)
  try {
    await database.execAsync(`DROP TABLE IF EXISTS stocks_backup;`);
    await database.execAsync(`DROP TABLE IF EXISTS averaging_records_backup;`);
    console.log('✅ 기존 백업 테이블 정리 완료');
  } catch (error) {
    // 백업 테이블이 없으면 무시
  }

  // 인덱스 생성 (성능 최적화)
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_stocks_account_id ON stocks(account_id);
    CREATE INDEX IF NOT EXISTS idx_stocks_ticker ON stocks(ticker);
    CREATE INDEX IF NOT EXISTS idx_averaging_records_stock_id ON averaging_records(stock_id);
    CREATE INDEX IF NOT EXISTS idx_averaging_records_created_at ON averaging_records(created_at);
  `);
}

/**
 * 고유 ID 생성
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== Accounts ====================

/**
 * 계좌 생성
 */
export async function createAccount(
  name: string,
  currency: Currency
): Promise<Account> {
  const database = await initDatabase();
  const now = Date.now();
  const account: Account = {
    id: generateId(),
    name,
    currency,
    createdAt: now,
    updatedAt: now,
  };

  await database.runAsync(
    `INSERT INTO accounts (id, name, currency, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?)`,
    [account.id, account.name, account.currency, account.createdAt, account.updatedAt]
  );

  return account;
}

/**
 * 모든 계좌 조회
 */
export async function getAllAccounts(): Promise<Account[]> {
  const database = await initDatabase();
  const result = await database.getAllAsync<any>(
    `SELECT 
      id, 
      name, 
      currency, 
      created_at as createdAt, 
      updated_at as updatedAt 
    FROM accounts 
    ORDER BY created_at DESC`,
    []
  );
  return result as Account[];
}

/**
 * 계좌 조회 (ID로)
 */
export async function getAccountById(id: string): Promise<Account | null> {
  const database = await initDatabase();
  const result = await database.getFirstAsync<any>(
    `SELECT 
      id, 
      name, 
      currency, 
      created_at as createdAt, 
      updated_at as updatedAt 
    FROM accounts 
    WHERE id = ?`,
    [id]
  );
  return (result as Account) || null;
}

/**
 * 계좌 업데이트
 */
export async function updateAccount(
  id: string,
  updates: { name?: string; currency?: Currency }
): Promise<void> {
  const database = await initDatabase();
  const now = Date.now();
  const updatesList: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    updatesList.push('name = ?');
    values.push(updates.name);
  }
  if (updates.currency !== undefined) {
    updatesList.push('currency = ?');
    values.push(updates.currency);
  }

  updatesList.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await database.runAsync(
    `UPDATE accounts SET ${updatesList.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * 계좌 삭제 (CASCADE로 하위 데이터 자동 삭제)
 */
export async function deleteAccount(id: string): Promise<void> {
  const database = await initDatabase();
  await database.runAsync(`DELETE FROM accounts WHERE id = ?`, [id]);
}

// ==================== Stocks ====================

/**
 * 종목 생성
 */
export async function createStock(
  accountId: string,
  ticker: string,
  currency: Currency,
  quantity: number,
  averagePrice: number,
  name?: string,
  currentPrice?: number
): Promise<Stock> {
  const database = await initDatabase();
  const now = Date.now();
  const stock: Stock = {
    id: generateId(),
    accountId,
    ticker: ticker.toUpperCase(),
    name,
    quantity,
    averagePrice,
    currentPrice,
    currency,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await database.runAsync(
      `INSERT INTO stocks (id, account_id, ticker, name, quantity, average_price, current_price, currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stock.id,
        stock.accountId,
        stock.ticker,
        stock.name || null,
        stock.quantity,
        stock.averagePrice,
        stock.currentPrice || null,
        stock.currency,
        stock.createdAt,
        stock.updatedAt,
      ]
    );
  } catch (error: any) {
    // UNIQUE 제약조건 위반인 경우 더 명확한 오류 메시지
    if (error?.message?.includes('UNIQUE constraint') || error?.message?.includes('unique')) {
      throw new Error(`이미 존재하는 종목입니다: ${ticker}`);
    }
    throw error;
  }

  return stock;
}

/**
 * 계좌의 모든 종목 조회
 */
export async function getStocksByAccountId(accountId: string): Promise<Stock[]> {
  const database = await initDatabase();
  const result = await database.getAllAsync<any>(
    `SELECT 
      id, 
      account_id as accountId, 
      ticker, 
      name, 
      quantity, 
      average_price as averagePrice, 
      current_price as currentPrice, 
      currency, 
      created_at as createdAt, 
      updated_at as updatedAt 
    FROM stocks 
    WHERE account_id = ? 
    ORDER BY ticker`,
    [accountId]
  );
  return result as Stock[];
}

/**
 * 종목 조회 (ID로)
 */
export async function getStockById(id: string): Promise<Stock | null> {
  const database = await initDatabase();
  const result = await database.getFirstAsync<any>(
    `SELECT 
      id, 
      account_id as accountId, 
      ticker, 
      name, 
      quantity, 
      average_price as averagePrice, 
      current_price as currentPrice, 
      currency, 
      created_at as createdAt, 
      updated_at as updatedAt 
    FROM stocks 
    WHERE id = ?`,
    [id]
  );
  return (result as Stock) || null;
}

/**
 * 종목 조회 (계좌ID, 티커, 시나리오 태그로)
 */
export async function getStockByTicker(
  accountId: string,
  ticker: string
): Promise<Stock | null> {
  const database = await initDatabase();
  const result = await database.getFirstAsync<any>(
    `SELECT 
      id, 
      account_id as accountId, 
      ticker, 
      name, 
      quantity, 
      average_price as averagePrice, 
      current_price as currentPrice, 
      currency, 
      created_at as createdAt, 
      updated_at as updatedAt 
    FROM stocks 
    WHERE account_id = ? AND ticker = ?`,
    [accountId, ticker.toUpperCase()]
  );
  return (result as Stock) || null;
}

/**
 * 종목 업데이트
 */
export async function updateStock(
  id: string,
  updates: {
    name?: string;
    quantity?: number;
    averagePrice?: number;
    currentPrice?: number;
  }
): Promise<void> {
  const database = await initDatabase();
  const now = Date.now();
  const updatesList: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    updatesList.push('name = ?');
    values.push(updates.name);
  }
  if (updates.quantity !== undefined) {
    updatesList.push('quantity = ?');
    values.push(updates.quantity);
  }
  if (updates.averagePrice !== undefined) {
    updatesList.push('average_price = ?');
    values.push(updates.averagePrice);
  }
  if (updates.currentPrice !== undefined) {
    updatesList.push('current_price = ?');
    values.push(updates.currentPrice);
  }

  updatesList.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await database.runAsync(
    `UPDATE stocks SET ${updatesList.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * 종목 삭제 (CASCADE로 하위 데이터 자동 삭제)
 */
export async function deleteStock(id: string): Promise<void> {
  const database = await initDatabase();
  await database.runAsync(`DELETE FROM stocks WHERE id = ?`, [id]);
}

// ==================== Averaging Records ====================

/**
 * 물타기 기록 생성
 */
export async function createAveragingRecord(
  stockId: string,
  buyPrice: number,
  quantity: number,
  feeRate: number,
  currency: Currency,
  averagePriceBefore: number,
  averagePriceAfter: number,
  totalQuantityBefore: number,
  totalQuantityAfter: number,
  exchangeRate?: number
): Promise<AveragingRecord> {
  const database = await initDatabase();
  const now = Date.now();
  const record: AveragingRecord = {
    id: generateId(),
    stockId,
    buyPrice,
    quantity,
    feeRate,
    currency,
    exchangeRate,
    averagePriceBefore,
    averagePriceAfter,
    totalQuantityBefore,
    totalQuantityAfter,
    createdAt: now,
  };

  // 새로운 구조 (type 컬럼 사용)로 저장
  await database.runAsync(
    `INSERT INTO averaging_records (
      id, stock_id, type, price, quantity, currency, exchange_rate,
      average_price_before, average_price_after,
      total_quantity_before, total_quantity_after, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.stockId,
      'BUY', // type
      record.buyPrice, // price
      record.quantity,
      record.currency,
      record.exchangeRate || null,
      record.averagePriceBefore,
      record.averagePriceAfter,
      record.totalQuantityBefore,
      record.totalQuantityAfter,
      record.createdAt,
    ]
  );

  return record;
}

/**
 * 종목의 모든 거래 기록 조회 (통합 타임라인, 시간순)
 */
export async function getTradingRecordsByStockId(
  stockId: string
): Promise<TradingRecord[]> {
  const database = await initDatabase();
  const result = await database.getAllAsync<any>(
    `SELECT 
      id, 
      stock_id as stockId, 
      type,
      price,
      quantity, 
      currency, 
      exchange_rate as exchangeRate, 
      average_price_before as averagePriceBefore, 
      average_price_after as averagePriceAfter,
      average_price_at_sell as averagePriceAtSell,
      profit,
      total_quantity_before as totalQuantityBefore, 
      total_quantity_after as totalQuantityAfter, 
      created_at as createdAt 
    FROM averaging_records 
    WHERE stock_id = ? 
    ORDER BY created_at ASC`,
    [stockId]
  );
  return result as TradingRecord[];
}

/**
 * 종목의 모든 물타기 기록 조회 (시간순) - 하위 호환성 유지
 * @deprecated getTradingRecordsByStockId 사용 권장
 */
export async function getAveragingRecordsByStockId(
  stockId: string
): Promise<AveragingRecord[]> {
  const records = await getTradingRecordsByStockId(stockId);
  // BUY 타입만 필터링하여 AveragingRecord로 변환
  return records
    .filter(r => r.type === 'BUY')
    .map(r => ({
      id: r.id,
      stockId: r.stockId,
      buyPrice: r.price,
      quantity: r.quantity,
      feeRate: 0, // 기존 구조에서는 필수였지만 이제는 사용하지 않음
      currency: r.currency,
      exchangeRate: r.exchangeRate,
      averagePriceBefore: r.averagePriceBefore || 0,
      averagePriceAfter: r.averagePriceAfter || 0,
      totalQuantityBefore: r.totalQuantityBefore,
      totalQuantityAfter: r.totalQuantityAfter,
      createdAt: r.createdAt,
    }));
}

/**
 * 매수 기록 생성
 */
export async function createBuyRecord(
  stockId: string,
  buyPrice: number,
  quantity: number,
  currency: Currency,
  averagePriceBefore: number,
  averagePriceAfter: number,
  totalQuantityBefore: number,
  totalQuantityAfter: number,
  exchangeRate?: number
): Promise<TradingRecord> {
  const database = await initDatabase();
  const now = Date.now();
  const record: TradingRecord = {
    id: generateId(),
    stockId,
    type: 'BUY',
    price: buyPrice,
    quantity,
    currency,
    exchangeRate,
    averagePriceBefore,
    averagePriceAfter,
    totalQuantityBefore,
    totalQuantityAfter,
    createdAt: now,
  };

  await database.runAsync(
    `INSERT INTO averaging_records (
      id, stock_id, type, price, quantity, currency, exchange_rate,
      average_price_before, average_price_after,
      total_quantity_before, total_quantity_after, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.stockId,
      record.type,
      record.price,
      record.quantity,
      record.currency,
      record.exchangeRate || null,
      record.averagePriceBefore || null,
      record.averagePriceAfter || null,
      record.totalQuantityBefore,
      record.totalQuantityAfter,
      record.createdAt,
    ]
  );

  return record;
}

/**
 * 매도 기록 생성
 */
export async function createSellRecord(
  stockId: string,
  sellPrice: number,
  quantity: number,
  currency: Currency,
  averagePriceAtSell: number,
  totalQuantityBefore: number,
  totalQuantityAfter: number,
  exchangeRate?: number
): Promise<TradingRecord> {
  const database = await initDatabase();
  const now = Date.now();
  
  // 손익 계산: (매도가 - 평단가) * 수량
  const profit = (sellPrice - averagePriceAtSell) * quantity;
  
  const record: TradingRecord = {
    id: generateId(),
    stockId,
    type: 'SELL',
    price: sellPrice,
    quantity,
    currency,
    exchangeRate,
    averagePriceAtSell,
    profit,
    totalQuantityBefore,
    totalQuantityAfter,
    createdAt: now,
  };

  await database.runAsync(
    `INSERT INTO averaging_records (
      id, stock_id, type, price, quantity, currency, exchange_rate,
      average_price_at_sell, profit,
      total_quantity_before, total_quantity_after, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.stockId,
      record.type,
      record.price,
      record.quantity,
      record.currency,
      record.exchangeRate || null,
      record.averagePriceAtSell || null,
      record.profit || null,
      record.totalQuantityBefore,
      record.totalQuantityAfter,
      record.createdAt,
    ]
  );

  return record;
}

/**
 * 거래 기록 삭제 (매수/매도 통합)
 */
export async function deleteTradingRecord(id: string): Promise<void> {
  const database = await initDatabase();
  await database.runAsync(`DELETE FROM averaging_records WHERE id = ?`, [id]);
}

/**
 * 물타기 기록 삭제 - 하위 호환성 유지
 * @deprecated deleteTradingRecord 사용 권장
 */
export async function deleteAveragingRecord(id: string): Promise<void> {
  return deleteTradingRecord(id);
}

// ==================== 브릿지 로직 ====================

/**
 * 물타기 계산 결과를 종목 데이터로 저장
 * @param accountId 계좌 ID
 * @param ticker 종목 코드
 * @param calculationHistory 계산기 히스토리
 * @param currency 통화
 */
/**
 * 같은 종목명이 있을 때 자동으로 번호를 추가한 이름 생성
 */
function generateUniqueStockName(baseName: string, existingNames: string[]): string {
  // 정확히 일치하는 이름이 없으면 그대로 반환
  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  // 번호 패턴 찾기: "이름 (숫자)" 형태
  const pattern = /^(.+?)\s*\((\d+)\)$/;
  const matches = baseName.match(pattern);
  
  let base = matches ? matches[1] : baseName;
  let startNumber = matches ? parseInt(matches[2]) : 1;

  // 같은 base를 가진 이름들 찾기
  const sameBaseNames = existingNames.filter(name => {
    const nameMatches = name.match(pattern);
    const nameBase = nameMatches ? nameMatches[1] : name;
    return nameBase === base;
  });

  // 다음 번호 찾기
  let nextNumber = startNumber;
  while (true) {
    const candidate = `${base} (${nextNumber})`;
    if (!existingNames.includes(candidate) && !sameBaseNames.some(n => n === candidate)) {
      return candidate;
    }
    nextNumber++;
  }
}

export async function saveCalculationAsScenario(
  accountId: string,
  stockName: string, // 종목명 (name 필드에 저장됨)
  calculationHistory: Array<{
    additionalBuyPrice: number;
    additionalQuantity: number;
    feeRate: number;
    exchangeRate?: number;
    newAveragePriceWithoutFee: number;
    newTotalQuantity: number;
    currentAveragePrice: number;
    currentQuantity: number;
  }>,
  currency: Currency
): Promise<{ stock: Stock; records: AveragingRecord[] }> {
  const database = await initDatabase();

  // 1. 같은 포트폴리오의 모든 종목 조회 (이름 중복 체크용)
  const existingStocks = await getStocksByAccountId(accountId);
  const existingNames = existingStocks.map(s => s.name || '').filter(n => n); // name만 사용

  // 2. 종목명 생성 (같은 이름이 있으면 자동으로 번호 추가)
  const uniqueStockName = generateUniqueStockName(stockName, existingNames);

  // 3. 새 종목 생성 (항상 새로 생성, 기존 종목 덮어쓰지 않음)
  const lastCalc = calculationHistory[calculationHistory.length - 1];
  const stock = await createStock(
    accountId,
    uniqueStockName.toUpperCase(), // ticker는 name을 대문자로 (나중에 Yahoo Finance 연동 시 사용)
    currency,
    lastCalc.newTotalQuantity,
    lastCalc.newAveragePriceWithoutFee,
    uniqueStockName // name은 중복 방지된 이름 사용
  );

  // 3. 계산 히스토리를 물타기 기록으로 변환하여 저장
  const records: AveragingRecord[] = [];
  let currentAveragePrice = calculationHistory[0]?.currentAveragePrice || 0;
  let currentQuantity = calculationHistory[0]?.currentQuantity || 0;

  for (const calc of calculationHistory) {
    const record = await createAveragingRecord(
      stock.id,
      calc.additionalBuyPrice,
      calc.additionalQuantity,
      calc.feeRate,
      currency,
      currentAveragePrice,
      calc.newAveragePriceWithoutFee,
      currentQuantity,
      calc.newTotalQuantity,
      calc.exchangeRate
    );

    records.push(record);

    // 다음 계산을 위한 업데이트
    currentAveragePrice = calc.newAveragePriceWithoutFee;
    currentQuantity = calc.newTotalQuantity;
  }

  return { stock, records };
}

