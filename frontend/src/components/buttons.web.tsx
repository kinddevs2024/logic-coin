import {lazy,Suspense,useContext,type ComponentProps} from 'react';
import * as Base from './buttons-base';
import {AdminMaterialContext} from './admin/material-context';
const MaterialAppButton=lazy(()=>import('./admin/material-buttons').then(m=>({default:m.AppButton})));
export function AppButton(props:ComponentProps<typeof Base.AppButton>){const admin=useContext(AdminMaterialContext);if(!admin)return <Base.AppButton {...props}/>;return <Suspense fallback={<Base.AppButton {...props}/>}><MaterialAppButton {...props}/></Suspense>;}
const MaterialIconButton=lazy(()=>import('./admin/material-buttons').then(m=>({default:m.IconButton})));
export function IconButton(props:ComponentProps<typeof Base.IconButton>){const admin=useContext(AdminMaterialContext);if(!admin)return <Base.IconButton {...props}/>;return <Suspense fallback={<Base.IconButton {...props}/>}><MaterialIconButton {...props}/></Suspense>;}
