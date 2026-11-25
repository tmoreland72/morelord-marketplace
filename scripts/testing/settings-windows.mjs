import {checkSettingsSave} from '../../../morelord-core/scripts/testing/settings-save.js';
export const marketplaceSettingsSaveCheck={id:'marketplace.settings-save-and-close',run:()=>checkSettingsSave('morelord-marketplace.marketplaceConfiguration',{buyRate:'1',sellRate:'0.5'})};
