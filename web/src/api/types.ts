export type UserType = "User" | "Admin";

export interface SimpleUser {
  id: string;
  username: string;
  type: UserType;
}

export interface UserTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserAuth {
  user: SimpleUser;
  tokens: UserTokens;
}

export interface Artist {
  id: string;
  userId: string;
  name: string;
  coverPath: string | null;
  addedDateMillis: number;
  nbPlayed: number;
  isInQuickAccess: boolean;
  lastUpdateAtMillis: number;
}

export interface Album {
  id: string;
  userId: string;
  name: string;
  coverPath: string | null;
  artist: Artist;
  nbPlayed: number;
  isInQuickAccess: boolean;
  addedDateMillis: number;
  lastUpdateAtMillis: number;
}

export interface Music {
  fingerprint: string;
  userId: string;
  id: string;
  name: string;
  album: Album;
  artists: Artist[];
  path: string;
  albumPosition: number | null;
  coverPath: string;
  duration: number;
  addedDateMillis: number;
  lastUpdateAtMillis: number;
  nbPlayed: number;
  isInQuickAccess: boolean;
  scope: "User" | "SharedPlayedList";
}

export interface ArtistUpload {
  name: string;
  nbPlayed: number;
  isInQuickAccess: boolean;
}

export interface AlbumUpload {
  name: string;
  nbPlayed: number;
  isInQuickAccess: boolean;
  artistUpload: ArtistUpload;
}

export interface MusicUploadSpec {
  name: string;
  albumUpload: AlbumUpload;
  artists: ArtistUpload[];
  albumPosition: number | null;
  duration: number;
  nbPlayed: number;
  isInQuickAccess: boolean;
}

export interface UserStorage {
  max: {
    type: "AllAvailable" | "Reduced";
    total: number;
  };
  current: number;
}
