// 서버 응답 zod 스키마 — 런타임 검증 + TS 타입의 단일 소스.
// 서버(youngsili-server)가 내려주는 필드가 늘어날 수 있으므로 전부 loose(.catchall)로
// 정의한다: 알려진 필드는 타입·형식을 검증하고, 모르는 필드는 통과시킨다.
import { z } from 'zod';

const loose = <T extends z.ZodRawShape>(shape: T) => z.object(shape).catchall(z.unknown());

// ── 어르신 (elders) ──
// 서버는 Firestore 문서를 **가공 없이** 내려준다(elders.service.list → doc.data()).
// 따라서 저장 시점의 타입이 그대로 온다:
//   id       : Date.now() → number (옛 문서엔 string 도 있음)
//   age      : 폼 입력 그대로 → string 이 대부분, 숫자로 저장된 것도 있음
//   lastCall : '오늘 오후 3:20' 같은 문자열 (숫자·null 인 옛 문서 존재)
// 한쪽 타입만 허용하면 목록이 통째로 사라졌던 사고가 있어, 실제로 오는 값을 모두 받는다.
export const ElderSchema = loose({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  status: z.string().optional(),
  gender: z.string().optional(),
  age: z.union([z.number(), z.string()]).optional(),
  region: z.string().optional(),
  address: z.string().optional(),
  callCycle: z.string().optional(),
  callTime: z.string().optional(),
  callDays: z.array(z.string()).optional(),
  callActive: z.boolean().optional(),
  approved: z.boolean().optional(),
  lastCall: z.union([z.string(), z.number(), z.null()]).optional(),
  guardian: z.string().optional(),
  guardianPhone: z.string().optional(),
  caregiver: z.string().optional(),
  assignedTo: z.string().optional(),
});
export type Elder = z.infer<typeof ElderSchema>;
export const ElderListSchema = z.array(ElderSchema);

// ── 계정/기관 (/me) ──
export const MeSchema = loose({
  uid: z.string().optional(),
  email: z.string().optional(),
  orgId: z.string().optional(),
  role: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  orgName: z.string().optional(),
  orgCode: z.string().optional(),
  orgType: z.string().optional(),
  orgAddress: z.string().optional(),
  orgRegion: z.string().optional(),
  autoForestFireCall: z.boolean().optional(),
  autoWeatherAlertCall: z.boolean().optional(),
  autoDisasterCall: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  needsProvision: z.boolean().optional(),
});
export type Me = z.infer<typeof MeSchema>;

// GET /billing/balance — 선불 충전식 크레딧 잔액(1단계). creditBalance: null=마이그레이션 전 구기관(무제한)
export const BillingBalanceSchema = loose({
  orgId: z.string().optional(),
  creditBalance: z.number().nullable().optional(),
  trialEndsAt: z.string().nullable().optional(), // 30일 무료체험 종료 시각(ISO) — 미래면 크레딧 0이어도 통과
});
export type BillingBalance = z.infer<typeof BillingBalanceSchema>;

// POST /billing/topup — 포트원 결제 요청 생성(2단계) 응답. 프론트가 이 값으로 PortOne.js 결제창을 연다.
export const TopupResponseSchema = loose({
  paymentId: z.string(),
  storeId: z.string(),
  channelKey: z.string(),
  amount: z.number(),
  orderName: z.string(),
  payMethod: z.string().optional(),
});

// GET /billing/payment/:paymentId — 결제 1건 상태(무통장입금 계좌 정보 포함)
export const PaymentStatusSchema = loose({
  paymentId: z.string(),
  status: z.string(),
  amount: z.number(),
  virtualAccount: loose({
    bank: z.string().nullable().optional(),
    accountNumber: z.string().nullable().optional(),
    remitteeName: z.string().nullable().optional(),
    expiredAt: z.string().nullable().optional(),
  }).nullable(),
});
export type TopupResponse = z.infer<typeof TopupResponseSchema>;

// POST /billing/subscribe/register — 정액제 자동결제 등록 1단계 응답. 프론트가 이 값으로
// PortOne.js `requestIssueBillingKey()`를 연다.
export const SubscribeRegisterResponseSchema = loose({
  issueId: z.string(),
  storeId: z.string(),
  channelKey: z.string(),
  issueName: z.string(),
  amount: z.number(),
});
export type SubscribeRegisterResponse = z.infer<typeof SubscribeRegisterResponseSchema>;

// GET /billing/subscription, GET /console/subscriptions의 orgs[] 원소 — 정액제/자동결제 현재 상태
export const SubscriptionStatusSchema = loose({
  orgId: z.string(),
  orgName: z.string().optional(),
  plan: z.string().nullable(),
  elderCount: z.number(),
  monthlyAmount: z.number().nullable(),
  autoRenew: z.boolean(),
  nextChargeAt: z.string().nullable(),
  lastChargeError: z.string().nullable(),
});
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

// ── 알림 (/alerts) ──
// id: Firestore 문서 id(문자열)로 내려오지만 메모리 실시간 알림은 숫자(Date.now()) — 둘 다 받는다.
// at: 서버가 createdAt(Timestamp)을 ISO 문자열로 바꿔 내려준다. 값이 없으면 빈 문자열.
export const AlertSchema = loose({
  id: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  level: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  keyword: z.string().optional(),
  message: z.string().optional(),
  read: z.boolean().optional(),
  status: z.string().optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
  at: z.union([z.string(), z.number(), z.null()]).optional(),
});
export type Alert = z.infer<typeof AlertSchema>;
export const AlertListSchema = z.array(AlertSchema);

// ── 통화 기록 (/calls) ──
// 서버가 필드를 명시적으로 조립해 내려준다(calls.service.listCalls):
//   id=Firestore 문서 id(string) · durationSec=number · at=ISO 문자열 또는 null
export const CallSchema = loose({
  id: z.union([z.string(), z.number()]).optional(),
  phone: z.string().optional(),
  elderName: z.string().optional(),
  date: z.string().optional(),
  riskLevel: z.string().optional(),
  transcript: z.string().optional(),
  durationSec: z.union([z.number(), z.string()]).optional(),
  at: z.union([z.string(), z.number(), z.null()]).optional(),
  channel: z.string().optional(), // 'pstn' — 전화 발신 통화 (앱 통화는 없음)
});
export type Call = z.infer<typeof CallSchema>;
export const CallListSchema = z.array(CallSchema);

// ── 기상 (/weather) — { 지역명: {...} } 맵 ──
export const WeatherRegionSchema = loose({
  temp: z.union([z.number(), z.string()]).optional(),
  condition: z.string().optional(),
  alert: z.union([z.string(), z.boolean(), z.null()]).optional(),
  alertText: z.string().optional(),
  pop: z.union([z.number(), z.string()]).optional(),
  stale: z.boolean().optional(),
  noData: z.boolean().optional(),
  // 이 지역이 왜 목록에 있는지 — 'org'=기관 주소 지역, 'elder'=어르신 거주지, 'both'=둘 다
  source: z.enum(['org', 'elder', 'both']).optional(),
});
export const WeatherMapSchema = z.record(z.string(), WeatherRegionSchema);

// ── 기상특보 (/special-warning) — { 지역명: {...} } 맵, /weather와 동일 지역 key ──
export const SpecialWarningItemSchema = loose({
  type: z.string().optional(),
  label: z.string().optional(),
  level: z.string().optional(),
  startTime: z.string().optional(),
});
export const SpecialWarningRegionSchema = loose({
  areaCode: z.string().optional(),
  areaName: z.string().optional(),
  warnings: z.array(SpecialWarningItemSchema).optional(),
  noData: z.boolean().optional(),
  stale: z.boolean().optional(),
});
export const SpecialWarningMapSchema = z.record(z.string(), SpecialWarningRegionSchema);

// ── 산불위험지수 (/forest-fire) — { 지역명: {...} } 맵, /weather와 동일 지역 key ──
export const ForestFireRegionSchema = loose({
  grade: z.string().optional(), // '관심'|'주의'|'경계'|'심각'|'정보 없음'
  meanIndex: z.union([z.number(), z.null()]).optional(),
  maxIndex: z.union([z.number(), z.null()]).optional(),
  stale: z.boolean().optional(),
  noData: z.boolean().optional(),
});
export const ForestFireMapSchema = z.record(z.string(), ForestFireRegionSchema);

// ── 긴급재난문자 (/disaster-msg) — 기관 관할지역 오늘자 목록. 키 미발급 시 configured:false ──
export const DisasterMsgSchema = loose({
  sn: z.string().optional(),
  at: z.string().optional(),
  content: z.string().optional(),
  regionText: z.string().optional(),
  step: z.string().optional(), // 위급재난 | 긴급재난 | 안전안내
  category: z.string().optional(),
});
export const DisasterMsgResponseSchema = loose({
  configured: z.boolean().optional(),
  messages: z.array(DisasterMsgSchema).optional(),
});

/**
 * zod 검증을 **차단용으로 쓸지** 여부.
 *
 * false(현재) = 관찰 모드 — 검증은 그대로 돌려 불일치를 기록하지만, 데이터는 **그대로 통과**시킨다.
 * true        = 차단 모드 — 불일치 시 fallback(빈 배열 등)을 반환한다.
 *
 * 관찰 모드로 둔 이유: 차단 모드에서 타입이 하나만 어긋나도 목록이 통째로 빈 배열이 되는데,
 * 화면은 "데이터가 없음"처럼 보여서 원인을 찾는 데 오래 걸렸다(어르신 목록·통화 기록·경보 멘트
 * 세 번 반복). 서버 응답 타입이 코드로 고정되기 전까지는 통과시키고 기록만 남긴다.
 */
export const ZOD_BLOCKING = false;

/** 최근 검증 불일치 — 화면 배너로 노출해 조용히 묻히지 않게 한다. */
export type SchemaIssue = { at: string; path: string; message: string };
const issues: SchemaIssue[] = [];
const listeners = new Set<(list: SchemaIssue[]) => void>();

export function onSchemaIssue(fn: (list: SchemaIssue[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getSchemaIssues(): SchemaIssue[] {
  return issues;
}
export function clearSchemaIssues(): void {
  issues.length = 0;
  listeners.forEach((fn) => fn([]));
}

/**
 * safeParse 헬퍼.
 *
 * 검증에 실패해도(관찰 모드) 원본 데이터를 그대로 돌려준다 — 화면이 조용히 비는 것을 막는다.
 * 대신 불일치를 기록해 콘솔과 화면 배너로 드러낸다.
 */
export function parseOr<S extends z.ZodTypeAny, F>(schema: S, data: unknown, fallback: F): z.infer<S> | F {
  const r = schema.safeParse(data);
  if (r.success) return r.data;

  // 401/403(로그아웃·토큰만료)은 계약 위반이 아니라 인증 문제 — 소음으로 잡지 않는다.
  // 서버 v2는 error가 객체({code,message})라 String(error)가 '[object Object]'가 되므로
  // 레거시(문자열)·v2(객체) 양쪽에서 코드·메시지를 뽑아 검사한다.
  const e = (data as any)?.error;
  const errText = typeof e === 'string' ? e : e ? `${e.code ?? ''} ${e.message ?? ''}` : '';
  if (/(auth|token|unauthor|forbidden|권한|인증)/i.test(errText)) return fallback;

  console.warn('[zod] 서버 응답 타입 불일치:', r.error.issues.slice(0, 3), data);
  for (const i of r.error.issues.slice(0, 3)) {
    const rec = { at: new Date().toISOString(), path: i.path.join('.') || '(root)', message: i.message };
    if (!issues.some((x) => x.path === rec.path && x.message === rec.message)) issues.push(rec);
  }
  if (issues.length > 20) issues.splice(0, issues.length - 20);
  listeners.forEach((fn) => fn([...issues]));

  // 관찰 모드: 오류 응답이 아니면 원본을 그대로 통과시킨다 (화면이 비는 것보다 낫다)
  if (!ZOD_BLOCKING && data != null && !errText) return data as z.infer<S>;
  return fallback;
}
