import EventEmitter from "events";
import type { Collection, Db } from "mongodb";

/**
 * A Keyv-compatible store adapter that uses a shared MongoDB connection.
 *
 * Instead of each repository creating its own MongoClient (which causes
 * connection pool contention and intermittent failures), all repositories
 * share a single MongoClient and just reference different collections.
 */
export class SharedMongoStore extends EventEmitter {
  opts: Record<string, unknown> = {};
  namespace?: string;
  private collection: Collection;
  private indexesCreated: Promise<void>;

  constructor(db: Db, collectionName: string) {
    super();
    this.collection = db.collection(collectionName);
    this.indexesCreated = this.ensureIndexes();
  }

  private async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ key: 1 }, { unique: true, background: true });
    await this.collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, background: true },
    );
  }

  async get(key: string): Promise<unknown> {
    await this.indexesCreated;
    const doc = await this.collection.findOne({ key: { $eq: key } });
    if (!doc) return undefined;
    return doc.value;
  }

  async getMany(keys: string[]): Promise<unknown[]> {
    await this.indexesCreated;
    const docs = await this.collection
      .find({ key: { $in: keys } })
      .project({ _id: 0, value: 1, key: 1 })
      .toArray();
    return keys.map((k) => {
      const doc = docs.find((d) => d.key === k);
      return doc ? doc.value : undefined;
    });
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    await this.indexesCreated;
    const expiresAt = typeof ttl === "number" ? new Date(Date.now() + ttl) : null;
    await this.collection.updateOne(
      { key: { $eq: key } },
      { $set: { key, value, expiresAt } },
      { upsert: true },
    );
  }

  async delete(key: string): Promise<boolean> {
    await this.indexesCreated;
    if (typeof key !== "string") return false;
    const result = await this.collection.deleteOne({ key: { $eq: key } });
    return result.deletedCount > 0;
  }

  async deleteMany(keys: string[]): Promise<boolean> {
    await this.indexesCreated;
    const result = await this.collection.deleteMany({ key: { $in: keys } });
    return result.deletedCount > 0;
  }

  async clear(): Promise<void> {
    await this.indexesCreated;
    await this.collection.deleteMany({
      key: { $regex: this.namespace ? `^${this.namespace}:` : "" },
    });
  }

  async has(key: string): Promise<boolean> {
    await this.indexesCreated;
    const count = await this.collection.countDocuments({ key: { $eq: key } });
    return count !== 0;
  }

  async *iterator(namespace?: string): AsyncGenerator<[string, unknown], void> {
    await this.indexesCreated;
    const regexp = new RegExp(`^${namespace ? namespace + ":" : ".*"}`);
    const cursor = this.collection.find({ key: regexp });
    for await (const doc of cursor) {
      yield [doc.key as string, doc.value];
    }
  }

  async disconnect(): Promise<void> {
    // No-op: the shared MongoClient is managed by the caller
  }
}
