import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, importPKCS8 } from 'jose';

/**
 * Apple Sign in REST API client.
 * - client_secret JWT (ES256, .p8 키) 생성
 * - /auth/token 으로 authorizationCode → refresh_token 교환
 * - /auth/revoke 로 refresh_token 폐기 (Apple 권장: 계정 삭제 시 호출)
 *
 * Apple 키가 .env에 설정되어 있지 않으면 메서드 호출 시 경고만 남기고 no-op 으로 동작한다.
 * (B안: revoke까지 구현하지만 키가 없는 환경에서도 부팅은 막지 않는다.)
 */
@Injectable()
export class AppleOAuthClient {
  private readonly logger = new Logger(AppleOAuthClient.name);
  private readonly tokenEndpoint = 'https://appleid.apple.com/auth/token';
  private readonly revokeEndpoint = 'https://appleid.apple.com/auth/revoke';

  constructor(private readonly configService: ConfigService) {}

  private getConfig() {
    const teamId = this.configService.get<string>('APPLE_TEAM_ID');
    const keyId = this.configService.get<string>('APPLE_AUTH_KEY_ID');
    // 줄바꿈은 .env에서 \n 으로 들어올 수 있어 escape 처리
    const rawKey = this.configService.get<string>('APPLE_AUTH_KEY');
    const privateKey = rawKey?.replace(/\\n/g, '\n');
    const clientId = this.configService.get<string>('APPLE_BUNDLE_ID');
    if (!teamId || !keyId || !privateKey || !clientId) return null;
    return { teamId, keyId, privateKey, clientId };
  }

  isConfigured(): boolean {
    return this.getConfig() !== null;
  }

  private async buildClientSecret(): Promise<string | null> {
    const cfg = this.getConfig();
    if (!cfg) return null;

    const alg = 'ES256';
    const now = Math.floor(Date.now() / 1000);
    const key = await importPKCS8(cfg.privateKey, alg);

    return await new SignJWT({})
      .setProtectedHeader({ alg, kid: cfg.keyId })
      .setIssuer(cfg.teamId)
      .setIssuedAt(now)
      .setExpirationTime(now + 60 * 10) // 10분 (Apple max 6개월)
      .setAudience('https://appleid.apple.com')
      .setSubject(cfg.clientId)
      .sign(key);
  }

  /**
   * authorizationCode → Apple refresh_token 교환.
   * 실패하거나 키 미설정 시 null 반환 (호출 측이 graceful 처리).
   */
  async exchangeAuthorizationCode(
    authorizationCode: string,
  ): Promise<string | null> {
    const cfg = this.getConfig();
    if (!cfg) {
      this.logger.warn(
        '[APPLE] OAuth key not configured. Skipping token exchange.',
      );
      return null;
    }

    try {
      const clientSecret = await this.buildClientSecret();
      if (!clientSecret) return null;

      const body = new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: 'authorization_code',
      });

      const res = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(
          `[APPLE] /auth/token failed. status=${res.status} body=${text}`,
        );
        return null;
      }

      const json = (await res.json()) as { refresh_token?: string };
      if (!json.refresh_token) {
        this.logger.warn(
          '[APPLE] /auth/token success but no refresh_token in response',
        );
        return null;
      }
      return json.refresh_token;
    } catch (e) {
      this.logger.error(
        `[APPLE] exchangeAuthorizationCode error: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  /**
   * refresh_token (또는 access_token) 폐기.
   * 키 미설정/실패 시 false 반환 (호출 측이 graceful 처리).
   */
  async revokeToken(
    token: string,
    tokenType: 'refresh_token' | 'access_token' = 'refresh_token',
  ): Promise<boolean> {
    const cfg = this.getConfig();
    if (!cfg) {
      this.logger.warn('[APPLE] OAuth key not configured. Skipping revoke.');
      return false;
    }

    try {
      const clientSecret = await this.buildClientSecret();
      if (!clientSecret) return false;

      const body = new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: clientSecret,
        token,
        token_type_hint: tokenType,
      });

      const res = await fetch(this.revokeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(
          `[APPLE] /auth/revoke failed. status=${res.status} body=${text}`,
        );
        return false;
      }

      return true;
    } catch (e) {
      this.logger.error(
        `[APPLE] revokeToken error: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }
}
