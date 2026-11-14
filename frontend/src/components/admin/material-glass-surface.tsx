import {useContext,useEffect,useRef,type ComponentProps} from 'react';
import {Paper} from '@mui/material';
import {GlassSurface as Base} from '../glass-surface-base';
import {AdminMaterialContext} from './material-context';
import {css} from './admin-primitives.web';
export function GlassSurface({children,style,intensity,variant,...props}:ComponentProps<typeof Base>){const admin=useContext(AdminMaterialContext),ref=useRef<HTMLDivElement>(null);useEffect(()=>{if(!admin||!ref.current||!props.onLayout)return;const notify=()=>{const r=ref.current!.getBoundingClientRect();props.onLayout?.({nativeEvent:{layout:{width:r.width,height:r.height,x:r.x,y:r.y}}} as any);};const observer=new ResizeObserver(notify);observer.observe(ref.current);return()=>observer.disconnect();},[admin,props.onLayout]);if(!admin)return <Base {...props} style={style} intensity={intensity} variant={variant}>{children}</Base>;return <Paper ref={ref} variant="outlined" data-testid={props.testID} style={{...css(style),borderRadius:12,background:'#fff',borderColor:'#e3e9ef',boxShadow:'0 1px 2px #162b3a04'}}>{children}</Paper>}
