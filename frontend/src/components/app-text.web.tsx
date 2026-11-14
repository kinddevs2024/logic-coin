import {lazy,Suspense,useContext,type ComponentProps} from 'react';
import * as Base from './app-text-base';
import {AdminMaterialContext} from './admin/material-context';
const MaterialAppText=lazy(()=>import('./admin/material-app-text').then(m=>({default:m.AppText})));
export function AppText(props:ComponentProps<typeof Base.AppText>){const admin=useContext(AdminMaterialContext);if(!admin)return <Base.AppText {...props}/>;return <Suspense fallback={<Base.AppText {...props}/>}><MaterialAppText {...props}/></Suspense>;}
