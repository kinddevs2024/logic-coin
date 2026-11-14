import {useContext,type ComponentProps} from 'react';
import {Typography} from '@mui/material';
import {AppText as Base} from '../app-text-base';
import {AdminMaterialContext} from './material-context';
import {css} from './admin-primitives.web';
export function AppText({children,variant='body',style,muted,color,numberOfLines,...props}:ComponentProps<typeof Base>){const admin=useContext(AdminMaterialContext);if(!admin)return <Base {...props} variant={variant} style={style} muted={muted} color={color} numberOfLines={numberOfLines}>{children}</Base>;return <Typography component="span" variant={variant==='title'?'h5':variant==='heading'?'h6':variant==='caption'?'caption':'body2'} aria-label={props.accessibilityLabel} role={props.accessibilityRole as any} onClick={props.onPress as any} style={css(style)} sx={{color:color??(muted?'text.secondary':'text.primary'),fontWeight:variant==='label'?600:undefined,...(numberOfLines?{overflow:'hidden',display:'-webkit-box',WebkitLineClamp:numberOfLines,WebkitBoxOrient:'vertical'}:{})}}>{children}</Typography>}
