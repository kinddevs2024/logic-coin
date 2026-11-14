export * from './localized-native-base';
import {forwardRef,useContext,lazy,Suspense,type ComponentProps} from 'react';
import {CopyTextInput as Base} from './localized-native-base';
import {AdminMaterialContext} from './admin/material-context';
const Material=lazy(()=>import('./admin/admin-primitives.web').then(m=>({default:m.AdminTextInput})));
export const CopyTextInput=forwardRef<any,ComponentProps<typeof Base>>(function CopyTextInput(props,ref){const admin=useContext(AdminMaterialContext);if(!admin)return <Base {...props} ref={ref}/>;return <Suspense fallback={<Base {...props} ref={ref}/>}><Material {...props} ref={ref}/></Suspense>;});
