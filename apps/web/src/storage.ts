import { GetObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import type { Config } from "./config";
import { emptyData, migrate, type GerageData } from "./data";
import i18n from "./i18n";

export type Snapshot = { data: GerageData; etag: string | null };

/**
 * Reads and writes the user's single JSON file in S3.
 *
 * The browser gets AWS credentials from the Cognito identity pool, which only
 * allow access to `users/<identityId>/*`. Writes are conditional on the ETag,
 * so a save from another device is never silently overwritten.
 */
export class Storage {
  private constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
    private readonly key: string,
  ) {}

  static async create(config: Config, idToken: string): Promise<Storage> {
    const credentials = fromCognitoIdentityPool({
      clientConfig: { region: config.region },
      identityPoolId: config.identityPoolId,
      logins: { [`cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`]: idToken },
    });
    const { identityId } = await credentials();
    const s3 = new S3Client({ region: config.region, credentials });
    return new Storage(s3, config.dataBucket, `users/${identityId}/data.json`);
  }

  async load(): Promise<Snapshot> {
    try {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key }));
      const data = migrate(JSON.parse(await res.Body!.transformToString()));
      return { data, etag: res.ETag ?? null };
    } catch (err) {
      if (err instanceof S3ServiceException && err.name === "NoSuchKey") {
        return { data: emptyData(), etag: null };
      }
      throw err;
    }
  }

  /**
   * Applies `change` to the latest data and saves it. If another device saved
   * in between, reloads and applies the change again.
   */
  async update(current: Snapshot, change: (data: GerageData) => GerageData, attempts = 3): Promise<Snapshot> {
    let snapshot = current;
    for (let i = 0; i < attempts; i++) {
      const data = change(structuredClone(snapshot.data));
      try {
        const res = await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: this.key,
            Body: JSON.stringify(data, null, 2),
            ContentType: "application/json",
            CacheControl: "no-store",
            ...(snapshot.etag ? { IfMatch: snapshot.etag } : { IfNoneMatch: "*" }),
          }),
        );
        return { data, etag: res.ETag ?? null };
      } catch (err) {
        if (!isConflict(err)) throw err;
        snapshot = await this.load();
      }
    }
    throw new Error(i18n.t("errors.saveConflict"));
  }
}

function isConflict(err: unknown) {
  const status = err instanceof S3ServiceException ? err.$metadata.httpStatusCode : undefined;
  return status === 412 || status === 409;
}
