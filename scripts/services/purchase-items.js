/** Use the system's import preparation so container contents get fresh, linked IDs. */
export async function preparePurchaseItems(items) {
  const ItemClass = globalThis.CONFIG?.Item?.documentClass;
  if (typeof ItemClass?.createWithContents === "function") return ItemClass.createWithContents(items);
  return items.map(item => {
    const data = item.toObject();
    delete data._id;
    return data;
  });
}
