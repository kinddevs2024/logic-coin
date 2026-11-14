import {lazy,Suspense,useContext,type ComponentProps} from 'react';
import * as Base from './glass-surface-base';
import {AdminMaterialContext} from './admin/material-context';
const MaterialGlassSurface=lazy(()=>import('./admin/material-glass-surface').then(m=>({default:m.GlassSurface})));
export function GlassSurface(props:ComponentProps<typeof Base.GlassSurface>){const admin=useContext(AdminMaterialContext);if(!admin)return <Base.GlassSurface {...props}/>;return <Suspense fallback={<Base.GlassSurface {...props}/>}><MaterialGlassSurface {...props}/></Suspense>;}
