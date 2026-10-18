import { readFileSync } from 'node:fs';
const path = process.env.GOOGLE_SERVICES_JSON;
if (!path) throw new Error('Background push release requires GOOGLE_SERVICES_JSON');
const config = JSON.parse(readFileSync(path, 'utf8'));
const client = config.client?.find(item => item.client_info?.android_client_info?.package_name === 'com.kinddevs.logiccoin');
if (!config.project_info?.project_id || !config.project_info?.project_number || !client?.client_info?.mobilesdk_app_id || !client.api_key?.some(key => key.current_key)) {
  throw new Error('Firebase Android configuration is incomplete or belongs to another package');
}
console.log('Firebase Android configuration matches Logic Coin; server sender credentials require separate verification.');
