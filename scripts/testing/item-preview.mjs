import { assert } from '../../../morelord-core/scripts/testing/in-game.js';
import { openItemPreview } from '../../../morelord-core/scripts/ui/item-preview.js';

export const itemPreviewCheck = {
  id: 'morelord-marketplace.player-item-preview',
  async run() {
    assert(!game.user.isGM, 'Run on a player client in Dev1.');
    const source = new CONFIG.Item.documentClass({ name: 'Restricted preview regression', type: 'loot', ownership: { default: 0 } });
    const before = JSON.stringify(source.toObject());
    assert(!source.testUserPermission(game.user, 'OBSERVER'), 'Fixture reproduces restricted sheet access.');
    let sheet;
    try {
      sheet = await openItemPreview(source);
      assert(sheet?.rendered, 'Restricted item opens without a permission error.');
      assert(sheet.document !== source && !sheet.document.isOwner, 'Preview is a separate Observer document.');
      assert(!sheet.isEditable, 'Player cannot edit the preview.');
      assert(JSON.stringify(source.toObject()) === before, 'Source data and permissions are unchanged.');
    } finally { await sheet?.close(); }
  }
};
