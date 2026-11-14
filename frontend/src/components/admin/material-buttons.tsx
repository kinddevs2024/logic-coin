import {useContext,type ComponentProps} from 'react';
import {Button,IconButton as MuiIconButton,CircularProgress} from '@mui/material';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Base from '../buttons-base';
import {AdminMaterialContext} from './material-context';
import {css} from './admin-primitives.web';
export function AppButton(props:ComponentProps<typeof Base.AppButton>){const admin=useContext(AdminMaterialContext);if(!admin)return <Base.AppButton {...props}/>;const {children,onPress,disabled,loading,icon,variant,style,accessibilityLabel,compact}=props;return <Button aria-label={accessibilityLabel} onClick={onPress} disabled={disabled||loading} color={variant==='danger'?'error':'primary'} variant={variant==='ghost'?'text':variant==='secondary'?'outlined':'contained'} size={compact?'small':'medium'} startIcon={loading?<CircularProgress size={16} color="inherit"/>:icon?<Ionicons name={icon} size={18}/>:undefined} style={css(style)} sx={{minHeight:compact?36:44,px:2,borderRadius:1}}>{children}</Button>}
export function IconButton(props:ComponentProps<typeof Base.IconButton>){const admin=useContext(AdminMaterialContext);if(!admin)return <Base.IconButton {...props}/>;return <MuiIconButton aria-label={props.label} onClick={props.onPress}><Ionicons name={props.name} size={22}/></MuiIconButton>}
