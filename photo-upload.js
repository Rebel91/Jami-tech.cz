// Fotografie zůstávají v tomto prohlížeči do odeslání objednávky.
window.JamiPhotos = {
  async validate(file) {
    if (!file || !file.size) throw new Error("Vyberte fotografii.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Fotografie je větší než 10 MB.");
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const extension = file.name.split(".").pop().toLowerCase();
    const starts = (...signature) => signature.every((value, index) => bytes[index] === value);
    const valid = ((extension === "jpg" || extension === "jpeg") && starts(255, 216, 255))
      || (extension === "png" && starts(137, 80, 78, 71, 13, 10, 26, 10))
      || (extension === "webp" && starts(82, 73, 70, 70) && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP");
    if (!valid) throw new Error("Nahrajte obrázek JPG, PNG nebo WebP. Obsah souboru musí odpovídat příponě.");
  },
  async database() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("jami-photos", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("photos");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("Fotografii se nepodařilo uložit do prohlížeče."));
    });
  },
  async access(id, operation, value) {
    const database = await this.database();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction("photos", operation === "get" ? "readonly" : "readwrite");
        const store = transaction.objectStore("photos");
        const request = operation === "put" ? store.put(value, id) : store[operation](id);
        let result;
        request.onsuccess = () => { result = request.result; };
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = transaction.onerror = () => reject(new Error("Fotografii se nepodařilo uložit do prohlížeče."));
      });
    } finally { database.close(); }
  },
  async save(id, file) {
    await this.validate(file);
    return this.access(id, "put", { name: file.name, type: file.type, bytes: await file.arrayBuffer() });
  },
  async get(id) {
    const stored = await this.access(id, "get");
    return stored ? new File([stored.bytes], stored.name, { type: stored.type }) : null;
  },
  remove(id) { return this.access(id, "delete"); }
};
