import { weatherRefreshDecision, weatherStatusText } from './weatherAvailability';
import { WeatherMapSchema } from '../schemas';
it('validates unavailable weather with null temperature and preserves expiry reason',()=>{
  const payload={서울:{temp:null,condition:'정보 없음',alert:'none',alertText:'',noData:true,unavailableReason:'key_expired'}};
  const parsed=WeatherMapSchema.safeParse(payload);
  expect(parsed.success).toBe(true);
  expect(WeatherMapSchema.parse(payload).서울.unavailableReason).toBe('key_expired');
  expect(WeatherMapSchema.safeParse({서울:{temp:null,unavailableReason:'unrecognized'}}).success).toBe(false);
});
it('expired or unavailable weather never clears existing warnings or advances success time',()=>{
  expect(weatherRefreshDecision({서울:{noData:true,unavailableReason:'key_expired',alert:'none'}}))
    .toEqual({stale:true,updateTime:false,automaticAlert:null});
  expect(weatherStatusText({noData:true,unavailableReason:'key_expired',alertText:'특보 없음'})).toContain('인증키 만료');
  expect(weatherStatusText({noData:true})).not.toContain('특보 없음');
});
it('cached stale values stay explicitly unavailable even if temperature or alert is present',()=>{
  expect(weatherRefreshDecision({서울:{stale:true,temp:35,alert:'heatwave',unavailableReason:'authentication_failed'}}).automaticAlert).toBeNull();
  expect(weatherStatusText({stale:true,temp:35,unavailableReason:'authentication_failed'})).toContain('인증 실패');
});
it('partial failures may raise fresh warnings but cannot infer all regions safe',()=>{
  expect(weatherRefreshDecision({서울:{alert:'none'},대구:{noData:true}}).automaticAlert).toBeNull();
  expect(weatherRefreshDecision({서울:{alert:'heatwave'},대구:{noData:true}}).automaticAlert).toBe('heatwave');
  expect(weatherRefreshDecision({서울:{alert:'none'}})).toEqual({stale:false,updateTime:true,automaticAlert:'none'});
  expect(weatherRefreshDecision({}).automaticAlert).toBeNull();
});
it.each([
  ['not_configured','미설정'],['grid_unavailable','좌표'],['rate_limited','한도'],['upstream_error','연동 지연'],
])('shows %s reason', (reason,message)=>{
  expect(weatherStatusText({noData:true,unavailableReason:reason})).toContain(message);
});
