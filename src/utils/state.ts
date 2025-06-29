/* eslint-disable no-plusplus */
// vendor imports
import React, { createContext } from 'react';

// local imports
import { Event, Lobby, Player } from '../api/APITypes';

/** Typing for application global state. */
export interface GlobalStateType {
  applicationLoading: boolean;
  lobbyId?: string;
  playerId?: string;
  preflight?: any;
  lobby?: Lobby;
  // poll: any;
  currentPlayer?: Player;
  events?: Event[];
}

/** Default value of application global state. */
export const defaultGlobalState: GlobalStateType = {
  applicationLoading: false,
  events: [],
};

/** Enum of supported global actions. */
export enum GlobalStateAction {
  RESET_STATE = 'RESET_STATE',
  UPDATE_STATE = 'UPDATE_STATE',
  PAGE_LOADING_START = 'PAGE_LOADING_START',
  PAGE_LOADING_STOP = 'PAGE_LOADING_STOP',
  UPDATE_LOBBY = 'UPDATE_LOBBY',
  ADD_EVENTS = 'ADD_EVENTS',
}

export type GlobalStateActionType =
  | { type: GlobalStateAction.RESET_STATE }
  | { type: GlobalStateAction.UPDATE_STATE; state: Partial<GlobalStateType> }
  | { type: GlobalStateAction.PAGE_LOADING_START }
  | { type: GlobalStateAction.PAGE_LOADING_STOP }
  | { type: GlobalStateAction.UPDATE_LOBBY; lobby: Lobby }
  | { type: GlobalStateAction.ADD_EVENTS; events: Event[] };

// /** Payload for dispatching a global action. */
// export interface GlobalActionDispatchType {
//   type: GlobalStateAction;
//   payload?: any;
// }

/** Typing for global action reducer method. */
export type GlobalActionReducerMethod = (
  state: GlobalStateType,
  action: GlobalStateActionType,
) => GlobalStateType;

let applicationLoadingQueue = 0;

export const globalActionReducer: GlobalActionReducerMethod = (
  state,
  action,
) => {
  switch (action.type) {
    case GlobalStateAction.RESET_STATE:
      // Reset the state EXCEPT for the preflight data
      return { ...defaultGlobalState, preflight: state.preflight };

    case GlobalStateAction.UPDATE_STATE:
      return { ...state, ...action.state };

    case GlobalStateAction.PAGE_LOADING_START:
      applicationLoadingQueue++;
      return {
        ...state,
        applicationLoading: applicationLoadingQueue > 0,
      };

    case GlobalStateAction.PAGE_LOADING_STOP:
      applicationLoadingQueue--;
      return {
        ...state,
        applicationLoading: applicationLoadingQueue > 0,
      };

    case GlobalStateAction.UPDATE_LOBBY:
      return {
        ...state,
        lobby: action.lobby,
        currentPlayer: action.lobby.players.find(
          (ply) => ply.id.$oid === state.playerId,
        ),
      };

    case GlobalStateAction.ADD_EVENTS:
      return { ...state, events: [...(state.events ?? []), ...action.events] };

    default:
      // eslint-disable-next-line no-console
      console.warn('Unhandled action!', action);
      return state;
  }
};

/** Context for subscribing to changes in global state. */
export const GlobalStateContext =
  createContext<GlobalStateType>(defaultGlobalState);

/** Context for fetching method to dispatch actions. */
export const GlobalActionDispatchContext = createContext<
  React.Dispatch<GlobalStateActionType>
>(() => {});
