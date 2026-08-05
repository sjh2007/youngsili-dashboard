import { Component } from 'react';

export default class PageErrorBoundary extends Component<any, any> {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div role="alert" style={{padding:40,textAlign:'center'}}>
        <h3 style={{color:'#dc2626',margin:'0 0 8px'}}>이 페이지를 표시하는 중 오류가 발생했습니다</h3>
        <pre style={{whiteSpace:'pre-wrap',fontSize:12,color:'#64748b',background:'#f8fafc',padding:12,borderRadius:8,textAlign:'left',overflow:'auto'}}>{String((this.state.error && this.state.error.message) || this.state.error)}</pre>
        <p style={{color:'#64748b',fontSize:14}}>다른 메뉴로 이동하거나 새로고침해 주세요.</p>
        <button className="btn-primary" onClick={() => { this.setState({ error: null }); window.location.hash = '#dashboard'; }}>대시보드로 이동</button>
      </div>
    );
    return this.props.children;
  }
}
