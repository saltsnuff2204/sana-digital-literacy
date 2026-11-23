import React,{createContext,useContext,useState} from 'react';
const light={ink:'#20243D',muted:'#74788C',purple:'#6554D9',accent:'#6554D9',deep:'#40348F',pale:'#F0EDFF',bg:'#F8F8FC',white:'#FFFFFF',onAccent:'#FFFFFF',line:'#E9E9F3',mint:'#D9F4E9',green:'#237A61',yellow:'#FFE69D',orange:'#ED966B',red:'#B34354',warm:'#FFF9EA',warmInk:'#74531A',errorBg:'#FFE8E9'};
export type Palette=typeof light;
const night:Palette={...light,ink:'#F1F0FA',muted:'#B2B0C6',purple:'#B9ABFF',deep:'#BFB3FF',pale:'#302A4B',bg:'#141420',white:'#20202F',line:'#373548',mint:'#203D35',green:'#8EDDBB',red:'#FFABB6',warm:'#393122',warmInk:'#F3D490',errorBg:'#482834'};
type Theme='light'|'dark';
const Context=createContext({C:light,dark:false,setTheme:(_theme:Theme)=>{}});
export function ThemeProvider({children}:{children:React.ReactNode}){const [theme,setTheme]=useState<Theme>('light');return <Context.Provider value={{C:theme==='dark'?night:light,dark:theme==='dark',setTheme}}>{children}</Context.Provider>;}
export const useTheme=()=>useContext(Context);
