import { UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/**
 * Apple ID identityToken 검증 전용 유틸.
 * - Apple JWKS(공개키)만 사용 → 별도 .p8 키 필요 없음.
 * - 검증 항목: 서명, iss=https://appleid.apple.com, aud=APPLE_BUNDLE_ID, exp, sub 존재.
 */

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys');

// 모듈 단위 캐시 (cooldown / cacheMaxAge 옵션은 jose v5에서 기본값 사용).
// 프로세스 lifetime 동안 한 번만 생성되어 키 회전 자동 처리.
const appleJWKS = createRemoteJWKSet(APPLE_JWKS_URL);

export interface AppleIdentityTokenPayload extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
}

export async function verifyAppleIdentityToken(params: {
  identityToken: string;
  audience: string;
}): Promise<AppleIdentityTokenPayload> {
  try {
    const { payload } = await jwtVerify(params.identityToken, appleJWKS, {
      issuer: APPLE_ISSUER,
      audience: params.audience,
    });

    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Invalid Apple token: missing sub');
    }

    return payload as AppleIdentityTokenPayload;
  } catch (e) {
    if (e instanceof UnauthorizedException) throw e;
    const message = e instanceof Error ? e.message : String(e);
    throw new UnauthorizedException(
      `Apple identityToken verification failed: ${message}`,
    );
  }
}
