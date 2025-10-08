const fs = require('fs-extra');
const path = require('path');

class Cache {
  constructor() {
    this.cacheDir = path.join(__dirname, '..', 'cache');
    this.memoryCache = new Map();
    this.ensureCacheDir();
  }

  async ensureCacheDir() {
    try {
      await fs.ensureDir(this.cacheDir);
    } catch (error) {
      console.error('Error creating cache directory:', error);
    }
  }

  get(key) {
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      const item = this.memoryCache.get(key);
      if (item.expiry > Date.now()) {
        return item.data;
      } else {
        this.memoryCache.delete(key);
      }
    }

    // Check file cache
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      if (fs.existsSync(filePath)) {
        const cacheData = fs.readJsonSync(filePath);
        if (cacheData.expiry > Date.now()) {
          // Load into memory cache
          this.memoryCache.set(key, cacheData);
          return cacheData.data;
        } else {
          // Remove expired file
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error('Error reading cache file:', error);
    }

    return null;
  }

  set(key, data, ttlMs = 24 * 60 * 60 * 1000) { // Default 24 hours
    const item = {
      data,
      expiry: Date.now() + ttlMs,
      created: Date.now()
    };

    // Store in memory
    this.memoryCache.set(key, item);

    // Store in file
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      fs.writeJsonSync(filePath, item);
    } catch (error) {
      console.error('Error writing cache file:', error);
    }
  }

  clear() {
    this.memoryCache.clear();
    try {
      fs.emptyDirSync(this.cacheDir);
    } catch (error) {
      console.error('Error clearing cache directory:', error);
    }
  }

  // Clean expired entries
  async cleanExpired() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        try {
          const cacheData = await fs.readJson(filePath);
          if (cacheData.expiry <= now) {
            await fs.unlink(filePath);
          }
        } catch (error) {
          // Remove corrupted files
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Error cleaning expired cache:', error);
    }
  }
}

module.exports = new Cache();