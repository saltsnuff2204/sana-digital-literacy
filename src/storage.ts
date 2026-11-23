import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { Lang, Progress, mergeProgress } from './model';
export type Identity = { token: string; user: { id: string; username: string; nickname: string }; server: string };
export type Settings = { theme: 'light'|'dark'; lang: Lang; grade: number; server: string; onboarded: boolean };
export const defaultSettings: Settings = { theme:'light',lang:'ru',grade:1,server:process.env.EXPO_PUBLIC_API_URL || (Platform.OS==='web' && typeof location!=='undefined'?location.origin:''),onboarded:false };
const authKey='sana.auth.v1';
export async function loadSettings(): Promise<Settings> { try { const s=JSON.parse(await AsyncStorage.getItem('sana.settings')||'null'); return {...defaultSettings,...s,theme:s?.theme==='dark'?'dark':'light',lang:s?.lang==='kk'?'kk':'ru',grade:[1,2,3,4].includes(s?.grade)?s.grade:1}; } catch {return defaultSettings;} }
export async function saveSettings(s: Settings) { await AsyncStorage.setItem('sana.settings',JSON.stringify(s)); }
export async function loadIdentity(): Promise<Identity|null> { try { const raw=Platform.OS==='web'?await AsyncStorage.getItem(authKey):await SecureStore.getItemAsync(authKey); const v=raw?JSON.parse(raw):null; return v?.token&&v?.user?.id&&v?.server?v:null; } catch {return null;} }
export async function saveIdentity(v: Identity|null) { if(Platform.OS==='web') {if(v) await AsyncStorage.setItem(authKey,JSON.stringify(v));else await AsyncStorage.removeItem(authKey);} else {if(v) await SecureStore.setItemAsync(authKey,JSON.stringify(v));else await SecureStore.deleteItemAsync(authKey);} }
export const progressKey=(identity:Identity|null)=>`sana.progress.${identity?identity.server+'.'+identity.user.id:'guest'}`;
export async function loadProgress(key:string):Promise<Progress> {const raw=await AsyncStorage.getItem(key); if(!raw)return {}; const parsed=JSON.parse(raw); if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('BAD_LOCAL_DATA');return parsed;}
export async function saveProgress(key:string,p:Progress) {await AsyncStorage.setItem(key,JSON.stringify(p));}
export async function api(server:string,route:string,method='GET',data?:unknown,token?:string) {
  const base=server.trim().replace(/\/$/,'');
  if(!/^https?:\/\//.test(base))throw new Error('SERVER_REQUIRED');
  const abort=new AbortController(); const timeout=setTimeout(()=>abort.abort(),12000);
  try {const response=await fetch(base+'/api'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:abort.signal});const result=await response.json();if(!response.ok)throw new Error(result.error||'NETWORK');return result;}
  catch(e) {if(e instanceof Error&&['SERVER_REQUIRED','INVALID_CREDENTIALS','INVALID_NICKNAME','USERNAME_TAKEN','WRONG_LOGIN','UNAUTHORIZED','RATE_LIMIT','INVALID_PROGRESS'].includes(e.message))throw e;throw new Error('NETWORK');}
  finally {clearTimeout(timeout);}
}
export async function syncProgress(identity:Identity,progress:Progress):Promise<Progress> {const remote=await api(identity.server,'/progress','PUT',{progress},identity.token);return mergeProgress(progress,remote.progress);}
