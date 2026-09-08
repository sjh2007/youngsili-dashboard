// DashboardApplication.tsx의 page==='elders'(어르신 관리) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { Search, X, LayoutGrid, List, Plus } from 'lucide-react';
import { GroupHeader } from '../../components/common';
import { Toolbar, StatusBadge } from '../../components/ui';
import { STATUS_CONFIG } from '../../constants/app';

export default function EldersPage(props: any) {
  const {
    me, T, copyOrgCode, orgCopied, searchName, setSearchName, REGIONS, regionFilter, setRegionFilter,
    filter, setFilter, elders, sortBy, setSortBy, viewMode, setViewMode, downloadCsvTemplate,
    csvInputRef, handleCsvFile, openRegister, filteredElders, pendingElders, approveElder,
    selectedElders, toggleAllElders, bulkRunning, bulkChannel, stopBulkCall, bulkDone, bulkQueue,
    setBulkConfirm, deleteSelectedElders, EldersEmpty, getSolitudeRisk, getNoResponseDays, openDetail,
    toggleElderSel, renderLastCall, elderSecOv, setElderSecOv, normalCardView, setNormalCardView,
    calling, setCallModal, setSelectedElders,
  } = props;

  return (
    <div className="fade-in elders-page">
      {me?.orgCode && (
        <div className="infobar">
          <div className="infobar-text">
            <div className="infobar-title">앱으로 {T.elder} 등록하기</div>
            <div className="infobar-desc">{T.elder} 폰의 <b>영실이 앱 설정</b>에 아래 <b>기관코드</b>를 입력해 정보를 등록하면 <b>승인 대기</b>에 표시됩니다.</div>
          </div>
          <button className="orgcode-chip" onClick={copyOrgCode} title="클릭하면 복사">
            <span className="orgcode-value">{me.orgCode}</span>
            <span className="orgcode-action">{orgCopied?'복사됨':'복사'}</span>
          </button>
        </div>
      )}
      <div className="elders-controls">
        <Toolbar className="elder-toolbar" label={`${T.elder} 검색과 상태 필터`}>
          <div className="search-box elder-search"><Search size={19} aria-hidden="true"/><input className="search-input" placeholder={`${T.elder} 이름으로 검색`} value={searchName} onChange={e => setSearchName(e.target.value)}/>{searchName && <button className="search-clear" onClick={() => setSearchName('')} aria-label="검색어 지우기"><X size={16}/></button>}</div>
          <select className="form-input region-select" aria-label="지역 선택" value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>{REGIONS.map(r => <option key={r} value={r}>{r==='전체'?'전체 지역':r}</option>)}</select>
          <div className="filter-bar" aria-label="상태 필터">{['all','danger','warning','normal'].map(f=>(<button key={f} className={`filter-btn ${filter===f?'filter-active':''}`} onClick={()=>setFilter(f)}>{f==='all'?'전체':STATUS_CONFIG[f].label}<span className="filter-count">{f==='all'?elders.length:elders.filter(e=>e.status===f).length}</span></button>))}</div>
        </Toolbar>
        <Toolbar className="elder-toolbar2" label={`${T.elder} 정렬과 보기 설정`}>
          <div className="elder-sort-row">
          <span className="elder-control-label">정렬</span>
          {[{id:'status',label:'위험도순'},{id:'risk',label:'고독사위험'},{id:'noResponse',label:'미응답순'},{id:'age',label:'나이순'},{id:'name',label:'이름순'}].map(s=>(<button key={s.id} className={`sort-btn ${sortBy===s.id?'sort-active':''}`} onClick={()=>setSortBy(s.id)}>{s.label}</button>))}
        </div>
        <div className="elder-actions-row">
          <div className="view-toggle" role="group" aria-label="보기 방식">
            <button className={`view-btn ${viewMode==='card'?'view-active':''}`} onClick={()=>setViewMode('card')} aria-pressed={viewMode==='card'}>
              <LayoutGrid size={16}/>
              카드
            </button>
            <button className={`view-btn ${viewMode==='table'?'view-active':''}`} onClick={()=>setViewMode('table')} aria-pressed={viewMode==='table'}>
              <List size={16}/>
              목록
            </button>
          </div>
          <button className="btn-secondary" onClick={downloadCsvTemplate} title="엑셀에 채워 넣을 CSV 양식 다운로드">CSV 양식</button>
          <button className="btn-secondary" onClick={()=>csvInputRef.current&&csvInputRef.current.click()} title="CSV 파일로 어르신 일괄 등록">CSV 일괄 등록</button>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{display:'none'}} onChange={e=>{const f=e.target.files&&e.target.files[0]; handleCsvFile(f); e.target.value='';}}/>
          <button className="btn-primary elder-register-btn" onClick={openRegister}><Plus size={17}/> 신규 등록</button>
        </div>
        </Toolbar>
      </div>
      <div className="search-result-count">총 <strong>{filteredElders.length}명</strong>{searchName && <span> · "{searchName}" 검색결과</span>}{regionFilter !== '전체' && <span> · {regionFilter}</span>}</div>

      {pendingElders.length > 0 && (
        <div className="section pending-section">
          <div className="section-title">
            승인 대기 <span className="pending-badge">{pendingElders.length}</span>
            <span className="section-sub">앱에서 등록 신청한 {T.elder}입니다. 승인하면 자동 전화 대상에 포함됩니다.</span>
          </div>
          {pendingElders.map(e => (
            <div key={e.phone} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'#fff',border:'1px solid #fde68a',borderRadius:10,marginBottom:8}}>
              <div className="table-avatar">{(e.name||'?')[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700}}>{e.name} <span style={{fontSize:15,color:'#94a3b8'}}>{e.age?`${e.age}세 · `:''}{e.region||''}</span></div>
                <div style={{fontSize:16,color:'#64748b'}}>{e.phone}{e.caregiver?` · 담당 ${e.caregiver}`:''}{e.guardianName?` · 보호자 ${e.guardianName}`:''}</div>
              </div>
              <button className="btn-primary" onClick={()=>approveElder(e.phone)}>승인·활성화</button>
            </div>
          ))}
        </div>
      )}

      {filteredElders.length > 0 && (
        <label className="select-all">
          <input type="checkbox" checked={filteredElders.every(e=>selectedElders.has(e.id))} onChange={()=>toggleAllElders(filteredElders)}/>
          <span>전체 선택</span>
        </label>
      )}
      {/* 일괄 작업 바 — 선택했을 때만 나타난다(평상시 위험 버튼 노출 금지, B2B 표준) */}
      {selectedElders.size > 0 && (
        <div className="bulkbar" role="region" aria-label="선택 항목 일괄 작업">
          <span className="bulkbar-count">{selectedElders.size}명 선택됨</span>
          <div className="bulkbar-actions">
            <button className="btn-secondary btn-xs" onClick={()=>setSelectedElders(new Set())}>선택 해제</button>
            {bulkRunning && bulkChannel==='pstn'
              ? <button className="btn-secondary btn-xs" onClick={stopBulkCall}>발신 중단 ({bulkDone.length}/{bulkQueue.length})</button>
              : <button className="btn-secondary btn-xs" disabled={bulkRunning} onClick={()=>{
                  const queue = elders.filter(e=>selectedElders.has(e.id));
                  setBulkConfirm({ count: queue.length, queue, channel: 'pstn', isAlert: false, alertLabel: null });
                }}>일반전화 동시발신</button>
            }
            <button className="btn-danger btn-xs" onClick={deleteSelectedElders}>선택 삭제</button>
          </div>
        </div>
      )}

      {viewMode === 'card' && (()=>{
        // P2-9: 상태별 섹션 접기 — 위험·주의 기본 펼침, 정상은 접힘 + 컴팩트 리스트/카드 전환 토글
        if (filteredElders.length === 0) return <EldersEmpty/>;
        const renderCard = elder => {
          const risk = getSolitudeRisk(elder);
          const noResponseDays = getNoResponseDays(elder.lastCall, elder.lastCallAt);
          return (
            <div key={elder.id} className="elder-card" onClick={()=>openDetail(elder)} style={selectedElders.has(elder.id)?{outline:'2px solid #246BEB',outlineOffset:2}:undefined}>
              <div className="elder-top"><div style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={selectedElders.has(elder.id)} onClick={e=>e.stopPropagation()} onChange={()=>toggleElderSel(elder.id)} style={{width:16,height:16,cursor:'pointer'}}/><div className="elder-avatar">{(elder.name||'?')[0]}</div></div><div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}><StatusBadge tone={elder.status || 'normal'}>{(STATUS_CONFIG[elder.status]||STATUS_CONFIG.normal).label}</StatusBadge><div className="risk-badge" style={{background:risk.bg,color:risk.color}}>{risk.label}</div></div></div>
              <div className="elder-name">{elder.name}</div>
              <div className="elder-info">{elder.age?`${elder.age}세 · `:''}{elder.title} · {elder.region}</div>
              {elder.caregiver && <div className="elder-info" style={{color:'#246BEB',fontWeight:600}}>담당: {elder.caregiver}</div>}
              {noResponseDays >= 1 && <div className={`no-response-tag ${noResponseDays >= 3 ? 'no-response-danger' : 'no-response-warning'}`}>{noResponseDays >= 99 ? '통화이력 없음' : `${noResponseDays}일째 미응답`}</div>}
              <div className="elder-last">마지막 통화: {renderLastCall(elder)}</div>
              {elder.keyword && <div className="keyword-tag mt8">"{elder.keyword}" 감지</div>}
              {elder.visits > 0 && <div className="visit-tag mt8">방문 필요 {elder.visits}회</div>}
              {!elder.callActive && <div className="paused-tag mt8">전화 중단 중</div>}
            </div>
          );
        };
        const renderCompactRow = elder => (
          <div key={elder.id} onClick={()=>openDetail(elder)}
            style={{display:'flex',alignItems:'center',gap:12,padding:'8px 14px',background:selectedElders.has(elder.id)?'#eff6ff':'#fff',border:'1px solid '+(selectedElders.has(elder.id)?'#93c5fd':'#e2e8f0'),borderRadius:10,marginBottom:6,cursor:'pointer',flexWrap:'wrap'}}>
            <input type="checkbox" checked={selectedElders.has(elder.id)} onClick={e=>e.stopPropagation()} onChange={()=>toggleElderSel(elder.id)} style={{width:15,height:15,cursor:'pointer'}}/>
            <span style={{fontWeight:700,fontSize:17,minWidth:96}}>{elder.name}{elder.age?` (${elder.age}세)`:''}</span>
            <span style={{fontSize:16,color:'#64748b',minWidth:80}}>{elder.region}</span>
            {elder.caregiver && <span style={{fontSize:16,color:'#64748b'}}>담당 {elder.caregiver}</span>}
            <span style={{fontSize:15}}>{renderLastCall(elder)}</span>
            <span style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
              {!elder.callActive && <span style={{fontSize:15,fontWeight:700,color:'#dc2626'}}>전화 중단</span>}
              <StatusBadge tone={elder.status || 'normal'}>{(STATUS_CONFIG[elder.status]||STATUS_CONFIG.normal).label}</StatusBadge>
              <span style={{color:'#94a3b8',fontSize:15,fontWeight:700}}>상세 ›</span>
            </span>
          </div>
        );
        return [['danger','위험'],['warning','주의'],['normal','정상']]
          .map(([k,l])=>({k,l,list:filteredElders.filter(e=>e.status===k)}))
          .filter(g=>g.list.length>0)
          .map(g=>{
            const open = elderSecOv[g.k] !== undefined ? elderSecOv[g.k] : g.k!=='normal';
            return (
              <div key={g.k} style={{marginBottom:14}}>
                <GroupHeader label={g.l} count={g.list.length} unit="명"
                  chips={g.k==='normal'?[]:[{label:'미응답 3일↑',value:g.list.filter(e=>getNoResponseDays(e.lastCall,e.lastCallAt)>=3).length,color:'#dc2626'}]}
                  flag={g.k==='danger'&&!open?'위험 어르신 확인 필요':null}
                  open={open} onToggle={()=>setElderSecOv(p=>({...p,[g.k]:!open}))}/>
                {open && g.k==='normal' && (
                  <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}>
                    <button
                      onClick={()=>setNormalCardView(v=>!v)}
                      className="btn-secondary elder-view-icon-btn"
                      aria-label={normalCardView?'목록으로 보기':'카드로 보기'}
                      title={normalCardView?'목록으로 보기':'카드로 보기'}
                    >
                      {normalCardView ? <List size={20} aria-hidden="true"/> : <LayoutGrid size={20} aria-hidden="true"/>}
                    </button>
                  </div>
                )}
                {open && (g.k==='normal' && !normalCardView
                  ? <div>{g.list.map(renderCompactRow)}</div>
                  : <div className="elder-grid">{g.list.map(renderCard)}</div>)}
              </div>
            );
          });
      })()}

      {viewMode === 'table' && (
        <table className="table">
          <thead><tr><th style={{width:40}}><input type="checkbox" checked={filteredElders.length>0&&filteredElders.every(e=>selectedElders.has(e.id))} onChange={()=>toggleAllElders(filteredElders)} className="cb"/></th><th>어르신</th><th>성별/호칭</th><th>나이</th><th>지역</th><th>담당 복지사</th><th>마지막 통화</th><th>미응답</th><th>고독사 위험도</th><th>상태</th><th>키워드</th><th>즉시 전화</th></tr></thead>
          <tbody>
            {filteredElders.length === 0 && <tr><td colSpan={12}><EldersEmpty/></td></tr>}
            {filteredElders.map(elder => {
              const risk = getSolitudeRisk(elder);
              const noResponseDays = getNoResponseDays(elder.lastCall, elder.lastCallAt);
              return (
                <tr key={elder.id} style={{cursor:'pointer',...(selectedElders.has(elder.id)?{background:'#eff6ff'}:{})}} onClick={()=>openDetail(elder)}>
                  <td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selectedElders.has(elder.id)} onChange={()=>toggleElderSel(elder.id)} className="cb"/></td>
                  <td><div style={{display:'flex',alignItems:'center',gap:8}}><div className="table-avatar">{(elder.name||'?')[0]}</div><strong>{elder.name}</strong></div></td>
                  <td><span className="cycle-badge">{elder.title}</span></td>
                  <td>{elder.age?`${elder.age}세`:'—'}</td>
                  <td style={{fontSize:16,color:'#64748b'}}>{elder.region}</td>
                  <td style={{fontSize:16,color:'#64748b'}}>{elder.caregiver||'-'}</td>
                  <td style={{fontSize:16,color:'#64748b'}}>{renderLastCall(elder)}</td>
                  <td>{noResponseDays===0?<span style={{color:'#22c55e',fontWeight:700}}>정상</span>:<span style={{color:noResponseDays>=3?'#ef4444':'#f59e0b',fontWeight:700}}>{noResponseDays>=99?'통화이력 없음':`${noResponseDays}일`}</span>}</td>
                  <td><span className="risk-badge-sm" style={{background:risk.bg,color:risk.color}}>{risk.label}</span></td>
                  <td><StatusBadge tone={elder.status || 'normal'}>{(STATUS_CONFIG[elder.status]||STATUS_CONFIG.normal).label}</StatusBadge></td>
                  <td>{elder.keyword ? <span className="keyword-tag">"{elder.keyword}"</span> : <span style={{color:'#9ca3af',fontSize:15}}>없음</span>}</td>
                  <td onClick={e=>e.stopPropagation()}><button className={`btn-call-sm ${calling===elder.id?'btn-calling':''}`} onClick={()=>setCallModal(elder)} disabled={calling===elder.id}>{calling===elder.id?'발신 중':'앱 전화'}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
