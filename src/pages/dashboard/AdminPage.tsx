// DashboardApplication.tsx의 page==='admin'(구성원 관리/기관 관리) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { Plus, Copy } from 'lucide-react';
import { StatusBadge } from '../../components/ui';

export default function AdminPage(props: any) {
  const {
    isStaffUp, adminMsg, isSuper, me, saveOrgAddress, alertSettingSaving, updateAlertSetting,
    inviteRole, setInviteRole, grantableRoles, ROLE_KO, createInvite, invites, inviteLink, copyInvite,
    copiedInvite, deleteInvite, newOrgName, setNewOrgName, newOrgType, setNewOrgType, createOrg, orgs,
    ORG_TYPE_KO, newAcct, setNewAcct, createAccount, accounts, isAdmin, deleteAccount,
  } = props;

  return (
    <div className="fade-in">
      {!isStaffUp ? (
        <div className="section" style={{textAlign:'center',color:'#94a3b8',padding:40}}>접근 권한이 없습니다.</div>
      ) : (
      <>
        {adminMsg && <div className="success-banner" style={{marginBottom:16}}>{adminMsg}</div>}

        {/* 기관 정보 — 주소·관할 지역 (기상 공공데이터 연동 기준, R1·R5) */}
        {!isSuper && (
          <div className="section" style={{marginBottom:16}}>
            <div className="section-title">기관 정보</div>
            <div style={{display:'flex',gap:24,flexWrap:'wrap',alignItems:'center'}}>
              <div><div style={{fontSize:15,color:'#94a3b8',marginBottom:2}}>기관명</div><div style={{fontWeight:800}}>{me?.orgName||'-'}{me?.orgCode?` (${me.orgCode})`:''}</div></div>
              <div><div style={{fontSize:15,color:'#94a3b8',marginBottom:2}}>관할 지역</div><div style={{fontWeight:800,color:me?.orgRegion?'#16a34a':'#dc2626'}}>{me?.orgRegion||'미설정'}</div></div>
              <div style={{flex:1,minWidth:200}}><div style={{fontSize:15,color:'#94a3b8',marginBottom:2}}>주소</div><div style={{fontSize:17}}>{me?.orgAddress||'미입력 — 주소를 등록하면 관할 지역 기상특보가 자동 연동됩니다'}</div></div>
              <button className="btn-secondary" onClick={saveOrgAddress}>{me?.orgAddress?'주소 변경':'주소 등록'}</button>
            </div>
          </div>
        )}

        {/* 경보 자동 안부콜 — 기본은 수동(대시보드 알림만), 켜면 감지 시 자동 발신 */}
        {!isSuper && (
          <div className="section" style={{marginBottom:16}}>
            <div className="section-title">경보 자동 안부콜 설정</div>
            <div style={{fontSize:15,color:'#64748b',marginBottom:14}}>
              꺼두면(기본) 감지 시 대시보드 알림만 오고, 전화멘트 페이지에서 직접 발송을 눌러야 합니다.
              켜면 감지 즉시 서버가 자동으로 안부콜을 발신합니다.
            </div>
            {[
              { key: 'autoForestFireCall' as const, label: '산불위험 자동 안부콜',
                desc: '산불위험지수 경계·심각 감지 시, 해당 지역 어르신에게만 자동 대피 안내 통화' },
              { key: 'autoWeatherAlertCall' as const, label: '기상경보 자동 안부콜',
                desc: '폭염·한파·호우 등 감지 시 어르신 전원에게 자동 안부 통화' },
              { key: 'autoDisasterCall' as const, label: '긴급재난문자 자동 안부콜',
                desc: '위급·긴급 재난문자 수신 시, 해당 지역 어르신에게만 자동 안내 통화 (야간 07~21시 외 발신 안 함)' },
            ].map(row => (
              <label key={row.key} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderTop:'1px solid #f1f5f9',cursor:'pointer'}}>
                <input
                  type="checkbox"
                  checked={!!me?.[row.key]}
                  disabled={alertSettingSaving === row.key}
                  onChange={e => updateAlertSetting(row.key, e.target.checked)}
                  style={{width:20,height:20,flexShrink:0}}
                />
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:16}}>{row.label}{alertSettingSaving===row.key?' (저장 중…)':''}</div>
                  <div style={{fontSize:14,color:'#94a3b8'}}>{row.desc}</div>
                </div>
                <span style={{fontSize:14,fontWeight:800,color:me?.[row.key]?'#16a34a':'#94a3b8'}}>{me?.[row.key]?'켜짐':'꺼짐'}</span>
              </label>
            ))}
          </div>
        )}

        {/* 구성원 초대 링크 — 센터장: 센터장·전담직원·지원사 / 전담직원: 지원사만 */}
        <div className="section admin-invite-section">
          <div className="admin-invite-heading">
            <div><div className="section-title">구성원 초대</div><p>역할을 선택해 전용 가입 링크를 발급하세요. 링크는 7일 동안 한 번만 사용할 수 있습니다.</p></div>
          </div>
          <div className="admin-invite-create">
            <label htmlFor="invite-role">초대할 역할</label>
            <select id="invite-role" className="form-input" value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
              {grantableRoles.map(r=>(<option key={r} value={r}>{ROLE_KO[r]}</option>))}
            </select>
            <button className="btn-primary" onClick={createInvite}><Plus size={17}/> 초대 링크 만들기</button>
          </div>
          {invites.length>0 && (
            <div className="admin-invite-list"><div className="admin-invite-list-title">사용 가능한 초대 링크 <span>{invites.length}</span></div><table className="table">
              <thead><tr><th>역할</th><th>초대 링크</th><th>만든 사람</th><th>유효기간</th><th>관리</th></tr></thead>
              <tbody>
                {invites.map(v=>(
                  <tr key={v.code}>
                    <td><StatusBadge tone="normal">{ROLE_KO[v.role]||v.role}</StatusBadge></td>
                    <td><span className="admin-invite-link" title={inviteLink(v.code)}>{inviteLink(v.code)}</span></td>
                    <td style={{fontSize:16,color:'#64748b'}}>{(v.createdBy||'').split('@')[0]}</td>
                    <td style={{fontSize:16,color:'#64748b'}}>{v.expiresAt?new Date(v.expiresAt).toLocaleDateString('ko-KR'):'-'}</td>
                    <td><div className="admin-invite-actions">
                      <button className="btn-small" onClick={()=>copyInvite(v.code)}><Copy size={15}/>{copiedInvite===v.code?'복사됨':'복사'}</button>
                      <button className="btn-danger-outline" onClick={()=>deleteInvite(v.code)}>초대 취소</button>
                    </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
          {invites.length===0 && <div className="admin-invite-empty">현재 사용 가능한 초대 링크가 없습니다.</div>}
        </div>

        {isSuper && (<>
        {/* 새 기관 만들기 */}
        <div className="section" style={{marginBottom:16}}>
          <div className="section-title">새 기관(복지관) 만들기</div>
          <div style={{fontSize:16,color:'#64748b',marginBottom:10}}>기관을 만들면 <b>기관코드</b>가 자동 발급됩니다. 이 코드를 복지사에게 전달하면, 복지사가 어르신 폰 앱에 입력해 해당 기관으로 등록됩니다.</div>
          <div style={{display:'flex',gap:8,maxWidth:680}}>
            <input className="form-input" style={{flex:1}} value={newOrgName} onChange={e=>setNewOrgName(e.target.value)} placeholder="예) ○○구 노인복지관 / ○○장애인자립센터" onKeyDown={e=>e.key==='Enter'&&createOrg()}/>
            <select className="form-input" style={{width:170}} value={newOrgType} onChange={e=>setNewOrgType(e.target.value)}>
              <option value="senior">노인맞춤돌봄</option>
              <option value="disability">장애인활동지원</option>
            </select>
            <button className="btn-primary" style={{whiteSpace:'nowrap',padding:'0 20px'}} onClick={createOrg}>+ 기관 생성</button>
          </div>
        </div>

        {/* 기관 목록 */}
        <div className="section" style={{marginBottom:16}}>
          <div className="section-title">기관 목록 ({orgs.length})</div>
          <table className="table">
            <thead><tr><th>기관명</th><th>유형</th><th>기관코드</th><th>대상자</th><th>계정</th></tr></thead>
            <tbody>
              {orgs.length===0 && <tr><td colSpan={5} style={{textAlign:'center',color:'#94a3b8',padding:24}}>기관이 없습니다</td></tr>}
              {orgs.map(o=>(
                <tr key={o.orgId}>
                  <td><strong>{o.name}</strong></td>
                  <td><StatusBadge tone="normal">{ORG_TYPE_KO[o.orgType]||'노인맞춤돌봄'}</StatusBadge></td>
                  <td><span className="cycle-badge" style={{fontFamily:'monospace',fontWeight:800,letterSpacing:1,color:'#246BEB',background:'#eff6ff'}}>{o.code}</span></td>
                  <td>{o.elderCount}명</td>
                  <td>{o.userCount}개</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>)}

        {/* 새 구성원 계정 (직접 생성 — 초대 링크 대신 관리자가 만들어 전달할 때) */}
        <div className="section" style={{marginBottom:16}}>
          <div className="section-title">새 구성원 계정 만들기</div>
          <div style={{fontSize:16,color:'#64748b',marginBottom:10}}>구성원의 로그인 계정을 직접 만듭니다. <b>지원사</b> 계정은 배정된 이용자만 볼 수 있습니다.</div>
          <div className="form-grid" style={{maxWidth:720}}>
            <div className="form-field"><label className="form-label">이름</label><input className="form-input" value={newAcct.name} onChange={e=>setNewAcct(a=>({...a,name:e.target.value}))} placeholder="예) 김복지" autoComplete="off"/></div>
            <div className="form-field"><label className="form-label">전화번호 <span style={{color:'#94a3b8',fontWeight:400}}>(번호만 입력)</span></label><input className="form-input" inputMode="numeric" value={newAcct.phone} onChange={e=>setNewAcct(a=>({...a,phone:e.target.value.replace(/[^0-9]/g,'')}))} placeholder="01012345678" autoComplete="off"/></div>
            <div className="form-field"><label className="form-label">이메일(로그인 ID)</label><input className="form-input" value={newAcct.email} onChange={e=>setNewAcct(a=>({...a,email:e.target.value}))} placeholder="worker@example.com" autoComplete="off"/></div>
            <div className="form-field"><label className="form-label">초기 비밀번호(6자 이상)</label><input className="form-input" type="password" value={newAcct.password} onChange={e=>setNewAcct(a=>({...a,password:e.target.value}))} placeholder="복지사에게 전달" autoComplete="new-password"/></div>
            {isSuper ? (<>
              <div className="form-field"><label className="form-label">소속 기관</label><select className="form-input" value={newAcct.orgId} onChange={e=>setNewAcct(a=>({...a,orgId:e.target.value}))}><option value="">기관 선택</option>{orgs.map(o=><option key={o.orgId} value={o.orgId}>{o.name} ({o.code})</option>)}</select></div>
              <div className="form-field"><label className="form-label">역할</label><select className="form-input" value={newAcct.role} onChange={e=>setNewAcct(a=>({...a,role:e.target.value}))}><option value="admin">센터장(관리자)</option><option value="staff">전담직원</option><option value="worker">지원사</option><option value="superadmin">운영자 (전체 + 기관관리)</option></select></div>
            </>) : (<>
              <div className="form-field"><label className="form-label">역할</label><select className="form-input" value={newAcct.role} onChange={e=>setNewAcct(a=>({...a,role:e.target.value}))}>{grantableRoles.map(r=>(<option key={r} value={r}>{ROLE_KO[r]}</option>))}</select></div>
              <div className="form-field"><label className="form-label">소속 기관</label><div style={{fontSize:17,fontWeight:700,color:'#1e3a6e',padding:'8px 0'}}>{me?.orgName||'우리 기관'}{me?.orgCode?` (${me.orgCode})`:''}</div></div>
            </>)}
          </div>
          <button className="btn-primary" style={{marginTop:12,padding:'10px 20px'}} onClick={createAccount}>+ 계정 생성</button>
        </div>

        {/* 계정 목록 */}
        <div className="section">
          <div className="section-title">대시보드 계정 ({accounts.length})</div>
          <table className="table">
            <thead><tr><th>이름</th><th>전화번호</th><th>이메일</th><th>소속 기관</th><th>역할</th><th>관리</th></tr></thead>
            <tbody>
              {accounts.length===0 && <tr><td colSpan={6} style={{textAlign:'center',color:'#94a3b8',padding:24}}>계정이 없습니다</td></tr>}
              {accounts.map(u=>{
                const org = orgs.find(o=>o.orgId===u.orgId);
                return (
                  <tr key={u.uid}>
                    <td><strong>{u.name||'—'}</strong>{u.uid===me?.uid&&<span style={{fontSize:14,color:'#16a34a',marginLeft:6}}>(나)</span>}</td>
                    <td style={{fontSize:16,color:'#64748b'}}>{u.phone||'—'}</td>
                    <td style={{fontSize:16,color:'#64748b'}}>{u.email}</td>
                    <td style={{fontSize:16,color:'#64748b'}}>{org?org.name:(me?.orgName||u.orgId)}</td>
                    <td>{u.role==='superadmin'?<StatusBadge tone="warning">운영자</StatusBadge>:<StatusBadge tone="normal">{ROLE_KO[u.role]||'센터장(관리자)'}</StatusBadge>}</td>
                    <td>{(u.role!=='superadmin'&&u.uid!==me?.uid&&isAdmin)?<button className="btn-danger-outline" style={{fontSize:15,padding:'4px 10px'}} onClick={()=>deleteAccount(u.uid,u.email)}>삭제</button>:<span style={{color:'#cbd5e1',fontSize:15}}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
      )}
    </div>
  );
}
