// Vendor imports
import { createContext } from 'react';

export const WebSocketContext = createContext<WebSocket | undefined>(undefined);

/** Generic wrapper for message payloads returned from server. */
export interface ServerMessage<T = Record<string, unknown>> {
  error?: string;
  payload?: T;
}

export interface ObjectId {
  $oid: string;
}

export interface Datetime {
  $date: string;
}

export type EventInsert =
  | ['player', ObjectId]
  | ['currency', number]
  | ['bundle', string];

export interface Event {
  id: ObjectId;
  time: Datetime;
  key: string;
  inserts: EventInsert[];
}

export interface Player {
  id: ObjectId;
  name: string;
  balance: number;
}

export interface CreateLobbyRequest {
  unlimitedBank: boolean;
  freeParking: boolean;
  maxPlayers: number;
  bankBalance: number;
  startingBalance: number;
  currency: string;
}

export interface Lobby {
  id: ObjectId;
  code: string;
  created: Datetime;
  expires: Datetime;
  disbanded: boolean;
  options: CreateLobbyRequest;
  bank: number;
  freeParking: number;
  banker: ObjectId;
  players: Player[];
}

// #region WebSocket message types
export enum WSMessageType {
  Kick = 'kick',
  Update = 'update',
}

export interface WSKickMessage {
  type: WSMessageType.Kick;
  player: ObjectId | null;
}
export interface WSUpdateMessage {
  type: WSMessageType.Update;
  payload: {
    lobby: Lobby;
    events: Event[];
  };
}

export type WSMessage = WSKickMessage | WSUpdateMessage;

// #endregion

// OLD TYPINGS BELOW

export interface CreateLobbyResponse {
  code: string;
}

export interface JoinLobbyRequest {
  code: string;
  name: string;
}

export interface JoinLobbyResponse {
  playerId: string;
}
