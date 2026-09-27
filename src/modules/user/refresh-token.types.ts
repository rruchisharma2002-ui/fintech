export type RefreshToken = {
  id: string;
  userId: string;
  tokenHash: string;
  tokenFamilyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};
  export type RefreshResponse = {
    accessToken: string;
    refreshToken: string;
  };