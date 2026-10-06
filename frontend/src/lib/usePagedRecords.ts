import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';

export interface PageResult<T> { items: T[]; page: number; page_size: number; total: number; total_pages: number }
export function usePagedRecords<T>(path: string, params: Record<string, string | number>, revision = 0) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== 'all').map(([k,v]) => [k,String(v)])).toString();
  const [data,setData] = useState<PageResult<T>>({items:[],page:1,page_size:50,total:0,total_pages:0});
  const [error,setError] = useState('');
  const [changed,setChanged] = useState(0);
  useEffect(() => {
    const listener = () => setChanged(n => n + 1);
    window.addEventListener('mdlm:record-saved', listener);
    return () => window.removeEventListener('mdlm:record-saved', listener);
  }, []);
  useEffect(() => {
    let active = true;
    apiJson<PageResult<T>>(`${path}?${query}`).then(result => { if(active) {setData(result);setError('');window.dispatchEvent(new CustomEvent('mdlm:page-loaded',{detail:{path,items:result.items}}));} }).catch(e => { if(active) setError(String(e)); });
    return () => {active=false;};
  }, [path,query,revision,changed]);
  return {data,error};
}
